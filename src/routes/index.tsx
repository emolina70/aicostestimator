import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Gauge, ShieldCheck, Split, Sparkles, TrendingDown, Layers } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Dev Cost Optimizer — estimativa de créditos para prompts" },
      {
        name: "description",
        content:
          "Estime a faixa provável de créditos de um prompt antes de executá-lo em ferramentas de desenvolvimento com IA.",
      },
      { property: "og:title", content: "AI Dev Cost Optimizer — estimativa de créditos para prompts" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://aicostestimator.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content:
          "Faixa mínima, provável e máxima de créditos, fatores de complexidade e prompt otimizado.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Gauge,
    title: "Faixa probabilística",
    text: "Mínimo, mais provável e máximo — com nível de confiança explícito. Nunca um número mágico.",
  },
  {
    icon: Layers,
    title: "Fatores de complexidade",
    text: "Frontend, backend, dados, autenticação, integrações e regras de negócio pontuados separadamente.",
  },
  {
    icon: Split,
    title: "Divisão em etapas",
    text: "Sugestão de como quebrar o prompt em execuções menores e previsíveis.",
  },
  {
    icon: TrendingDown,
    title: "Prompt otimizado",
    text: "Versão reescrita com escopo explícito e restrições, com redução estimada.",
  },
  {
    icon: ShieldCheck,
    title: "Dados privados",
    text: "Cada conta só acessa seus próprios prompts, análises e histórico.",
  },
  {
    icon: Sparkles,
    title: "Multiplataforma",
    text: "Lovable hoje; Cursor, Claude Code, Copilot e Codex já previstos na arquitetura.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Gauge className="size-4" />
          </span>
          <span className="font-display text-sm font-semibold sm:text-base">
            AI Dev Cost Optimizer
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild size="sm">
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </header>

      <section className="hero-bg">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="mb-4 inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
            Estimativa antes da execução
          </p>
          <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-6xl">
            Evite surpresas: estime o <span className="text-gradient">consumo de créditos</span>{" "}
            antes de rodar seu prompt
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            O AI Dev Cost Optimizer analisa o seu prompt, pontua a complexidade em seis dimensões e
            devolve um intervalo estimado com nível de confiança, além de recomendações e uma versão
            otimizada. Não prevemos o consumo exato, mostramos a faixa de consumo mais aproximada.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                <Sparkles className="size-4" /> Começar grátis
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Já tenho conta</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Plano Free com 5 análises por mês. Sem cartão de crédito.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="surface">
              <CardContent className="pt-6">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <Icon className="size-4" />
                </span>
                <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <p className="mx-auto max-w-6xl px-4 text-xs text-muted-foreground sm:px-6">
          As estimativas são probabilísticas e informativas. O consumo real varia conforme o estado
          do projeto, o modelo utilizado e iterações imprevistas.
        </p>
      </footer>
    </div>
  );
}
