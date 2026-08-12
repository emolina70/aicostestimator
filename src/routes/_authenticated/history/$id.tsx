import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAnalysisDetail } from "@/lib/analysis.functions";
import { complexityLevelOf, type EstimationResult } from "@/lib/estimator";
import { AnalysisReport } from "@/components/AnalysisReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe da análise | AI Dev Cost Optimizer" },
      { name: "description", content: "Faixa estimada, fatores, etapas e prompt otimizado." },
      { property: "og:title", content: "Detalhe da análise | AI Dev Cost Optimizer" },
      { property: "og:description", content: "Faixa estimada, fatores, etapas e prompt otimizado." },
    ],
  }),
  component: AnalysisDetail,
  errorComponent: () => (
    <p className="text-sm text-muted-foreground">Não foi possível carregar esta análise.</p>
  ),
});

type Row = Record<string, unknown>;

function AnalysisDetail() {
  const { id } = Route.useParams();
  const fetchDetail = useServerFn(getAnalysisDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => fetchDetail({ data: { id } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Análise não encontrada.</p>;

  const a = data.analysis as Row;
  const prompt = a["prompts"] as { title: string; content: string; platform: string } | null;
  const num = (k: string) => Number(a[k] ?? 0);
  const score = num("complexity_score");
  const confidence = num("confidence_score");

  const result: EstimationResult = {
    platform: (a["platform"] as EstimationResult["platform"]) ?? "lovable",
    taskType: (a["task_type"] as EstimationResult["taskType"]) ?? "other",
    complexityScore: score,
    complexityLevel: complexityLevelOf(score),
    confidenceScore: confidence,
    confidenceLevel: confidence >= 75 ? "Alta" : confidence >= 55 ? "Média" : "Baixa",
    estimatedMin: num("estimated_min"),
    estimatedExpected: num("estimated_expected"),
    estimatedMax: num("estimated_max"),
    scores: {
      frontend: num("frontend_score"),
      backend: num("backend_score"),
      database: num("database_score"),
      authentication: num("authentication_score"),
      integration: num("integration_score"),
      logic: num("logic_score"),
    },
    detectedSignals: [],
    estimatedEntities: num("estimated_entities"),
    estimatedOperations: num("estimated_operations"),
    requirementCount: 0,
    actionCount: 0,

    factors: (a["factors"] as EstimationResult["factors"]) ?? [],
    recommendations: String(a["recommendation"] ?? "").split("\n").filter(Boolean),
    steps: (a["steps"] as EstimationResult["steps"]) ?? [],
    optimizedPrompt: data.optimization?.optimized_prompt ?? "",
    estimatedOptimized: Number(data.optimization?.estimated_optimized ?? 0),
    reductionPercentage: Number(data.optimization?.estimated_reduction_percentage ?? 0),
    wordCount: (prompt?.content ?? "").split(/\s+/).filter(Boolean).length,
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/history">
          <ArrowLeft className="size-4" /> Voltar ao histórico
        </Link>
      </Button>

      <div>
        <h1 className="font-display text-3xl font-semibold">{prompt?.title ?? "Análise"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date(String(a["created_at"])).toLocaleString("pt-BR")} · {String(a["platform"])}
        </p>
      </div>

      <AnalysisReport result={result} />

      <Card className="surface">
        <CardHeader>
          <CardTitle className="text-base">Prompt original</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-secondary/60 p-4 font-mono text-xs text-muted-foreground">
            {prompt?.content}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
