import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { recordActualUsage, getAccuracy } from "@/lib/analysis.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Target } from "lucide-react";

/**
 * Item 17 — o usuário informa quantos créditos o prompt realmente consumiu.
 * O sistema compara com a estimativa e mostra a precisão obtida.
 */
export function ActualUsageForm({ promptId, expected }: { promptId: string; expected: number }) {
  const [credits, setCredits] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const fetchAccuracy = useServerFn(getAccuracy);
  const save = useServerFn(recordActualUsage);

  const { data: accuracy } = useQuery({
    queryKey: ["accuracy", promptId],
    queryFn: () => fetchAccuracy({ data: { promptId } }),
  });

  const mutation = useMutation({
    mutationFn: (value: number) => save({ data: { promptId, actualCredits: value, notes } }),
    onSuccess: () => {
      toast.success("Consumo real registrado");
      setCredits("");
      setNotes("");
      void queryClient.invalidateQueries({ queryKey: ["accuracy", promptId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["analyses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const diff = accuracy?.actual === null || accuracy == null ? null : accuracy.actual - expected;

  return (
    <Card className="surface">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="size-4 text-primary" /> Consumo real
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {accuracy?.actual !== null && accuracy != null ? (
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Estimado" value={`${expected}`} />
            <Metric label="Real" value={`${accuracy.actual}`} accent />
            <Metric
              label="Diferença"
              value={`${diff !== null && diff > 0 ? "+" : ""}${diff === null ? "–" : Math.round(diff * 100) / 100}`}
            />
            <Metric label="Precisão" value={accuracy.accuracy === null ? "–" : `${accuracy.accuracy}%`} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ainda não há consumo real informado para este prompt. Informar o valor real melhora a
            calibração das próximas estimativas.
          </p>
        )}

        {accuracy && accuracy.entries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {accuracy.entries.map((e, i) => (
              <Badge key={i} variant="outline" className="font-mono text-xs">
                {e.credits} cr · {new Date(e.date).toLocaleDateString("pt-BR")}
              </Badge>
            ))}
          </div>
        )}

        <form
          className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const value = Number(credits.replace(",", "."));
            if (!Number.isFinite(value) || value <= 0) {
              toast.error("Informe um número de créditos válido");
              return;
            }
            mutation.mutate(value);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="credits">Créditos consumidos</Label>
            <Input
              id="credits"
              inputMode="decimal"
              placeholder="Ex.: 12.5"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              rows={1}
              placeholder="Ex.: precisou de 2 correções extras"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />} Registrar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl font-semibold ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
