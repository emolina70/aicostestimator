import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardData } from "@/lib/analysis.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Sparkles, TrendingUp, Gauge, Wallet, Target, PiggyBank, Receipt } from "lucide-react";

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

const chartTheme = {
  grid: "hsl(var(--border))",
  axis: "hsl(var(--muted-foreground))",
};

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="surface">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const fetchData = useServerFn(getDashboardData);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchData({}) });

  const analyses = data?.analyses ?? [];
  const m = data?.metrics;
  const series = (data?.series ?? []).map((s) => ({
    ...s,
    label: new Date(`${s.date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
  }));
  const avg = m && m.totalAnalyses > 0 ? Math.round((m.totalEstimated / m.totalAnalyses) * 10) / 10 : 0;

  const tooltipStyle = {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    fontSize: 12,
  } as const;

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          icon={<Sparkles className="size-4" />}
          label="Total de análises"
          value={isLoading ? "—" : String(m?.totalAnalyses ?? 0)}
          hint={`${data?.used ?? 0}/${data?.plan.limit ?? 0} no mês · plano ${data?.plan.name ?? "Free"}`}
        />
        <Stat
          icon={<Wallet className="size-4" />}
          label="Créditos estimados"
          value={isLoading ? "—" : String(m?.totalEstimated ?? 0)}
          hint={`Média de ${avg} por prompt`}
        />
        <Stat
          icon={<Receipt className="size-4" />}
          label="Créditos reais"
          value={isLoading ? "—" : String(m?.totalActual ?? 0)}
          hint="Informado por você nas análises"
        />
        <Stat
          icon={<Target className="size-4" />}
          label="Precisão média"
          value={isLoading ? "—" : m?.avgAccuracy !== null && m?.avgAccuracy !== undefined ? `${m.avgAccuracy}%` : "—"}
          hint="Estimativa × consumo real informado"
        />
        <Stat
          icon={<PiggyBank className="size-4" />}
          label="Economia estimada"
          value={isLoading ? "—" : String(m?.savings ?? 0)}
          hint="Se os prompts otimizados fossem usados"
        />
        <Stat
          icon={<Gauge className="size-4" />}
          label="Complexidade média"
          value={isLoading ? "—" : `${m?.avgComplexity ?? 0}/100`}
          hint="Score médio dos prompts analisados"
        />
      </div>

      {series.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Consumo estimado × real" subtitle="Créditos por dia">
            <AreaChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
              <XAxis dataKey="label" stroke={chartTheme.axis} fontSize={11} tickLine={false} />
              <YAxis stroke={chartTheme.axis} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="estimated"
                name="Estimado"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.18}
              />
              <Area
                type="monotone"
                dataKey="actual"
                name="Real"
                stroke="hsl(var(--success))"
                fill="hsl(var(--success))"
                fillOpacity={0.14}
              />
            </AreaChart>
          </ChartCard>

          <ChartCard title="Precisão da estimativa" subtitle="% de acerto frente ao consumo real">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
              <XAxis dataKey="label" stroke={chartTheme.axis} fontSize={11} tickLine={false} />
              <YAxis domain={[0, 100]} stroke={chartTheme.axis} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="accuracy"
                name="Precisão (%)"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                connectNulls
                dot={false}
              />
            </LineChart>
          </ChartCard>

          <ChartCard title="Prompts analisados" subtitle="Quantidade por dia">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
              <XAxis dataKey="label" stroke={chartTheme.axis} fontSize={11} tickLine={false} />
              <YAxis allowDecimals={false} stroke={chartTheme.axis} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Prompts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Complexidade média" subtitle="Score de 0 a 100 por dia">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
              <XAxis dataKey="label" stroke={chartTheme.axis} fontSize={11} tickLine={false} />
              <YAxis domain={[0, 100]} stroke={chartTheme.axis} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="complexity"
                name="Complexidade"
                stroke="hsl(var(--warning))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartCard>
        </div>
      )}

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
                      {a.actual !== null && (
                        <Badge variant="outline" className="border-success/50 text-success">
                          real {a.actual}
                        </Badge>
                      )}
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

export { TrendingUp };
