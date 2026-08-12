/**
 * Motor de estimativa probabilística, agnóstico de plataforma.
 * Novas plataformas (Cursor, Claude Code, Copilot, Codex...) podem ser
 * adicionadas registrando um novo perfil em PLATFORM_PROFILES.
 */

export type PlatformId = "lovable" | "cursor" | "claude-code" | "copilot" | "codex";

export const PLATFORMS: { id: PlatformId; label: string; enabled: boolean }[] = [
  { id: "lovable", label: "Lovable", enabled: true },
  { id: "cursor", label: "Cursor", enabled: false },
  { id: "claude-code", label: "Claude Code", enabled: false },
  { id: "copilot", label: "GitHub Copilot", enabled: false },
  { id: "codex", label: "OpenAI Codex", enabled: false },
];

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
};

export type Dimension =
  | "frontend"
  | "backend"
  | "database"
  | "authentication"
  | "integration"
  | "logic";

const KEYWORDS: Record<Dimension, string[]> = {
  frontend: [
    "tela","telas","página","paginas","páginas","page","dashboard","layout","responsiv","componente",
    "ui","interface","formulário","formulario","form","tabela","gráfico","grafico","chart","modal",
    "animação","animacao","tema","dark mode","landing",
  ],
  backend: [
    "backend","servidor","server","api","endpoint","edge function","função serverless","webhook",
    "cron","fila","queue","processamento","job","upload","storage","arquivo","email","e-mail",
  ],
  database: [
    "banco de dados","database","tabela","tabelas","schema","postgres","sql","migration","relacionamento",
    "crud","persistir","persistência","persistencia","histórico","historico","registro","rls",
  ],
  authentication: [
    "autenticação","autenticacao","auth","login","logout","cadastro","signup","senha","password",
    "oauth","google","sso","permissão","permissao","perfil","role","papel","admin",
  ],
  integration: [
    "integração","integracao","integrar","stripe","pagamento","payment","api externa","openai","ia",
    "ai","llm","whatsapp","twilio","slack","webhook","importar","exportar","pdf","csv","mapa","maps",
  ],
  logic: [
    "regra de negócio","regra de negocio","cálculo","calculo","algoritmo","score","estimativa","otimiz",
    "validação","validacao","workflow","fluxo","automatiz","recomendação","recomendacao","relatório","relatorio",
  ],
};

const ENTITY_HINTS = [
  "tabela","tabelas","entidade","entidades","cadastro","cadastros","modelo","modelos","table","tables",
];
const OPERATION_HINTS = [
  "criar","editar","excluir","deletar","atualizar","listar","buscar","filtrar","exportar","importar",
  "enviar","gerar","calcular","create","update","delete","list",
];

export type EstimationFactor = { label: string; impact: "low" | "medium" | "high"; detail: string };

export type EstimationResult = {
  platform: PlatformId;
  complexityScore: number;
  complexityLevel: "Baixa" | "Moderada" | "Alta" | "Muito alta";
  confidenceScore: number;
  confidenceLevel: "Baixa" | "Média" | "Alta";
  estimatedMin: number;
  estimatedExpected: number;
  estimatedMax: number;
  scores: Record<Dimension, number>;
  estimatedEntities: number;
  estimatedOperations: number;
  factors: EstimationFactor[];
  recommendations: string[];
  steps: { title: string; description: string; estimated: number }[];
  optimizedPrompt: string;
  estimatedOptimized: number;
  reductionPercentage: number;
  wordCount: number;
};

const norm = (s: string) => s.toLowerCase();
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

function countMatches(text: string, words: string[]): number {
  let hits = 0;
  for (const w of words) if (text.includes(w)) hits += 1;
  return hits;
}

function dimensionScore(text: string, dim: Dimension): number {
  const hits = countMatches(text, KEYWORDS[dim]);
  return Math.min(100, Math.round((hits / 6) * 100));
}

