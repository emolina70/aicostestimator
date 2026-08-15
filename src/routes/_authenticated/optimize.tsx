import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOptimizationUsage, optimizePrompt } from "@/lib/optimizer.functions";
import type { OptimizeResponse } from "@/lib/optimizer.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Gauge, Loader2, Lock, Sparkles, TriangleAlert, Wand2 } from "lucide-react";

const MAX_CHARS = 120000;

const ENGINE_LABEL: Record<OptimizeResponse["engine"], string> = {
  lovable: "Otimizado pela IA do Lovable",
  openai: "Otimizado pela OpenAI",
  local: "Otimizado por regras locais",
};

export const Route = createFileRoute("/_authenticated/optimize")({
  head: () => ({
    meta: [
      { title: "Otimizar prompt com IA | AI Dev Cost Optimizer" },
      {
        name: "description",
        content:
          "Otimize seu prompt com a IA nativa do Lovable e receba análise, melhorias e notas de qualidade — sem precisar de conta OpenAI.",
      },
      { property: "og:title", content: "Otimizar prompt com IA | AI Dev Cost Optimizer" },
      {
        property: "og:description",
        content:
          "Otimize seu prompt com a IA nativa do Lovable e receba análise, melhorias e notas de qualidade — sem precisar de conta OpenAI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OptimizePage,
});


function ScoreCard({ label, score, tone }: { label: string; score: number; tone: "muted" | "good" }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`font-display text-4xl font-semibold ${tone === "good" ? "text-success" : "text-foreground"}`}
      >
        {score}
        <span className="ml-1 text-base font-normal text-muted-foreground">/100</span>
      </p>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full ${tone === "good" ? "bg-success" : "bg-primary"}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}

function OptimizePage() {
  const [content, setContent] = useState("");
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const runOptimize = useServerFn(optimizePrompt);
  const fetchUsage = useServerFn(getOptimizationUsage);

  const { data: usage } = useQuery({
    queryKey: ["optimization-usage"],
    queryFn: () => fetchUsage({}),
  });

  const mutation = useMutation({
    mutationFn: () => runOptimize({ data: { content: content.trim() } }),
    onSuccess: (data) => {
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: ["optimization-usage"] });
      toast.success("Prompt otimizado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const tooShort = content.trim().length < 10;
  const tooLong = content.length > MAX_CHARS;
  const delta = result ? result.qualityScoreAfter - result.qualityScoreBefore : 0;
  const used = usage?.used ?? 0;
  const limit = usage?.limit ?? 5;
  const limitReached = Boolean(usage) && used >= limit;

  function handleOptimize() {
    if (mutation.isPending) return;
    if (tooShort) {
      toast.error("Informe um prompt para iniciar a otimização.");
      return;
    }
    mutation.mutate();
  }

  function handleCopy() {
    if (!result) return;
    void navigator.clipboard.writeText(result.optimizedPrompt);
    toast.success("Prompt copiado!");
  }

  function handleEstimate() {
    if (!result) return;
    try {
      sessionStorage.setItem("prefill-prompt", result.optimizedPrompt);
    } catch {
      // ambiente sem sessionStorage: segue para a tela mesmo assim
    }
    void navigate({ to: "/analyze" });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Otimizar prompt com IA</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          A IA nativa do Lovable reorganiza, esclarece e completa seu prompt sem alterar a intenção
          original — e devolve a análise, as melhorias aplicadas e as notas antes/depois. Não é
          necessária nenhuma conta ou chave de IA externa.
        </p>
        {usage && (
          <p className="mt-2 text-xs text-muted-foreground">
            {used} de {limit} otimizações usadas neste mês · plano {usage.plan}
          </p>
        )}
      </div>


      <Card className="surface">
        <CardHeader>
          <CardTitle className="text-base">Prompt original</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Descreva o que você quer construir</Label>
            <Textarea
              id="prompt"
              rows={10}
              className="font-mono text-xs"
              placeholder="Ex.: crie um sistema para uma padaria"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={mutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              {content.length.toLocaleString("pt-BR")} / {MAX_CHARS.toLocaleString("pt-BR")}{" "}
              caracteres
            </p>
            {tooLong && (
              <p className="text-xs text-destructive">
                O prompt excede o limite de {MAX_CHARS.toLocaleString("pt-BR")} caracteres. Reduza o
                texto.
              </p>
            )}
          </div>

          {limitReached ? (
            <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-warning">
                <Lock className="size-4" />
                Limite mensal de otimizações atingido
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Você usou {used} de {limit} otimizações do plano {usage?.plan}. O contador reinicia
                no primeiro dia do próximo mês.
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/settings">Ver planos</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleOptimize} disabled={mutation.isPending || tooShort || tooLong}>
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Otimizar Prompt
              </Button>
              {mutation.isPending && (
                <p className="text-xs text-muted-foreground">
                  Analisando e otimizando seu prompt…
                </p>
              )}
            </div>
          )}

        </CardContent>
      </Card>

      {result && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="surface lg:col-span-2">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wand2 className="size-4 text-success" />
                Prompt otimizado
                <Badge variant="outline" className="border-success/50 text-success">
                  Otimizado por IA
                </Badge>
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="size-4" />
                  Copiar prompt
                </Button>
                <Button size="sm" onClick={handleEstimate}>
                  <Gauge className="size-4" />
                  Estimar créditos
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-secondary/40 p-4 font-mono text-xs leading-relaxed">
                {result.optimizedPrompt}
              </pre>
            </CardContent>
          </Card>

          <Card className="surface">
            <CardHeader>
              <CardTitle className="text-base">Análise da otimização</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <ScoreCard label="Prompt original" score={result.qualityScoreBefore} tone="muted" />
                <ScoreCard label="Prompt otimizado" score={result.qualityScoreAfter} tone="good" />
              </div>
              <p className="text-sm text-muted-foreground">
                Evolução de qualidade:{" "}
                <span className={delta >= 0 ? "text-success" : "text-destructive"}>
                  {delta >= 0 ? "+" : ""}
                  {delta} pontos
                </span>
              </p>
              {result.analysis && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {result.analysis}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Modelo: {result.model} · {result.inputTokens + result.outputTokens} tokens ·{" "}
                {(result.durationMs / 1000).toFixed(1)}s
              </p>
            </CardContent>
          </Card>

          <Card className="surface">
            <CardHeader>
              <CardTitle className="text-base">Melhorias realizadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.improvements.length > 0 ? (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {result.improvements.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  A IA não apontou melhorias relevantes neste prompt.
                </p>
              )}

              <div className="border-t border-border pt-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <TriangleAlert className="size-4 text-warning" />
                  Informações que podem estar faltando
                </p>
                {result.missingInformation.length > 0 ? (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {result.missingInformation.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma informação essencial faltando.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="surface lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Prompt original enviado</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border p-4 font-mono text-xs text-muted-foreground">
                {result.originalPrompt}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
