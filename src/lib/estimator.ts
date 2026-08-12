/**
 * Motor de estimativa probabilística, agnóstico de plataforma.
 * Novas plataformas podem ser adicionadas registrando um novo perfil em PLATFORM_PROFILES.
 */

export type PlatformId =
  | "lovable"
  | "cursor"
  | "claude-code"
  | "copilot"
  | "codex"
  | "other";

export const PLATFORMS: { id: PlatformId; label: string; enabled: boolean }[] = [
  { id: "lovable", label: "Lovable", enabled: true },
  { id: "cursor", label: "Cursor", enabled: true },
  { id: "claude-code", label: "Claude Code", enabled: true },
  { id: "copilot", label: "GitHub Copilot", enabled: true },
  { id: "codex", label: "OpenAI Codex", enabled: true },
  { id: "other", label: "Outra", enabled: true },
];

export type TaskTypeId =
  | "creation"
  | "change"
  | "bugfix"
  | "refactor"
  | "database"
  | "frontend"
  | "backend"
  | "integration"
  | "authentication"
  | "dashboard"
  | "other";

export const TASK_TYPES: { id: TaskTypeId; label: string }[] = [
  { id: "creation", label: "Criação" },
  { id: "change", label: "Alteração" },
  { id: "bugfix", label: "Correção de bug" },
  { id: "refactor", label: "Refatoração" },
  { id: "database", label: "Banco de dados" },
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "integration", label: "Integração" },
  { id: "authentication", label: "Autenticação" },
  { id: "dashboard", label: "Dashboard" },
  { id: "other", label: "Outro" },
];

/** Multiplicador de esforço por tipo de tarefa + viés por dimensão. */
const TASK_PROFILES: Record<TaskTypeId, { effort: number; bias: Partial<Record<Dimension, number>> }> = {
  creation: { effort: 1.15, bias: { frontend: 8, backend: 6, database: 6 } },
  change: { effort: 0.85, bias: {} },
  bugfix: { effort: 0.7, bias: { logic: 8 } },
  refactor: { effort: 0.9, bias: { logic: 10, backend: 6 } },
  database: { effort: 1, bias: { database: 20 } },
  frontend: { effort: 0.95, bias: { frontend: 20 } },
  backend: { effort: 1.05, bias: { backend: 20 } },
  integration: { effort: 1.2, bias: { integration: 22, backend: 8 } },
  authentication: { effort: 1.05, bias: { authentication: 22, database: 6 } },
  dashboard: { effort: 1.1, bias: { frontend: 16, database: 8, logic: 8 } },
  other: { effort: 1, bias: {} },
};

export type PlatformProfile = {
  baseCredits: number;
  creditsPerComplexityPoint: number;
  minFactor: number;
  maxFactor: number;
};

export const PLATFORM_PROFILES: Record<PlatformId, PlatformProfile> = {
  lovable: { baseCredits: 1, creditsPerComplexityPoint: 0.28, minFactor: 0.6, maxFactor: 1.9 },
  cursor: { baseCredits: 0.5, creditsPerComplexityPoint: 0.2, minFactor: 0.6, maxFactor: 2 },
  "claude-code": { baseCredits: 0.8, creditsPerComplexityPoint: 0.25, minFactor: 0.6, maxFactor: 2 },
  copilot: { baseCredits: 0.4, creditsPerComplexityPoint: 0.15, minFactor: 0.6, maxFactor: 2.1 },
  codex: { baseCredits: 0.6, creditsPerComplexityPoint: 0.22, minFactor: 0.6, maxFactor: 2 },
  other: { baseCredits: 0.7, creditsPerComplexityPoint: 0.24, minFactor: 0.6, maxFactor: 2 },
};

export type Dimension =
  | "frontend"
  | "backend"
  | "database"
  | "authentication"
  | "integration"
  | "logic";

export const DIMENSION_LABELS: Record<Dimension, string> = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Banco",
  authentication: "Autenticação",
  integration: "Integrações",
  logic: "Lógica",
};

