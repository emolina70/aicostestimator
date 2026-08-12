import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardData, updateProfileName } from "@/lib/analysis.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Conta | AI Dev Cost Optimizer" },
      { name: "description", content: "Gerencie seu perfil, senha, plano e limite mensal de análises." },
      { property: "og:title", content: "Conta | AI Dev Cost Optimizer" },
      {
        property: "og:description",
        content: "Gerencie seu perfil, senha, plano e limite mensal de análises.",
      },
    ],
  }),
  component: SettingsPage,
});

const PLAN_INFO = [
  { code: "free", name: "Free", limit: "5 análises/mês", detail: "Estimativas completas e histórico recente." },
  { code: "starter", name: "Starter", limit: "100 análises/mês", detail: "Projetos ilimitados e prompt otimizado." },
  { code: "pro", name: "Pro", limit: "1.000 análises/mês", detail: "Histórico completo e comparação com consumo real." },
];

function SettingsPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const queryClient = useQueryClient();

  const fetchData = useServerFn(getDashboardData);
  const saveName = useServerFn(updateProfileName);
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchData({}) });

  useEffect(() => {
    if (data?.profile.name) setName(data.profile.name);
  }, [data?.profile.name]);

  const nameMutation = useMutation({
    mutationFn: () => saveName({ data: { name } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Perfil atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function changePassword() {
    if (password.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    toast.success("Senha alterada");
  }

  const used = data?.used ?? 0;
  const limit = data?.plan.limit ?? 5;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">Perfil, segurança e plano.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="surface">
          <CardHeader>
            <CardTitle className="text-base">Perfil</CardTitle>
            <CardDescription>{data?.profile.email ?? ""}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button onClick={() => nameMutation.mutate()} disabled={nameMutation.isPending}>
              Salvar
            </Button>
          </CardContent>
        </Card>

        <Card className="surface">
          <CardHeader>
            <CardTitle className="text-base">Alterar senha</CardTitle>
            <CardDescription>Defina uma nova senha de acesso.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pass">Nova senha</Label>
              <Input
                id="pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={changePassword}>
              Atualizar senha
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="surface">
        <CardHeader>
          <CardTitle className="text-base">Plano e consumo</CardTitle>
          <CardDescription>
            {used} de {limit} análises usadas neste mês.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (used / Math.max(limit, 1)) * 100)}%` }}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {PLAN_INFO.map((p) => {
              const current = data?.plan.code === p.code;
              return (
                <div
                  key={p.code}
                  className={`rounded-xl border p-4 ${current ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-display font-semibold">{p.name}</p>
                    {current && <Badge>Atual</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-primary">{p.limit}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{p.detail}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            A cobrança ainda não está ativa: os planos existem para controle de limites e já estão
            prontos para integração futura com um gateway de pagamento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
