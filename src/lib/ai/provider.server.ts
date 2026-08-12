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
  type PlatformId,
  type PlatformProfile,
  type TaskTypeId,
} from "@/lib/estimator";

export type AnalyzeArgs = {
  content: string;
  platform: PlatformId;
  taskType: TaskTypeId;
  overrides?: Partial<PlatformProfile>;
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

  private run({ content, platform, taskType, overrides }: AnalyzeArgs) {
    return analyzePromptText(content, platform, overrides, taskType);
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
