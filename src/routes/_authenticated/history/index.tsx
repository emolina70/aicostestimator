import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardData } from "@/lib/analysis.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history/")({
  head: () => ({
    meta: [
      { title: "Histórico | AI Dev Cost Optimizer" },
      { name: "description", content: "Todas as estimativas de créditos geradas na sua conta." },
      { property: "og:title", content: "Histórico | AI Dev Cost Optimizer" },
      { property: "og:description", content: "Todas as estimativas de créditos geradas na sua conta." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const fetchData = useServerFn(getDashboardData);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchData({}) });
  const analyses = data?.analyses ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Histórico</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suas análises anteriores, com faixa estimada e nível de confiança.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : analyses.length === 0 ? (
        <Card className="surface">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma análise registrada ainda.</p>
            <Button className="mt-4" asChild>
              <Link to="/analyze">Analisar um prompt</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {analyses.map((a) => (
            <Link key={a.id} to="/history/$id" params={{ id: a.id }}>
              <Card className="surface transition-colors hover:border-primary/50">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString("pt-BR")} · {a.platform}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">complexidade {a.complexity}</Badge>
                    <Badge variant="outline">confiança {a.confidence}%</Badge>
                    <span className="font-mono text-sm">
                      {a.min} – <span className="text-primary">{a.expected}</span> – {a.max}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
