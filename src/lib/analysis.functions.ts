import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  analyzePromptText,
  type EstimationResult,
  type PlatformId,
  type TaskTypeId,
} from "@/lib/estimator";

const analyzeInput = z.object({
  title: z.string().min(1).max(140),
  content: z.string().min(10).max(20000),
  platform: z.string().default("lovable"),
  taskType: z.string().default("other"),
  projectId: z.string().uuid().nullable().optional(),
});

export type AnalyzeResponse = {
  promptId: string;
  analysisId: string;
  result: EstimationResult;
  usage: { used: number; limit: number; plan: string };
};

export const analyzePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => analyzeInput.parse(d))
  .handler(async ({ data, context }): Promise<AnalyzeResponse> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, plan_id, plans:plan_id (code, name, monthly_analysis_limit)")
      .eq("user_id", userId)
      .maybeSingle();

    const plan = (profile?.plans ?? null) as
      | { code: string; name: string; monthly_analysis_limit: number }
      | null;
    const limit = plan?.monthly_analysis_limit ?? 5;

    const period = new Date();
    const periodMonth = `${period.getUTCFullYear()}-${String(period.getUTCMonth() + 1).padStart(2, "0")}-01`;

    const { data: usageRow } = await supabase
      .from("usage_history")
      .select("analyses_count")
      .eq("user_id", userId)
      .eq("period_month", periodMonth)
      .maybeSingle();

    const used = usageRow?.analyses_count ?? 0;
    if (used >= limit) {
      throw new Error(
        `Limite mensal do plano ${plan?.name ?? "Free"} atingido (${used}/${limit} análises). Faça upgrade para continuar.`,
      );
    }

    const platform = data.platform as PlatformId;

    // Parâmetros ajustáveis do estimador ficam no banco (nunca no navegador).
    const { data: params } = await supabase
      .from("estimator_parameters")
      .select("parameter_name, parameter_value")
      .eq("platform", platform)
      .eq("active", true);

    const overrides: Record<string, number> = {};
    for (const p of params ?? []) {
      const map: Record<string, string> = {
        base_credits: "baseCredits",
        credits_per_complexity_point: "creditsPerComplexityPoint",
        min_factor: "minFactor",
        max_factor: "maxFactor",
      };
      const key = map[p.parameter_name];
      if (key) overrides[key] = Number(p.parameter_value);
    }

    const taskType = data.taskType as TaskTypeId;
    const result = analyzePromptText(data.content, platform, overrides, taskType);

    const { data: prompt, error: promptError } = await supabase
      .from("prompts")
      .insert({
        user_id: userId,
        project_id: data.projectId ?? null,
        title: data.title,
        content: data.content,
        platform,
        task_type: taskType,
      })
      .select("id")
      .single();
    if (promptError || !prompt) throw new Error(promptError?.message ?? "Falha ao salvar o prompt");

    const { data: analysis, error: analysisError } = await supabase
      .from("prompt_analyses")
      .insert({
        prompt_id: prompt.id,
        user_id: userId,
        platform,
        task_type: taskType,
        complexity_score: result.complexityScore,
        confidence_score: result.confidenceScore,
        estimated_min: result.estimatedMin,
        estimated_expected: result.estimatedExpected,
        estimated_max: result.estimatedMax,
        frontend_score: result.scores.frontend,
        backend_score: result.scores.backend,
        database_score: result.scores.database,
        authentication_score: result.scores.authentication,
        integration_score: result.scores.integration,
        logic_score: result.scores.logic,
        estimated_entities: result.estimatedEntities,
        estimated_operations: result.estimatedOperations,
        factors: result.factors,
        steps: result.steps,
        recommendation: result.recommendations.join("\n"),
      })
      .select("id")
      .single();
    if (analysisError || !analysis) throw new Error(analysisError?.message ?? "Falha ao salvar a análise");

    await supabase.from("prompt_optimizations").insert({
      prompt_id: prompt.id,
      user_id: userId,
      original_prompt: data.content,
      optimized_prompt: result.optimizedPrompt,
      estimated_original: result.estimatedExpected,
      estimated_optimized: result.estimatedOptimized,
      estimated_reduction_percentage: result.reductionPercentage,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("increment_usage", { _user_id: userId });

    return {
      promptId: prompt.id,
      analysisId: analysis.id,
      result,
      usage: { used: used + 1, limit, plan: plan?.name ?? "Free" },
    };
  });

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const period = new Date();
    const periodMonth = `${period.getUTCFullYear()}-${String(period.getUTCMonth() + 1).padStart(2, "0")}-01`;

    const [{ data: profile }, { data: usageRow }, { data: analyses }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, name, email, plans:plan_id (code, name, monthly_analysis_limit)")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("usage_history")
        .select("analyses_count")
        .eq("user_id", userId)
        .eq("period_month", periodMonth)
        .maybeSingle(),
      supabase
        .from("prompt_analyses")
        .select(
          "id, created_at, platform, complexity_score, confidence_score, estimated_min, estimated_expected, estimated_max, prompts:prompt_id (title)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const plan = (profile?.plans ?? null) as
      | { code: string; name: string; monthly_analysis_limit: number }
      | null;

    return {
      profile: { name: profile?.name ?? null, email: profile?.email ?? null },
      plan: { name: plan?.name ?? "Free", code: plan?.code ?? "free", limit: plan?.monthly_analysis_limit ?? 5 },
      used: usageRow?.analyses_count ?? 0,
      analyses: (analyses ?? []).map((a) => ({
        id: a.id,
        createdAt: a.created_at,
        platform: a.platform,
        title: (a.prompts as { title: string } | null)?.title ?? "Prompt",
        complexity: Number(a.complexity_score),
        confidence: Number(a.confidence_score),
        min: Number(a.estimated_min),
        expected: Number(a.estimated_expected),
        max: Number(a.estimated_max),
      })),
    };
  });

export const getAnalysisDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: analysis, error } = await supabase
      .from("prompt_analyses")
      .select("*, prompts:prompt_id (id, title, content, platform)")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!analysis) throw new Error("Análise não encontrada");

    const promptRef = analysis.prompts as { id: string } | null;
    const { data: optimization } = await supabase
      .from("prompt_optimizations")
      .select("optimized_prompt, estimated_optimized, estimated_reduction_percentage")
      .eq("prompt_id", promptRef?.id ?? "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return { analysis, optimization };
  });

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("projects")
      .select("id, name, description, platform, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        description: z.string().max(600).optional().nullable(),
        platform: z.string().default("lovable"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("projects").insert({
      user_id: context.userId,
      name: data.name,
      description: data.description ?? null,
      platform: data.platform,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateProfileName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ name: data.name })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordActualUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        promptId: z.string().uuid(),
        actualCredits: z.number().min(0).max(100000),
        notes: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("actual_usage").insert({
      prompt_id: data.promptId,
      user_id: context.userId,
      actual_credits: data.actualCredits,
      notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
