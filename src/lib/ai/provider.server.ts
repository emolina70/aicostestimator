/**
 * Camada de abstração do provedor de IA.
 *
 * O sistema nunca chama um fornecedor diretamente: todo o restante da aplicação
 * conversa com a interface `AIProvider`. Hoje o provedor padrão é heurístico
 * (determinístico, sem custo). Amanhã basta registrar outro provedor —
 * Lovable AI Gateway, OpenAI, Anthropic — sem alterar as telas nem o banco.
 *
 * Este arquivo é server-only (`*.server.ts`) e nunca vai para o navegador.
 */
import {
  analyzePromptText,
  type EstimationResult,
  type EstimatorWeights,
  type PlatformId,
  type PlatformProfile,
  type TaskTypeId,
} from "@/lib/estimator";

export type AnalyzeArgs = {
  content: string;
  platform: PlatformId;
  taskType: TaskTypeId;
  overrides?: Partial<PlatformProfile>;
  weights?: EstimatorWeights;
};

export type AIUsage = {
  provider: string;
  model: string;
  operation: "analyze" | "optimize" | "split" | "recommend";
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
};

export type AIProviderResult<T> = { value: T; usage: AIUsage };

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  analyzePrompt(args: AnalyzeArgs): Promise<AIProviderResult<EstimationResult>>;
  optimizePrompt(args: AnalyzeArgs): Promise<AIProviderResult<string>>;
  splitPrompt(args: AnalyzeArgs): Promise<AIProviderResult<EstimationResult["steps"]>>;
  generateRecommendation(args: AnalyzeArgs): Promise<AIProviderResult<string[]>>;
}

const noCost = (
  provider: string,
  model: string,
  operation: AIUsage["operation"],
  content: string,
): AIUsage => ({
  provider,
  model,
  operation,
  // Estimativa grosseira de tokens (~4 caracteres por token) para métricas de margem.
  inputTokens: Math.ceil(content.length / 4),
  outputTokens: 0,
  estimatedCost: 0,
});

/** Provedor padrão: motor heurístico local, sem chamadas externas e sem custo. */
export class HeuristicProvider implements AIProvider {
  readonly name = "heuristic";
  readonly model = "rules-v1";

  private run({ content, platform, taskType, overrides, weights }: AnalyzeArgs) {
    return analyzePromptText(content, platform, overrides, taskType, weights);
  }

  async analyzePrompt(args: AnalyzeArgs) {
    return { value: this.run(args), usage: noCost(this.name, this.model, "analyze", args.content) };
  }

  async optimizePrompt(args: AnalyzeArgs) {
    return {
      value: this.run(args).optimizedPrompt,
      usage: noCost(this.name, this.model, "optimize", args.content),
    };
  }

  async splitPrompt(args: AnalyzeArgs) {
    return { value: this.run(args).steps, usage: noCost(this.name, this.model, "split", args.content) };
  }

  async generateRecommendation(args: AnalyzeArgs) {
    return {
      value: this.run(args).recommendations,
      usage: noCost(this.name, this.model, "recommend", args.content),
    };
  }
}

/** Registro de provedores — novos fornecedores entram aqui. */
const REGISTRY: Record<string, () => AIProvider> = {
  heuristic: () => new HeuristicProvider(),
};

export function getAIProvider(): AIProvider {
  const key = process.env["AI_PROVIDER"] ?? "heuristic";
  return (REGISTRY[key] ?? REGISTRY["heuristic"]!)();
}

/** Registra o custo de cada chamada de IA feita pela própria aplicação. */
export async function logAIUsage(userId: string, usage: AIUsage) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: userId,
      provider: usage.provider,
      model: usage.model,
      operation: usage.operation,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      estimated_cost: usage.estimatedCost,
    });
  } catch {
    // O registro de custo nunca deve derrubar a análise do usuário.
  }
}