export function analyzePromptText(
  raw: string,
  platform: PlatformId = "lovable",
  overrides?: Partial<PlatformProfile>,
): EstimationResult {
  const text = norm(raw);
  const words = raw.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const profile = { ...PLATFORM_PROFILES[platform], ...overrides };

  const scores = {
    frontend: dimensionScore(text, "frontend"),
    backend: dimensionScore(text, "backend"),
    database: dimensionScore(text, "database"),
    authentication: dimensionScore(text, "authentication"),
    integration: dimensionScore(text, "integration"),
    logic: dimensionScore(text, "logic"),
  } as Record<Dimension, number>;

  const bulletCount = (raw.match(/^\s*(?:[-*•]|\d+[.)])\s+/gm) ?? []).length;
  const entityHits = countMatches(text, ENTITY_HINTS);
  const opHits = countMatches(text, OPERATION_HINTS);

  const estimatedEntities = Math.max(
    1,
    Math.round(entityHits * 1.5 + scores.database / 25 + bulletCount / 4),
  );
  const estimatedOperations = Math.max(1, Math.round(opHits * 1.2 + bulletCount / 2 + 1));

  const weighted =
    scores.frontend * 0.18 +
    scores.backend * 0.2 +
    scores.database * 0.2 +
    scores.authentication * 0.14 +
    scores.integration * 0.16 +
    scores.logic * 0.12;

  const sizeFactor = Math.min(35, (wordCount / 260) * 35);
  const breadthFactor = Math.min(20, bulletCount * 1.6);
  const complexityScore = Math.min(
    100,
    Math.round(weighted * 0.6 + sizeFactor + breadthFactor + estimatedEntities * 1.2),
  );

  const complexityLevel =
    complexityScore < 25
      ? "Baixa"
      : complexityScore < 50
        ? "Moderada"
        : complexityScore < 75
          ? "Alta"
          : "Muito alta";

  const expected = profile.baseCredits + complexityScore * profile.creditsPerComplexityPoint;

  // Ambiguidade reduz confiança e amplia o intervalo.
  const vagueTerms = ["etc","entre outros","algo como","tipo","similar","completo","tudo","robusto","moderno"];
  const vagueness = countMatches(text, vagueTerms);
  const hasStructure = bulletCount >= 3;
  let confidence = 68 + (hasStructure ? 10 : 0) + (wordCount > 60 ? 8 : -10) - vagueness * 5;
  if (wordCount < 15) confidence -= 12;
  if (complexityScore > 80) confidence -= 8;
  const confidenceScore = Math.max(25, Math.min(92, Math.round(confidence)));
  const confidenceLevel = confidenceScore >= 75 ? "Alta" : confidenceScore >= 55 ? "Média" : "Baixa";

  const spread = 1 + (100 - confidenceScore) / 180;
  const estimatedMin = round(Math.max(0.5, expected * profile.minFactor));
  const estimatedExpected = round(expected);
  const estimatedMax = round(expected * profile.maxFactor * spread);

  const factors: EstimationFactor[] = [];
  const push = (cond: boolean, f: EstimationFactor) => cond && factors.push(f);
  const level = (v: number): EstimationFactor["impact"] => (v >= 60 ? "high" : v >= 30 ? "medium" : "low");
  push(scores.frontend > 0, { label: "Escopo de interface", impact: level(scores.frontend), detail: "Telas, componentes e responsividade citados no prompt." });
  push(scores.backend > 0, { label: "Lógica de servidor", impact: level(scores.backend), detail: "Endpoints, jobs ou processamento fora do navegador." });
  push(scores.database > 0, { label: "Modelagem de dados", impact: level(scores.database), detail: `Aprox. ${estimatedEntities} entidade(s) e políticas de acesso.` });
  push(scores.authentication > 0, { label: "Autenticação e permissões", impact: level(scores.authentication), detail: "Cadastro, login, perfis e regras de acesso." });
  push(scores.integration > 0, { label: "Integrações externas", impact: level(scores.integration), detail: "APIs de terceiros aumentam idas e voltas de implementação." });
  push(scores.logic > 0, { label: "Regras de negócio", impact: level(scores.logic), detail: "Cálculos e fluxos que exigem iteração e ajustes." });
  push(wordCount > 250, { label: "Prompt extenso", impact: "high", detail: `${wordCount} palavras: muitos requisitos em uma única execução.` });
  push(vagueness > 0, { label: "Requisitos ambíguos", impact: vagueness > 2 ? "high" : "medium", detail: "Termos genéricos aumentam retrabalho e ampliam o intervalo." });
  if (factors.length === 0)
    factors.push({ label: "Escopo enxuto", impact: "low", detail: "Poucos sinais de complexidade identificados." });

  const recommendations: string[] = [];
  if (wordCount > 200) recommendations.push("Divida o prompt em etapas menores e executáveis de forma independente.");
  if (vagueness > 0) recommendations.push("Substitua termos genéricos (\"completo\", \"moderno\", \"etc.\") por requisitos explícitos.");
  if (scores.database > 40) recommendations.push("Descreva as tabelas e campos exatos para evitar remodelagens de banco.");
  if (scores.integration > 40) recommendations.push("Implemente integrações externas em um prompt separado, após o núcleo funcionar.");
  if (scores.frontend > 40) recommendations.push("Defina o design system antes de pedir várias telas de uma vez.");
  if (!hasStructure) recommendations.push("Estruture o pedido em lista numerada: um requisito por linha.");
  if (recommendations.length === 0) recommendations.push("O prompt já está enxuto; mantenha um objetivo por execução.");

  const steps: { title: string; description: string; estimated: number }[] = [];
  const addStep = (title: string, description: string, weight: number) =>
    steps.push({ title, description, estimated: round(Math.max(0.5, expected * weight)) });
  if (scores.database > 20 || scores.authentication > 20)
    addStep("1. Fundação de dados e acesso", "Criar tabelas, políticas de segurança e autenticação.", 0.3);
  if (scores.frontend > 20) addStep("2. Interface principal", "Design system e telas essenciais com dados reais.", 0.3);
  if (scores.logic > 20 || scores.backend > 20)
    addStep("3. Regras e lógica de servidor", "Cálculos, validações e processamento protegido.", 0.25);
  if (scores.integration > 20) addStep("4. Integrações externas", "Conectar serviços de terceiros e tratar erros.", 0.2);
  if (steps.length === 0) addStep("1. Execução única", "O escopo cabe em uma única execução.", 1);

  const optimizedPrompt = buildOptimizedPrompt(raw, scores, estimatedEntities);
  const optimizedReduction = Math.min(
    45,
    Math.round((wordCount > 200 ? 18 : 8) + vagueness * 4 + (hasStructure ? 0 : 8)),
  );
  const estimatedOptimized = round(expected * (1 - optimizedReduction / 100));

  return {
    platform,
    complexityScore,
    complexityLevel,
    confidenceScore,
    confidenceLevel,
    estimatedMin,
    estimatedExpected,
    estimatedMax,
    scores,
    estimatedEntities,
    estimatedOperations,
    factors,
    recommendations,
    steps,
    optimizedPrompt,
    estimatedOptimized,
    reductionPercentage: optimizedReduction,
    wordCount,
  };
}

