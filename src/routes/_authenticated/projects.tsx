import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createProject, listProjects } from "@/lib/analysis.functions";
import { PLATFORMS } from "@/lib/estimator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projetos | AI Dev Cost Optimizer" },
      { name: "description", content: "Organize seus prompts e estimativas por projeto." },
      { property: "og:title", content: "Projetos | AI Dev Cost Optimizer" },
      { property: "og:description", content: "Organize seus prompts e estimativas por projeto." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState("lovable");
  const queryClient = useQueryClient();

  const fetchProjects = useServerFn(listProjects);
  const addProject = useServerFn(createProject);
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects({}),
  });

  const mutation = useMutation({
    mutationFn: () => addProject({ data: { name, description, platform } }),
    onSuccess: () => {
      setName("");
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Projetos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Agrupe prompts por produto ou plataforma de desenvolvimento por IA.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="surface h-fit">
          <CardHeader>
            <CardTitle className="text-base">Novo projeto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pname">Nome</Label>
              <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pdesc">Descrição</Label>
              <Textarea
                id="pdesc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
            <Button
              className="w-full"
              disabled={!name.trim() || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              Criar projeto
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (projects ?? []).length === 0 ? (
            <Card className="surface">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Nenhum projeto cadastrado.
              </CardContent>
            </Card>
          ) : (
            (projects ?? []).map((p) => (
              <Card key={p.id} className="surface">
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{p.name}</p>
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {p.platform}
                    </span>
                  </div>
                  {p.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
