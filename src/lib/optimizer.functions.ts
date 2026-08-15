import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzePromptText } from "@/lib/estimator";
import { FRIENDLY_ERROR, monthStartISO, optimizeInput } from "@/lib/optimizer-shared";

export type OptimizeResponse = {
  originalPrompt: string;
  optimizedPrompt: string;
  analysis: string;
  improvements: string[];
  missingInformation: string[];
  qualityScoreBefore: number;
  qualityScoreAfter: number;
  engine: "lovable" | "openai" | "local";
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  usage: { used: number; limit: number; plan: string };
};


/**
 * Otimiza um prompt usando a IA nativa do Lovable (sem exigir conta OpenAI).
 * A chamada acontece somente no backend; nenhuma credencial chega ao navegador.
 */
export const optimizePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => optimizeInput.parse(d))
  .handler(async ({ data, context }): Promise<OptimizeResponse> => {
    const { supabase, userId } = context;

    // ---- Limite mensal de otimizações por plano ----
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_id, plans:plan_id (name, monthly_analysis_limit)")
      .eq("user_id", userId)
      .maybeSingle();
    const plan = (profile?.plans ?? null) as
      | { name: string; monthly_analysis_limit: number }
      | null;
    const limit = plan?.monthly_analysis_limit ?? 5;
    const planName = plan?.name ?? "Free";

    const { count } = await supabase
      .from("openai_optimizations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "success")
      .gte("created_at", monthStartISO());
    const used = count ?? 0;

    if (used >= limit) {
      throw new Error(
        `Limite mensal do plano ${planName} atingido (${used}/${limit} otimizações). Faça upgrade para continuar.`,
      );
    }

    const { optimizeWithOpenAI, optimizeWithGateway } = await import("@/lib/ai/openai.server");

    // Caminho principal: motor de IA nativo do Lovable.
    let outcome = await optimizeWithGateway(data.content);

    // Caminho opcional: chave própria da OpenAI, apenas quando explicitamente preferida.
    const preferOwnKey =
      process.env["OPTIMIZER_PREFER_OPENAI"] === "true" && Boolean(process.env["OPENAI_API_KEY"]);
    if (!outcome.ok && preferOwnKey) {
      const own = await optimizeWithOpenAI(data.content);
      if (own.ok) outcome = own;
    }

    // Último recurso: motor heurístico local (sem custo e sempre disponível).
    if (!outcome.ok) {
      console.error("[optimize-prompt] motores de IA indisponíveis", {
        code: outcome.code,
        detail: outcome.detail,
        engine: outcome.engine,
        userId,
      });

      const local = analyzePromptText(data.content);
      if (local.optimizedPrompt && local.optimizedPrompt.trim() !== data.content.trim()) {
        const localResult = {
          original_prompt: data.content,
          optimized_prompt: local.optimizedPrompt,
          analysis:
            "Otimização gerada pelo motor local de regras (a IA estava indisponível no momento). O prompt foi reestruturado em seções, mas sem análise semântica aprofundada.",
          improvements: local.recommendations,
          missing_information: [] as string[],
          quality_score_before: Math.max(0, 100 - local.complexityScore),
          quality_score_after: Math.min(100, Math.max(0, 100 - local.complexityScore) + 15),
        };

        await supabase.from("openai_optimizations").insert({
          user_id: userId,
          original_prompt: data.content,
          optimized_prompt: localResult.optimized_prompt,
          analysis: localResult.analysis,
          improvements: localResult.improvements,
          missing_information: localResult.missing_information,
          quality_score_before: localResult.quality_score_before,
          quality_score_after: localResult.quality_score_after,
          model: "local-rules",
          input_tokens: 0,
          output_tokens: 0,
          duration_ms: 0,
          status: "success",
        });

        return {
          originalPrompt: localResult.original_prompt,
          optimizedPrompt: localResult.optimized_prompt,
          analysis: localResult.analysis,
          improvements: localResult.improvements,
          missingInformation: localResult.missing_information,
          qualityScoreBefore: localResult.quality_score_before,
          qualityScoreAfter: localResult.quality_score_after,
          engine: "local",
          model: "local-rules",
          inputTokens: 0,
          outputTokens: 0,
          durationMs: 0,
          usage: { used: used + 1, limit, plan: planName },
        };
      }

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
      provider: outcome.engine === "openai" ? "openai" : "lovable",
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
      engine: outcome.engine,
      model: outcome.model,
      inputTokens: outcome.inputTokens,
      outputTokens: outcome.outputTokens,
      durationMs: outcome.durationMs,
      usage: { used: used + 1, limit, plan: planName },
    };
  });

/** Uso mensal de otimizações do usuário — usado para desabilitar o botão na UI. */
export const getOptimizationUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("plans:plan_id (name, monthly_analysis_limit)")
      .eq("user_id", userId)
      .maybeSingle();
    const plan = (profile?.plans ?? null) as
      | { name: string; monthly_analysis_limit: number }
      | null;
    const { count } = await supabase
      .from("openai_optimizations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "success")
      .gte("created_at", monthStartISO());
    return {
      used: count ?? 0,
      limit: plan?.monthly_analysis_limit ?? 5,
      plan: plan?.name ?? "Free",
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
