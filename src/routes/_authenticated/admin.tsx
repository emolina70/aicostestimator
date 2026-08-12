import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getAdminOverview,
  listEstimatorParameters,
  updateEstimatorParameter,
} from "@/lib/analysis.functions";
import { PLATFORMS } from "@/lib/estimator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ShieldAlert, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração | AI Dev Cost Optimizer" },
      { name: "description", content: "Métricas da plataforma e calibração do motor de estimativa." },
      { property: "og:title", content: "Administração | AI Dev Cost Optimizer" },
      {
        property: "og:description",
        content: "Métricas da plataforma e calibração do motor de estimativa.",
      },
    ],
  }),
  component: AdminPage,
  errorComponent: () => (
    <Card className="surface">
      <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
        <ShieldAlert className="size-5 text-destructive" />
        Área restrita a administradores.
      </CardContent>
    </Card>
  ),
});

const PLATFORM_LABEL = Object.fromEntries(PLATFORMS.map((p) => [p.id, p.label]));

const PARAM_LABEL: Record<string, string> = {
  base_credits: "Créditos base",
  credits_per_complexity_point: "Créditos por ponto de complexidade",
  min_factor: "Fator mínimo",
  max_factor: "Fator máximo",
  frontend_weight: "Peso · Frontend",
  backend_weight: "Peso · Backend",
  database_weight: "Peso · Banco de dados",
  authentication_weight: "Peso · Autenticação",
  integration_weight: "Peso · Integrações",
  logic_weight: "Peso · Regras de negócio",
  crud_weight: "Peso · CRUD/entidades",
  complexity_weight: "Peso · Score de complexidade",
};

function AdminPage() {
  const fetchOverview = useServerFn(getAdminOverview);
  const fetchParams = useServerFn(listEstimatorParameters);

  const { data: overview, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview({}),
    retry: false,
  });
  const { data: params } = useQuery({
    queryKey: ["admin-params"],
    queryFn: () => fetchParams({}),
    retry: false,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Administração</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uso da plataforma, custo de IA e calibração dos parâmetros do motor de estimativa.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Usuários" value={overview?.users ?? 0} hint={`${overview?.activeUsers ?? 0} ativos em 30 dias`} />
        <Stat label="Análises" value={overview?.totalAnalyses ?? 0} />
        <Stat
          label="Créditos estimados × reais"
          value={`${overview?.totalEstimated ?? 0} / ${overview?.totalActual ?? 0}`}
        />
        <Stat
          label="Precisão média"
          value={overview?.avgAccuracy === null || overview?.avgAccuracy === undefined ? "—" : `${overview.avgAccuracy}%`}
          hint="Estimado × consumo real informado"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="surface">
          <CardHeader>
            <CardTitle className="text-base">Distribuição por plano</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(overview?.plans ?? []).map((p) => (
              <div key={p.code} className="flex items-center justify-between text-sm">
                <span>
                  {p.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {p.limit >= 9999 ? "ilimitado" : `${p.limit}/mês`}
                  </span>
                </span>
                <Badge variant="outline">{p.users} usuários</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="surface">
          <CardHeader>
            <CardTitle className="text-base">Uso por plataforma e custo de IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(overview?.byPlatform ?? []).map((p) => (
              <div key={p.platform} className="flex items-center justify-between text-sm">
                <span>{PLATFORM_LABEL[p.platform] ?? p.platform}</span>
                <Badge variant="outline">{p.count} análises</Badge>
              </div>
            ))}
            <div className="mt-4 rounded-lg border border-border p-3 text-xs text-muted-foreground">
              Chamadas de IA: <span className="font-mono text-foreground">{overview?.aiCost.calls ?? 0}</span> ·
              tokens{" "}
              <span className="font-mono text-foreground">
                {(overview?.aiCost.inputTokens ?? 0) + (overview?.aiCost.outputTokens ?? 0)}
              </span>{" "}
              · custo estimado{" "}
              <span className="font-mono text-foreground">
                US$ {overview?.aiCost.estimatedCost ?? 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="surface overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Parâmetros do motor de estimativa</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Parâmetro</TableHead>
                  <TableHead className="w-40">Valor</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(params ?? []).map((p) => (
                  <ParamRow
                    key={p.id}
                    id={p.id}
                    platform={PLATFORM_LABEL[p.platform] ?? p.platform}
                    name={PARAM_LABEL[p.parameter_name] ?? p.parameter_name}
                    value={Number(p.parameter_value)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ParamRow({
  id,
  platform,
  name,
  value,
}: {
  id: string;
  platform: string;
  name: string;
  value: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const queryClient = useQueryClient();
  const update = useServerFn(updateEstimatorParameter);

  const mutation = useMutation({
    mutationFn: (v: number) => update({ data: { id, value: v } }),
    onSuccess: () => {
      toast.success("Parâmetro atualizado");
      void queryClient.invalidateQueries({ queryKey: ["admin-params"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changed = draft !== String(value);

  return (
    <TableRow>
      <TableCell className="text-sm text-muted-foreground">{platform}</TableCell>
      <TableCell className="text-sm">{name}</TableCell>
      <TableCell>
        <Input
          inputMode="decimal"
          className="h-9 font-mono"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant={changed ? "default" : "outline"}
          disabled={!changed || mutation.isPending}
          onClick={() => {
            const v = Number(draft.replace(",", "."));
            if (!Number.isFinite(v)) {
              toast.error("Valor inválido");
              return;
            }
            mutation.mutate(v);
          }}
        >
          <Save className="size-3.5" /> Salvar
        </Button>
      </TableCell>
    </TableRow>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="surface">
      <CardContent className="py-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