const OPTIMIZE_INSTRUCTIONS = `Você é um especialista em engenharia de prompts para ferramentas de desenvolvimento assistido por IA (Lovable, Cursor, Claude Code, GitHub Copilot, OpenAI Codex).

Sua tarefa: REESCREVER o prompt do usuário em uma versão OTIMIZADA, mantendo 100% dos requisitos e detalhes do texto original — NUNCA resumir, cortar ou omitir nada. Apenas reorganize e estruture o conteúdo para máxima clareza e menor consumo de créditos.

Devolva SOMENTE o prompt otimizado, em português, usando exatamente esta estrutura em markdown:

# Objetivo
<objetivo principal, em um ou dois parágrafos>

# Contexto
<contexto relevante presente no prompt original>

# Requisitos
<TODOS os requisitos do prompt original, numerados, agrupados por área quando aplicável: Interface, Servidor, Dados, Autenticação, Integrações, Regras de negócio>

# Escopo Técnico
<tecnologias, entidades e operações envolvidas, inferidas do prompt>

# Ordem de Execução
<passos numerados sugeridos>

# Restrições
<restrições e limitações explícitas ou implícitas>

# Critérios de Aceite
<critérios objetivos de conclusão>

Regras obrigatórias:
- Preserve TODA a informação do prompt original; não invente requisitos além dos implícitos.
- Não comente nem explique; devolva apenas o prompt otimizado.
- Use os cabeçalhos exatamente como nomeados acima.`;

type OptimizeResult = {
  ok: boolean;
  optimizedPrompt: string;
  usage: AIUsage;
  error?: string;
};

/**
 * Otimiza o prompt chamando um modelo de linguagem (ChatGPT) via Lovable AI
 * Gateway. Lê a chave apenas no servidor e consome o streaming internamente.
 * Em caso de falha, retorna ok=false para que o chamador caia no fallback heurístico.
 */
export async function optimizePromptWithAI(args: AnalyzeArgs): Promise<OptimizeResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const model = "openai/gpt-5.6-sol";
  if (!apiKey) {
    return {
      ok: false,
      optimizedPrompt: "",
      usage: noCost("lovable-ai", model, "optimize", args.content),
      error: "LOVABLE_API_KEY ausente",
    };
  }

  const userInput = `Plataforma: ${args.platform}. Tipo de tarefa: ${args.taskType}.\n\nPrompt original:\n${args.content}`;

  let res: Response;
  try {
    res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model,
        instructions: OPTIMIZE_INSTRUCTIONS,
        input: userInput,
        stream: true,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      optimizedPrompt: "",
      usage: noCost("lovable-ai", model, "optimize", args.content),
      error: err instanceof Error ? err.message : "falha de rede",
    };
  }

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      optimizedPrompt: "",
      usage: noCost("lovable-ai", model, "optimize", args.content),
      error: `Gateway ${res.status}: ${body.slice(0, 200)}`,
    };
  }

  // Consome o SSE: acumula os deltas de texto e captura o uso final.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let inputTokens = Math.ceil(args.content.length / 4);
  let outputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { usage?: { input_tokens?: number; output_tokens?: number } };
        };
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
          text += evt.delta;
        } else if (evt.type === "response.completed") {
          const u = evt.response?.usage;
          if (u) {
            inputTokens = u.input_tokens ?? inputTokens;
            outputTokens = u.output_tokens ?? 0;
          }
        }
      } catch {
        // linha parcial ou não-JSON: ignora
      }
    }
  }

  const optimized = text.trim();
  if (!optimized) {
    return {
      ok: false,
      optimizedPrompt: "",
      usage: noCost("lovable-ai", model, "optimize", args.content),
      error: "resposta vazia do modelo",
    };
  }

  return {
    ok: true,
    optimizedPrompt: optimized,
    usage: {
      provider: "lovable-ai",
      model,
      operation: "optimize",
      inputTokens,
      outputTokens,
      estimatedCost: 0,
    },
  };
}