function buildOptimizedPrompt(raw: string, scores: Record<Dimension, number>, entities: number): string {
  const lines = raw
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter((l) => l.length > 2);

  const requirements = (lines.length > 1 ? lines : raw.split(/[.;]\s+/))
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((l, i) => `${i + 1}. ${l.charAt(0).toUpperCase()}${l.slice(1)}`);

  const scope: string[] = [];
  if (scores.database > 20) scope.push(`modelagem de dados (~${entities} entidades) com regras de acesso por usuário`);
  if (scores.authentication > 20) scope.push("autenticação por e-mail/senha");
  if (scores.frontend > 20) scope.push("interface responsiva usando o design system existente");
  if (scores.backend > 20) scope.push("lógica sensível apenas no servidor");
  if (scores.integration > 20) scope.push("integrações externas isoladas em uma etapa posterior");

  return [
    "Objetivo (uma frase): entregue apenas o escopo listado abaixo.",
    "",
    "Requisitos explícitos:",
    ...requirements,
    "",
    scope.length ? `Escopo técnico: ${scope.join("; ")}.` : "",
    "",
    "Restrições:",
    "- Não implemente funcionalidades não listadas acima.",
    "- Reutilize componentes e tokens de estilo já existentes.",
    "- Priorize a menor mudança que atenda ao requisito.",
    "- Ao final, liste o que ficou fora do escopo para a próxima etapa.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
