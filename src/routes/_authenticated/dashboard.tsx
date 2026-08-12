import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardData } from "@/lib/analysis.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Gauge, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel | AI Dev Cost Optimizer" },
      { name: "description", content: "Acompanhe suas análises, plano e estimativas de créditos." },
      { property: "og:title", content: "Painel | AI Dev Cost Optimizer" },
      { property: "og:description", content: "Acompanhe suas análises, plano e estimativas de créditos." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchData = useServerFn(getDashboardData);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchData({}) });

  const analyses = data?.analyses ?? [];
  const avg =
    analyses.length > 0
      ? Math.round((analyses.reduce((s, a) => s + a.expected, 0) / analyses.length) * 10) / 10
      : 0;
  const total = Math.round(analyses.reduce((s, a) => s + a.expected, 0) * 10) / 10;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Olá{data?.profile.name ? `, ${data.profile.name}` : ""} — visão geral das suas estimativas.
          </p>
        </div>
        <Button asChild>
          <Link to="/analyze">
            <Sparkles className="size-4" /> Nova análise
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={<Gauge className="size-4" />}
          label="Análises no mês"
          value={isLoading ? "—" : `${data?.used ?? 0}/${data?.plan.limit ?? 0}`}
          hint={`Plano ${data?.plan.name ?? "Free"}`}
        />
        <Stat
          icon={<Wallet className="size-4" />}
          label="Créditos estimados (total)"
          value={isLoading ? "—" : String(total)}
          hint="Soma dos cenários mais prováveis"
        />
        <Stat
          icon={<TrendingUp className="size-4" />}
          label="Média por prompt"
          value={isLoading ? "—" : String(avg)}
          hint="Cenário mais provável"
        />
        <Stat
          icon={<Sparkles className="size-4" />}
          label="Prompts analisados"
          value={isLoading ? "—" : String(analyses.length)}
          hint="Últimas 20 análises"
        />
      </div>

      <Card className="surface">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Análises recentes</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/history">Ver histórico</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : analyses.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma análise ainda. Cole um prompt e veja a faixa provável de créditos.
              </p>
              <Button className="mt-4" asChild>
                <Link to="/analyze">Analisar meu primeiro prompt</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {analyses.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <Link
                    to="/history/$id"
                    params={{ id: a.id }}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:text-primary"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString("pt-BR")} · {a.platform}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">confiança {a.confidence}%</Badge>
                      <span className="font-mono text-sm">
                        {a.min} – <span className="text-primary">{a.expected}</span> – {a.max}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="surface">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/12 text-primary">
            {icon}
          </span>
          <span className="text-xs uppercase tracking-wide">{label}</span>
        </div>
        <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