/**
 * Biblioteca de sinais. Cada sinal é detectado por padrões (regex), com peso
 * próprio — a pontuação NÃO depende do tamanho do texto nem de uma única palavra.
 */
type Signal = {
  key: string;
  label: string;
  dimension: Dimension;
  weight: number;
  patterns: RegExp[];
};

const S = (
  key: string,
  label: string,
  dimension: Dimension,
  weight: number,
  ...patterns: RegExp[]
): Signal => ({ key, label, dimension, weight, patterns });

export const SIGNALS: Signal[] = [
  // Frontend
  S("screens", "Telas e páginas", "frontend", 12, /\b(tela|telas|p[áa]gina|p[áa]ginas|page|screen)\b/),
  S("components", "Componentes de UI", "frontend", 8, /\b(componente|componentes|component)\b/),
  S("responsive", "Responsividade", "frontend", 8, /\b(responsiv\w*|mobile|tablet|smartphone)\b/),
  S("forms", "Formulários", "frontend", 8, /\b(formul[áa]rio\w*|form|campos?)\b/),
  S("dashboard", "Dashboard", "frontend", 12, /\b(dashboard|painel|kpi|m[ée]tricas?)\b/),
  S("charts", "Gráficos", "frontend", 10, /\b(gr[áa]fico\w*|chart\w*|recharts)\b/),
  S("filters", "Filtros e busca", "frontend", 6, /\b(filtro\w*|filtrar|busca|pesquisa|ordena\w*)\b/),
  S("design", "Design system / tema", "frontend", 6, /\b(design system|tema|dark mode|estilo|layout|anima[çc]\w*)\b/),
  // Backend
  S("api", "APIs / endpoints", "backend", 12, /\b(api|endpoint\w*|rest|graphql)\b/),
  S("edge", "Edge Functions / serverless", "backend", 12, /\b(edge function\w*|serverless|fun[çc][ãa]o de servidor|server function)\b/),
  S("webhooks", "Webhooks", "backend", 10, /\b(webhook\w*|callback)\b/),
  S("jobs", "Jobs / filas / cron", "backend", 10, /\b(cron|agendad\w*|fila|queue|job|background)\b/),
  S("uploads", "Uploads / storage", "backend", 10, /\b(upload\w*|storage|arquivo\w*|imagem|imagens|pdf)\b/),
  S("email", "E-mail transacional", "backend", 8, /\b(e-?mail|smtp|resend|newsletter)\b/),
  S("notifications", "Notificações", "backend", 8, /\b(notifica[çc]\w*|push|alerta\w*)\b/),
  S("whatsapp", "WhatsApp / mensageria", "backend", 10, /\b(whatsapp|twilio|sms|telegram)\b/),
  // Database
  S("db", "Banco de dados", "database", 12, /\b(banco de dados|database|postgres|sql|supabase)\b/),
  S("tables", "Tabelas / entidades", "database", 10, /\b(tabela\w*|entidade\w*|modelo\w*|schema)\b/),
  S("crud", "Operações CRUD", "database", 10, /\b(crud|criar|cadastrar|editar|atualizar|excluir|deletar|listar)\b/),
  S("migrations", "Migrations", "database", 8, /\b(migration\w*|migra[çc][ãa]o)\b/),
  S("relations", "Relacionamentos", "database", 8, /\b(relacionament\w*|chave estrangeira|foreign key|join)\b/),
  S("reports", "Relatórios / histórico", "database", 6, /\b(relat[óo]rio\w*|hist[óo]rico|exporta[çc]\w*|csv|excel)\b/),
  // Auth
  S("auth", "Autenticação", "authentication", 14, /\b(autentica[çc]\w*|auth|login|logout|cadastro|signup|senha)\b/),
  S("oauth", "Login social / SSO", "authentication", 10, /\b(oauth|google|github|sso|magic link)\b/),
  S("roles", "Autorização e papéis", "authentication", 12, /\b(permiss\w*|autoriza[çc]\w*|role\w*|pap[ée]l|pap[ée]is|admin|perfil de acesso)\b/),
  S("rls", "Row Level Security", "authentication", 12, /\b(rls|row level security|pol[íi]tica\w* de acesso)\b/),
  // Integrações
  S("external", "APIs externas", "integration", 12, /\b(api externa|integra[çc]\w*|integrar|terceiros|sdk)\b/),
  S("payments", "Pagamentos", "integration", 16, /\b(pagament\w*|stripe|paddle|checkout|assinatura\w*|cobran[çc]a)\b/),
  S("ai", "Inteligência artificial", "integration", 14, /\b(intelig[êe]ncia artificial|\bia\b|\bai\b|llm|openai|gpt|claude|embedding\w*)\b/),
  S("maps", "Mapas / geolocalização", "integration", 8, /\b(mapa\w*|maps|geolocaliza[çc]\w*|leaflet)\b/),
  S("importexport", "Importação / exportação", "integration", 6, /\b(importar|exportar|sincroniza[çc]\w*)\b/),
  // Lógica
  S("rules", "Regras de negócio", "logic", 12, /\b(regra\w* de neg[óo]cio|valida[çc]\w*|pol[íi]tica\w*|limite\w*|plano\w*)\b/),
  S("calc", "Cálculos e algoritmos", "logic", 10, /\b(c[áa]lculo\w*|calcular|algoritmo\w*|score|estimativa\w*|f[óo]rmula\w*)\b/),
  S("workflow", "Fluxos e automações", "logic", 10, /\b(fluxo\w*|workflow|automatiz\w*|etapa\w*|pipeline)\b/),
  S("refactor", "Refatoração", "logic", 8, /\b(refator\w*|reorganiz\w*|limpar c[óo]digo|melhorar estrutura)\b/),
  S("bugfix", "Correções", "logic", 6, /\b(bug|erro\w*|corrigir|corre[çc][ãa]o|falha)\b/),
  S("deps", "Dependências entre funcionalidades", "logic", 10, /\b(depende\w*|pr[ée]-requisito|ap[óo]s|somente se|integrado com)\b/),
];

