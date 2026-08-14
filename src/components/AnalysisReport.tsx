import type { EstimationResult } from "@/lib/estimator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, TriangleAlert } from "lucide-react";

const DIMENSION_LABELS: Record<string, string> = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Banco de dados",
  authentication: "Autenticação",
  integration: "Integrações",
  logic: "Regras de negócio",
};

const IMPACT_LABEL = { low: "Baixo", medium: "Médio", high: "Alto" } as const;

const LEVEL_COLOR: Record<string, string> = {
  "Muito baixa": "text-success",
  Baixa: "text-success",
  Média: "text-warning",
  Alta: "text-destructive",
  "Muito alta": "text-destructive",
};

export function ComplexityGauge({ result }: { result: EstimationResult }) {
  const pct = Math.min(100, Math.max(0, result.complexityScore));
  return (
    <Card className="surface">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium uppercase tracking-wide text-muted-foreground">
          Complexidade
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-3">
          <p className="font-display text-5xl font-semibold">{result.complexityScore}</p>
          <span className="text-lg text-muted-foreground">/ 100</span>
          <span
            className={`ml-auto text-sm font-semibold uppercase tracking-wide ${LEVEL_COLOR[result.complexityLevel] ?? "text-foreground"}`}
          >
            {result.complexityLevel}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="meter-bar h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>Muito baixa</span>
          <span>Baixa</span>
          <span>Média</span>
          <span>Alta</span>
          <span>Muito alta</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function CreditRange({ result }: { result: EstimationResult }) {
  const span = Math.max(result.estimatedMax - result.estimatedMin, 0.001);
  const pos = ((result.estimatedExpected - result.estimatedMin) / span) * 100;

  return (
    <Card className="surface overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground">
          Faixa estimada de créditos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="font-mono text-sm text-muted-foreground">
          {result.estimatedMin} – <span className="text-primary">{result.estimatedExpected}</span> –{" "}
          {result.estimatedMax} créditos · confiança {result.confidenceScore}%
        </p>

        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="font-display text-5xl font-semibold text-gradient">
              {result.estimatedExpected}
            </p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Mais provável</p>
          </div>
          <div className="flex gap-8">
            <div>
              <p className="font-display text-2xl font-semibold text-success">{result.estimatedMin}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Mínimo</p>
            </div>
            <div>
              <p className="font-display text-2xl font-semibold text-destructive">
                {result.estimatedMax}
              </p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Máximo</p>
            </div>
          </div>
        </div>

        <div className="relative pt-6">
          <div className="meter-bar h-2 w-full rounded-full opacity-80" />
          <div
            className="absolute top-3 -translate-x-1/2"
            style={{ left: `${Math.min(97, Math.max(3, pos))}%` }}
          >
            <div className="mx-auto h-6 w-0.5 bg-foreground" />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{result.estimatedMin} créditos</span>
            <span>{result.estimatedMax} créditos</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Complexidade: {result.complexityLevel} ({result.complexityScore}/100)</Badge>
          <Badge variant="outline">Confiança: {result.confidenceLevel} ({result.confidenceScore}%)</Badge>
          <Badge variant="outline">~{result.estimatedEntities} entidades</Badge>
          <Badge variant="outline">~{result.estimatedOperations} operações</Badge>
        </div>

        <p className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          Esta é uma estimativa probabilística baseada no conteúdo do prompt. O consumo real depende
          do estado do projeto, do modelo usado e de iterações imprevistas.
        </p>
      </CardContent>
    </Card>
  );
}

export function AnalysisReport({
  result,
  optimizedPrompt,
  originalPrompt,
  optimizedByAI,
}: {
  result: EstimationResult;
  optimizedPrompt?: string;
  originalPrompt?: string;
  optimizedByAI?: boolean;
}) {
  const optimized = optimizedPrompt ?? result.optimizedPrompt;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CreditRange result={result} />
      <ComplexityGauge result={result} />

      <Card className="surface">
        <CardHeader>
          <CardTitle className="text-base">Fatores da estimativa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(result.scores).map(([dim, value]) => (
            <div key={dim}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted-foreground">{DIMENSION_LABELS[dim] ?? dim}</span>
                <span className="font-mono text-xs text-foreground">{value}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="surface">
        <CardHeader>
          <CardTitle className="text-base">Fatores que influenciaram</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.factors.map((f) => (
            <div key={f.label} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{f.label}</p>
                <Badge
                  variant="outline"
                  className={
                    f.impact === "high"
                      ? "border-destructive/50 text-destructive"
                      : f.impact === "medium"
                        ? "border-warning/50 text-warning"
                        : "border-success/50 text-success"
                  }
                >
                  {IMPACT_LABEL[f.impact]}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="surface">
        <CardHeader>
          <CardTitle className="text-base">Como reduzir a complexidade</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {result.recommendations.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {r}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="surface">
        <CardHeader>
          <CardTitle className="text-base">Divisão sugerida em etapas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Executar por etapas costuma reduzir retrabalho: cada etapa entrega algo funcional e pode
            ser validada antes da próxima. Copie o prompt de cada etapa e execute na ordem.
          </p>
          {result.steps.map((s, i) => (
            <div key={s.title} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  {s.title}
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {s.min ?? s.estimated} – <span className="text-primary">{s.estimated}</span> –{" "}
                    {s.max ?? s.estimated} cr.
                  </span>
                  {s.prompt && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void navigator.clipboard.writeText(s.prompt!);
                        toast.success(`Prompt da etapa ${i + 1} copiado`);
                      }}
                    >
                      <Copy className="size-3.5" /> Copiar prompt
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="surface lg:col-span-2">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Prompt otimizado
            <span className="ml-2 text-xs font-normal text-success">
              −{result.reductionPercentage}% estimado (~{result.estimatedOptimized} créditos)
            </span>
            {optimizedByAI ? (
              <Badge className="ml-2 border-success/50 font-mono text-success" variant="outline">
                Otimizado por IA
              </Badge>
            ) : (
              <Badge className="ml-2 font-mono text-muted-foreground" variant="outline">
                Otimizado por regras
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(optimized);
              toast.success("Prompt otimizado copiado");
            }}
          >
            <Copy className="size-4" /> Copiar
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-secondary/60 p-4 font-mono text-xs leading-relaxed text-foreground">
            {optimized}
          </pre>
        </CardContent>
      </Card>

      {originalPrompt && (
        <Card className="surface lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Comparação: original × otimizado</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                Original
                <Badge variant="outline" className="font-mono">
                  ~{result.estimatedExpected} cr.
                </Badge>
              </div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-secondary/40 p-4 font-mono text-xs text-muted-foreground">
                {originalPrompt}
              </pre>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                Otimizado
                <Badge variant="outline" className="border-success/50 font-mono text-success">
                  ~{result.estimatedOptimized} cr. (−{result.reductionPercentage}%)
                </Badge>
              </div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-secondary/60 p-4 font-mono text-xs text-foreground">
                {optimized}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
