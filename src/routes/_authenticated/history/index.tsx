import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAnalyses, deleteAnalysis } from "@/lib/analysis.functions";
import { PLATFORMS, TASK_TYPES } from "@/lib/estimator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ChevronRight, Search, Trash2 } from "lucide-react";

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

const TASK_LABEL = Object.fromEntries(TASK_TYPES.map((t) => [t.id, t.label]));
const PLATFORM_LABEL = Object.fromEntries(PLATFORMS.map((p) => [p.id, p.label]));

type SortKey = "recent" | "credits" | "complexity" | "accuracy";

function HistoryPage() {
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [task, setTask] = useState("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchAnalyses = useServerFn(listAnalyses);
  const removeAnalysis = useServerFn(deleteAnalysis);

  const { data, isLoading } = useQuery({
    queryKey: ["analyses"],
    queryFn: () => fetchAnalyses({}),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeAnalysis({ data: { id } }),
    onSuccess: () => {
      toast.success("Análise excluída");
      void queryClient.invalidateQueries({ queryKey: ["analyses"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (data ?? []).filter((a) => {
      if (platform !== "all" && a.platform !== platform) return false;
      if (task !== "all" && a.taskType !== task) return false;
      if (term && !`${a.title} ${a.project ?? ""}`.toLowerCase().includes(term)) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "credits") sorted.sort((a, b) => b.expected - a.expected);
    else if (sort === "complexity") sorted.sort((a, b) => b.complexity - a.complexity);
    else if (sort === "accuracy")
      sorted.sort((a, b) => (a.errorPct ?? 999) - (b.errorPct ?? 999));
    else sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return sorted;
  }, [data, search, platform, task, sort]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Histórico</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas as suas análises com faixa estimada, consumo real informado e precisão.
        </p>
      </div>

      <Card className="surface">
        <CardContent className="grid gap-3 py-4 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por título ou projeto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as plataformas</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={task} onValueChange={setTask}>
            <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {TASK_TYPES.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="credits">Maior estimativa</SelectItem>
              <SelectItem value="complexity">Maior complexidade</SelectItem>
              <SelectItem value="accuracy">Melhor precisão</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <Card className="surface">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma análise encontrada.</p>
            <Button className="mt-4" asChild>
              <Link to="/analyze">Analisar um prompt</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prompt</TableHead>
                  <TableHead className="hidden md:table-cell">Plataforma</TableHead>
                  <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                  <TableHead className="text-right">Estimado</TableHead>
                  <TableHead className="text-right">Real</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Complex.</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => navigate({ to: "/history/$id", params: { id: a.id } })}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="max-w-[22ch] truncate font-medium sm:max-w-[40ch]">
                          {a.title}
                        </span>
                        {a.isDemo && (
                          <Badge variant="outline" className="border-primary/40 text-[10px] text-primary">
                            DEMO
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString("pt-BR")}
                        {a.project ? ` · ${a.project}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {PLATFORM_LABEL[a.platform] ?? a.platform}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {TASK_LABEL[a.taskType] ?? a.taskType}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {a.min} – <span className="text-primary">{a.expected}</span> – {a.max}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {a.actual === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={a.errorPct !== null && a.errorPct <= 25 ? "text-success" : "text-warning"}>
                          {a.actual}
                          {a.errorPct !== null && (
                            <span className="ml-1 text-xs text-muted-foreground">({a.errorPct}% erro)</span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right font-mono text-sm">
                      {a.complexity}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir análise"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDelete(a.id);
                          }}
                        >
                          <Trash2 className="size-4 text-muted-foreground" />
                        </Button>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta análise?</AlertDialogTitle>
            <AlertDialogDescription>
              O prompt, a estimativa e o consumo real informado serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