const ENTITY_HINTS = [
  "tabela","tabelas","entidade","entidades","cadastro","cadastros","modelo","modelos","table","tables",
];
const OPERATION_HINTS = [
  "criar","editar","excluir","deletar","atualizar","listar","buscar","filtrar","exportar","importar",
  "enviar","gerar","calcular","create","update","delete","list",
];

export type EstimationFactor = { label: string; impact: "low" | "medium" | "high"; detail: string };

export type ComplexityLevel = "Muito baixa" | "Baixa" | "Média" | "Alta" | "Muito alta";

export function complexityLevelOf(score: number): ComplexityLevel {
  if (score <= 25) return "Muito baixa";
  if (score <= 45) return "Baixa";
  if (score <= 65) return "Média";
  if (score <= 80) return "Alta";
  return "Muito alta";
}

export type EstimationResult = {
  platform: PlatformId;
  taskType: TaskTypeId;
  complexityScore: number;
  complexityLevel: ComplexityLevel;
  confidenceScore: number;
  confidenceLevel: "Baixa" | "Média" | "Alta";
  estimatedMin: number;
  estimatedExpected: number;
  estimatedMax: number;
  scores: Record<Dimension, number>;
  detectedSignals: { key: string; label: string; dimension: Dimension }[];
  estimatedEntities: number;
  estimatedOperations: number;
  requirementCount: number;
  actionCount: number;
  factors: EstimationFactor[];
  recommendations: string[];
  steps: {
    title: string;
    description: string;
    estimated: number;
    min?: number;
    max?: number;
    prompt?: string;
  }[];
  optimizedPrompt: string;
  estimatedOptimized: number;
  reductionPercentage: number;
  wordCount: number;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

function countMatches(text: string, words: string[]): number {
  let hits = 0;
  for (const w of words) if (text.includes(norm(w))) hits += 1;
  return hits;
}

export function analyzePromptText(
  raw: string,
  platform: PlatformId = "lovable",
  overrides?: Partial<PlatformProfile>,
  taskType: TaskTypeId = "other",
): EstimationResult {
  const text = norm(raw);
  const words = raw.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const profile = { ...(PLATFORM_PROFILES[platform] ?? PLATFORM_PROFILES.lovable), ...overrides };
  const task = TASK_PROFILES[taskType] ?? TASK_PROFILES.other;

  // 1. Detecção de sinais ponderados (não depende de contagem de caracteres).
  const detectedSignals: EstimationResult["detectedSignals"] = [];
  const rawScores: Record<Dimension, number> = {
    frontend: 0, backend: 0, database: 0, authentication: 0, integration: 0, logic: 0,
  };
  for (const s of SIGNALS) {
    const matched = s.patterns.some((p) => p.test(text));
    if (!matched) continue;
    detectedSignals.push({ key: s.key, label: s.label, dimension: s.dimension });
    rawScores[s.dimension] += s.weight;
  }

  const bulletCount = (raw.match(/^\s*(?:[-*•]|\d+[.)])\s+/gm) ?? []).length;
  const sentenceCount = raw.split(/[.;\n]+/).map((s) => s.trim()).filter((s) => s.length > 3).length;
  const requirementCount = Math.max(1, bulletCount || sentenceCount);
  const entityHits = countMatches(text, ENTITY_HINTS);
  const opHits = countMatches(text, OPERATION_HINTS);
  const actionCount = Math.max(1, Math.round(opHits * 1.3 + bulletCount * 0.6));

  // 2. Densidade de requisitos amplifica os sinais detectados.
  const breadth = Math.min(1.4, 1 + requirementCount / 25);

  const scores = {} as Record<Dimension, number>;
  for (const dim of Object.keys(rawScores) as Dimension[]) {
    const biased = rawScores[dim] * breadth + (task.bias[dim] ?? 0);
    scores[dim] = Math.max(0, Math.min(100, Math.round(biased)));
  }

  const estimatedEntities = Math.max(
    1,
    Math.round(entityHits * 1.5 + scores.database / 22 + requirementCount / 4),
  );
  const estimatedOperations = Math.max(1, Math.round(actionCount + scores.database / 30));

  const weighted =
    scores.frontend * 0.18 +
    scores.backend * 0.2 +
    scores.database * 0.2 +
    scores.authentication * 0.14 +
    scores.integration * 0.16 +
    scores.logic * 0.12;

  const signalBreadth = Math.min(22, detectedSignals.length * 1.6);
  const requirementFactor = Math.min(18, requirementCount * 1.4);
  const sizeFactor = Math.min(12, (wordCount / 400) * 12); // tamanho tem peso pequeno
  const complexityScore = Math.max(
    1,
    Math.min(
      100,
      Math.round(
        (weighted * 0.62 + signalBreadth + requirementFactor + sizeFactor + estimatedEntities * 1.1) *
          task.effort,
      ),
    ),
  );

  const complexityLevel = complexityLevelOf(complexityScore);

  const expected = (profile.baseCredits + complexityScore * profile.creditsPerComplexityPoint) * task.effort;

  const vagueTerms = ["etc","entre outros","algo como","tipo","similar","completo","tudo","robusto","moderno"];
  const vagueness = countMatches(text, vagueTerms);
  const hasStructure = bulletCount >= 3;
  let confidence = 68 + (hasStructure ? 10 : 0) + (wordCount > 60 ? 8 : -10) - vagueness * 5;
  if (wordCount < 15) confidence -= 12;
  if (complexityScore > 80) confidence -= 8;
  if (detectedSignals.length >= 6) confidence += 4;
  const confidenceScore = Math.max(25, Math.min(92, Math.round(confidence)));
  const confidenceLevel = confidenceScore >= 75 ? "Alta" : confidenceScore >= 55 ? "Média" : "Baixa";

  const spread = 1 + (100 - confidenceScore) / 180;
  const estimatedMin = round(Math.max(0.5, expected * profile.minFactor));
  const estimatedExpected = round(expected);
  const estimatedMax = round(expected * profile.maxFactor * spread);

  const factors: EstimationFactor[] = [];
  const push = (cond: boolean, f: EstimationFactor) => cond && factors.push(f);
  const level = (v: number): EstimationFactor["impact"] => (v >= 60 ? "high" : v >= 30 ? "medium" : "low");
  const labelsOf = (dim: Dimension) =>
    detectedSignals.filter((s) => s.dimension === dim).map((s) => s.label).join(", ");
  for (const dim of Object.keys(scores) as Dimension[]) {
    push(scores[dim] > 0, {
      label: DIMENSION_LABELS[dim],
      impact: level(scores[dim]),
      detail: labelsOf(dim) || "Sinais indiretos identificados no prompt.",
    });
  }
  push(wordCount > 250, { label: "Prompt extenso", impact: "high", detail: `${wordCount} palavras: muitos requisitos em uma única execução.` });
  push(requirementCount > 12, { label: "Muitos requisitos", impact: "high", detail: `${requirementCount} requisitos identificados no mesmo pedido.` });
  push(vagueness > 0, { label: "Requisitos ambíguos", impact: vagueness > 2 ? "high" : "medium", detail: "Termos genéricos aumentam retrabalho e ampliam o intervalo." });
  if (factors.length === 0)
    factors.push({ label: "Escopo enxuto", impact: "low", detail: "Poucos sinais de complexidade identificados." });

  const steps: EstimationResult["steps"] = [];
  const addStep = (
    title: string,
    description: string,
    weight: number,
    dims: Dimension[],
  ) => {
    const est = round(Math.max(0.5, expected * weight));
    steps.push({
      title,
      description,
      estimated: est,
      min: round(Math.max(0.3, est * profile.minFactor)),
      max: round(est * Math.min(1.9, profile.maxFactor) * spread),
      prompt: buildStepPrompt(raw, title, description, dims),
    });
  };
  if (scores.database > 20 || scores.authentication > 20)
    addStep(
      "Etapa 1 — Estrutura do banco de dados e acesso",
      "Criar tabelas, relacionamentos, políticas de segurança e autenticação.",
      0.3,
      ["database", "authentication"],
    );
  if (scores.frontend > 20)
    addStep(
      "Etapa 2 — CRUD e telas",
      "Design system, telas essenciais e operações de criar, editar, listar e excluir com dados reais.",
      0.3,
      ["frontend"],
    );
  if (scores.logic > 20 || scores.backend > 20)
    addStep(
      "Etapa 3 — Regras de negócio e lógica de servidor",
      "Cálculos, validações e processamento protegido no servidor.",
      0.25,
      ["logic", "backend"],
    );
  if (scores.integration > 20)
    addStep(
      "Etapa 4 — Integrações externas",
      "Conectar serviços de terceiros, tratar erros e proteger chaves.",
      0.2,
      ["integration"],
    );
  if (steps.length === 0)
    addStep("Etapa única", "O escopo cabe em uma única execução.", 1, [
      "frontend",
      "backend",
      "database",
      "authentication",
      "integration",
      "logic",
    ]);

  const recommendations: string[] = [];
  if (requirementCount > 6 || complexityScore > 55)
    recommendations.push(
      `Este prompt possui muitas responsabilidades em uma única solicitação (${requirementCount} requisitos identificados).`,
    );
  if (steps.length > 1) recommendations.push(`Recomendamos dividir em ${steps.length} etapas.`);
  if ((scores.database > 20 || scores.authentication > 20) && scores.frontend > 20)
    recommendations.push(
      "Banco de dados e autenticação devem ser implementados antes das telas e do dashboard.",
    );
  if (scores.integration > 20)
    recommendations.push("Separar integrações externas das funcionalidades principais.");
  if (wordCount > 200 || requirementCount > 10)
    recommendations.push("Divida o prompt em pedidos menores e executáveis de forma independente.");
  if (vagueness > 0)
    recommendations.push(
      'Substitua termos genéricos ("completo", "moderno", "etc.") por requisitos explícitos.',
    );
  if (scores.database > 40)
    recommendations.push("Descreva as tabelas e campos exatos para evitar remodelagens de banco.");
  if (scores.frontend > 40)
    recommendations.push("Defina o design system antes de pedir várias telas de uma vez.");
  if (scores.authentication > 40)
    recommendations.push("Trate autenticação, papéis e políticas de acesso em uma etapa dedicada.");
  if (!hasStructure)
    recommendations.push("Estruture o pedido em lista numerada: um requisito por linha.");
  if (recommendations.length === 0)
    recommendations.push("O prompt já está enxuto; mantenha um objetivo por execução.");

  const optimizedPrompt = buildOptimizedPrompt(raw, scores, estimatedEntities, taskType, platform, steps);
  const optimizedReduction = Math.min(
    45,
    Math.round((wordCount > 200 ? 18 : 8) + vagueness * 4 + (hasStructure ? 0 : 8) + (requirementCount > 12 ? 6 : 0)),
  );
  const estimatedOptimized = round(expected * (1 - optimizedReduction / 100));

  return {
    platform,
    taskType,
    complexityScore,
    complexityLevel,
    confidenceScore,
    confidenceLevel,
    estimatedMin,
    estimatedExpected,
    estimatedMax,
    scores,
    detectedSignals,
    estimatedEntities,
    estimatedOperations,
    requirementCount,
    actionCount,
    factors,
    recommendations,
    steps,
    optimizedPrompt,
    estimatedOptimized,
    reductionPercentage: optimizedReduction,
    wordCount,
  };
}

