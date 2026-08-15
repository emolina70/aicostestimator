import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OptimizeResponse = {
  originalPrompt: string;
  optimizedPrompt: string;
  analysis: string;
  improvements: string[];
  missingInformation: string[];
  qualityScoreBefore: number;
  qualityScoreAfter: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
};

const MIN_CHARS = 10;
const MAX_CHARS = 120000;

const optimizeInput = z.object({
  content: z
    .string()
    .trim()
    .min(MIN_CHARS, "Informe um prompt para iniciar a otimização.")
    .max(MAX_CHARS, `O prompt excede o limite de ${MAX_CHARS.toLocaleString("pt-BR")} caracteres.`),
});

const FRIENDLY_ERROR: Record<string, string> = {
  not_configured:
    "A integração com a OpenAI ainda não está configurada. Contate o administrador do sistema.",
  timeout: "A otimização demorou mais que o esperado. Tente novamente.",
  upstream: "Não foi possível realizar a otimização neste momento. Tente novamente.",
  network: "Não foi possível realizar a otimização neste momento. Tente novamente.",
  invalid_response: "Ocorreu um erro inesperado durante a otimização. Tente novamente.",
};

/**
 * Otimiza um prompt usando a OpenAI Responses API.
 * A chamada acontece somente no backend; a chave nunca chega ao navegador.
 */
export const optimizePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => optimizeInput.parse(d))
  .handler(async ({ data, context }): Promise<OptimizeResponse> => {
    const { supabase, userId } = context;
    const { optimizeWithOpenAI } = await import("@/lib/ai/openai.server");

    const outcome = await optimizeWithOpenAI(data.content);

    if (!outcome.ok) {
      // Detalhe técnico fica apenas no log do backend (nunca contém a chave).
      console.error("[optimize-prompt] falha", {
        code: outcome.code,
        detail: outcome.detail,
        model: outcome.model,
        userId,
      });
      await supabase.from("openai_optimizations").insert({
        user_id: userId,
        original_prompt: data.content,
        model: outcome.model,
        duration_ms: outcome.durationMs,
        status: "error",
        error_message: `${outcome.code}: ${outcome.detail}`.slice(0, 1000),
      });
      throw new Error(
        FRIENDLY_ERROR[outcome.code] ?? "Ocorreu um erro inesperado durante a otimização.",
      );
    }

    const r = outcome.data;

    await supabase.from("openai_optimizations").insert({
      user_id: userId,
      original_prompt: data.content,
      optimized_prompt: r.optimized_prompt,
      analysis: r.analysis,
      improvements: r.improvements,
      missing_information: r.missing_information,
      quality_score_before: r.quality_score_before,
      quality_score_after: r.quality_score_after,
      model: outcome.model,
      input_tokens: outcome.inputTokens,
      output_tokens: outcome.outputTokens,
      duration_ms: outcome.durationMs,
      status: "success",
    });

    // Controle de consumo por usuário (reaproveita o registro já existente).
    const { logAIUsage } = await import("@/lib/ai/provider.server");
    void logAIUsage(userId, {
      provider: "openai",
      model: outcome.model,
      operation: "optimize",
      inputTokens: outcome.inputTokens,
      outputTokens: outcome.outputTokens,
      estimatedCost: 0,
    });

    return {
      originalPrompt: r.original_prompt,
      optimizedPrompt: r.optimized_prompt,
      analysis: r.analysis,
      improvements: r.improvements,
      missingInformation: r.missing_information,
      qualityScoreBefore: r.quality_score_before,
      qualityScoreAfter: r.quality_score_after,
      model: outcome.model,
      inputTokens: outcome.inputTokens,
      outputTokens: outcome.outputTokens,
      durationMs: outcome.durationMs,
    };
  });

export const listOptimizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("openai_optimizations")
      .select("id, created_at, original_prompt, quality_score_before, quality_score_after, status, model")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });
