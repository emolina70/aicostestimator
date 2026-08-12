import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { analyzePrompt, listProjects, getDashboardData } from "@/lib/analysis.functions";
import type { AnalyzeResponse } from "@/lib/analysis.functions";
import { PLATFORMS } from "@/lib/estimator";
import { AnalysisReport } from "@/components/AnalysisReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analyze")({
  head: () => ({
    meta: [
      { title: "Analisar prompt | AI Dev Cost Optimizer" },
      {
        name: "description",
        content: "Estime a faixa provável de créditos de um prompt antes de executá-lo.",
      },
      { property: "og:title", content: "Analisar prompt | AI Dev Cost Optimizer" },
      {
        property: "og:description",
        content: "Estime a faixa provável de créditos de um prompt antes de executá-lo.",
      },
    ],
  }),
  component: Analyze,
});

function Analyze() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState("lovable");
  const [projectId, setProjectId] = useState("none");
  const [response, setResponse] = useState<AnalyzeResponse | null>(null);

  const queryClient = useQueryClient();
  const runAnalysis = useServerFn(analyzePrompt);
  const fetchProjects = useServerFn(listProjects);
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: () => fetchProjects({}) });

  const mutation = useMutation({
    mutationFn: () =>
      runAnalysis({
        data: {
          title: title.trim() || content.slice(0, 60),
          content,
          platform,
          projectId: projectId === "none" ? null : projectId,
        },
      }),
    onSuccess: (data) => {
      setResponse(data);
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`Análise concluída (${data.usage.used}/${data.usage.limit} no mês)`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Analisar prompt</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Cole o prompt que pretende executar. Devolvemos uma faixa probabilística de consumo — não
          um valor exato — com fatores, etapas sugeridas e uma versão otimizada.
        </p>
      </div>

      <Card className="surface">
        <CardHeader>
          <CardTitle className="text-base">Prompt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                placeholder="Ex.: Tela de checkout"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.id} value={p.id} disabled={!p.enabled}>
                      {p.label}
                      {p.enabled ? "" : " (em breve)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Projeto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem projeto</SelectItem>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Conteúdo do prompt</Label>
            <Textarea
              id="content"
              rows={12}
              className="font-mono text-xs"
              placeholder="Cole aqui o prompt completo…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {content.trim().split(/\s+/).filter(Boolean).length} palavras
            </p>
          </div>

          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || content.trim().length < 10}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Estimar consumo
          </Button>
        </CardContent>
      </Card>

      {response && <AnalysisReport result={response.result} />}
    </div>
  );
}