const DIMENSION_SECTIONS: { dim: Dimension; title: string }[] = [
  { dim: "frontend", title: "Interface (frontend)" },
  { dim: "backend", title: "Servidor (backend)" },
  { dim: "database", title: "Dados e persistência" },
  { dim: "authentication", title: "Autenticação e permissões" },
  { dim: "integration", title: "Integrações externas" },
  { dim: "logic", title: "Regras de negócio e lógica" },
];

/** Classifica uma linha do prompt original na dimensão mais provável. */
function classifyLine(line: string): Dimension | null {
  const t = norm(line);
  const totals: Record<Dimension, number> = {
    frontend: 0, backend: 0, database: 0, authentication: 0, integration: 0, logic: 0,
  };
  for (const s of SIGNALS) {
    if (s.patterns.some((p) => p.test(t))) totals[s.dimension] += s.weight;
  }
  let best: Dimension | null = null;
  let bestScore = 0;
  for (const dim of Object.keys(totals) as Dimension[]) {
    if (totals[dim] > bestScore) {
      bestScore = totals[dim];
      best = dim;
    }
  }
  return best;
}

/**
 * Gera uma versão OTIMIZADA do prompt: mantém 100% do conteúdo escrito pelo
 * usuário (nada é cortado ou resumido), apenas reescreve a estrutura —
 * requisitos numerados, agrupados por área, com escopo técnico, ordem de
 * execução, restrições e critérios de aceite.
 */
function buildOptimizedPrompt(
  raw: string,
  scores: Record<Dimension, number>,
  entities: number,
  taskType: TaskTypeId,
  platform: PlatformId,
  steps: { title: string; description: string }[],
): string {
  const source = raw.trim();
  if (!source) return "";

  // 1. Quebra em unidades de requisito preservando o texto original.
  const byLine = source
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[-*•–]|\d+[.)])\s+/, "").trim())
    .filter((l) => l.length > 0);

  const units: string[] = [];
  for (const line of byLine) {
    if (line.length > 220) {
      const parts = line
        .split(/(?<=[.;])\s+/)
        .map((p) => p.trim())
        .filter(Boolean);
      units.push(...(parts.length > 1 ? parts : [line]));
    } else {
      units.push(line);
    }
  }

  const titleLine = units[0] ?? "";
  const isHeading = units.length > 1 && titleLine.length < 120 && !/[.;:]$/.test(titleLine);
  const objective = titleLine.replace(/\s+/g, " ").trim();

  const body = units.length > 1 && isHeading ? units.slice(1) : units;

  // 2. Agrupa por área, mantendo a ordem original dentro de cada grupo.
  const groups = new Map<Dimension | "general", string[]>();
  for (const u of body) {
    const dim = classifyLine(u) ?? "general";
    const list = groups.get(dim) ?? [];
    list.push(u);
    groups.set(dim, list);
  }

  const cap = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
  let counter = 0;
  const numbered = (items: string[]) =>
    items.map((i) => `${(counter += 1)}. ${cap(i.replace(/\s+$/, ""))}`);

  const sections: string[] = [];
  const general = groups.get("general");
  if (general?.length) {
    sections.push("Requisitos gerais:", ...numbered(general), "");
  }
  for (const { dim, title } of DIMENSION_SECTIONS) {
    const items = groups.get(dim);
    if (items?.length) sections.push(`${title}:`, ...numbered(items), "");
  }

  const scope: string[] = [];
  if (scores.database > 20)
    scope.push(`modelagem de dados com aproximadamente ${entities} entidades e regras de acesso por usuário`);
  if (scores.authentication > 20) scope.push("autenticação e autorização com políticas de acesso por linha");
  if (scores.frontend > 20) scope.push("interface responsiva reutilizando o design system existente");
  if (scores.backend > 20) scope.push("lógica sensível executada apenas no servidor");
  if (scores.integration > 20) scope.push("integrações externas com tratamento explícito de erro e chaves fora do frontend");
  if (scores.logic > 20) scope.push("regras de negócio centralizadas e testáveis");

  const taskLabel = TASK_TYPES.find((t) => t.id === taskType)?.label;
  const platformLabel = PLATFORMS.find((p) => p.id === platform)?.label;

  const header: string[] = [
    "# Objetivo",
    objective || "Implementar exatamente os requisitos listados abaixo.",
    "",
  ];
  if (taskLabel || platformLabel) {
    header.push(
      `Contexto: ${[platformLabel && `plataforma ${platformLabel}`, taskLabel && `tipo de tarefa ${taskLabel.toLowerCase()}`]
        .filter(Boolean)
        .join(" · ")}.`,
      "",
    );
  }

  const order = steps.length
    ? ["# Ordem de execução", ...steps.map((s, i) => `${i + 1}. ${s.title.replace(/^\d+\.\s*/, "")} — ${s.description}`), ""]
    : [];

  return [
    ...header,
    "# Requisitos (implementar todos, sem adicionar nada além)",
    ...sections,
    scope.length ? "# Escopo técnico" : "",
    ...(scope.length ? scope.map((s) => `- ${cap(s)}.`) : []),
    scope.length ? "" : "",
    ...order,
    "# Restrições",
    "- Implemente somente os requisitos numerados acima; não crie funcionalidades extras.",
    "- Reutilize componentes, tokens de estilo e estruturas já existentes no projeto.",
    "- Prefira a menor mudança que atenda a cada requisito.",
    "- Nunca exponha chaves ou lógica sensível no frontend.",
    "",
    "# Critérios de aceite",
    `- Todos os ${counter} requisitos acima verificáveis na aplicação em execução.`,
    "- Sem erros de build, de tipos ou no console.",
    "- Ao final, liste o que ficou fora do escopo para a próxima etapa.",
  ]
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();
}

