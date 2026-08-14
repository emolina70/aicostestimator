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
  optimizedByAI: boolean;
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
    const weights: Record<string, number> = {};
    for (const p of params ?? []) {
      const map: Record<string, string> = {
        base_credits: "baseCredits",
        credits_per_complexity_point: "creditsPerComplexityPoint",
        min_factor: "minFactor",
        max_factor: "maxFactor",
      };
      const weightMap: Record<string, string> = {
        frontend_weight: "frontend",
        backend_weight: "backend",
        database_weight: "database",
        authentication_weight: "authentication",
        integration_weight: "integration",
        logic_weight: "logic",
        crud_weight: "crud",
        complexity_weight: "complexity",
      };
      const key = map[p.parameter_name];
      if (key) overrides[key] = Number(p.parameter_value);
      const wkey = weightMap[p.parameter_name];
      if (wkey) weights[wkey] = Number(p.parameter_value);
    }

    const taskType = data.taskType as TaskTypeId;
    // Toda análise passa pela camada de abstração de IA (hoje: motor heurístico).
    const { getAIProvider, logAIUsage, optimizePromptWithAI } =
      await import("@/lib/ai/provider.server");
    const provider = getAIProvider();
    const { value: result, usage } = await provider.analyzePrompt({
      content: data.content,
      platform,
      taskType,
      overrides,
      weights,
    });
    void logAIUsage(userId, usage);

    // Otimização do prompt por IA (ChatGPT via Lovable AI Gateway).
    // Em caso de falha, mantém o prompt otimizado heurístico já calculado.
    let optimizedByAI = false;
    try {
      const ai = await optimizePromptWithAI({
        content: data.content,
        platform,
        taskType,
        overrides,
        weights,
      });
      if (ai.ok && ai.optimizedPrompt.trim()) {
        result.optimizedPrompt = ai.optimizedPrompt.trim();
        // Recalcula a estimativa do prompt otimizado pela IA com o motor atual.
        const aiEstimate = analyzePromptText(
          result.optimizedPrompt,
          platform,
          overrides,
          taskType,
          weights,
        );
        result.estimatedOptimized = aiEstimate.estimatedExpected;
        const reduction =
          result.estimatedExpected > 0
            ? Math.max(
                0,
                Math.round(
                  ((result.estimatedExpected - aiEstimate.estimatedExpected) /
                    result.estimatedExpected) *
                    100,
                ),
              )
            : 0;
        result.reductionPercentage = reduction;
        optimizedByAI = true;
        void logAIUsage(userId, ai.usage);
      }
    } catch {
      // Fallback silencioso: permanece a otimização heurística.
    }


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

    const [{ data: profile }, { data: usageRow }, { data: analyses }, { data: actuals }, { data: optimizations }] =
      await Promise.all([
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
            "id, prompt_id, created_at, platform, task_type, complexity_score, confidence_score, estimated_min, estimated_expected, estimated_max, prompts:prompt_id (title)",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("actual_usage")
          .select("prompt_id, actual_credits, execution_date")
          .eq("user_id", userId),
        supabase
          .from("prompt_optimizations")
          .select("prompt_id, estimated_original, estimated_optimized")
          .eq("user_id", userId),
      ]);

    const plan = (profile?.plans ?? null) as
      | { code: string; name: string; monthly_analysis_limit: number }
      | null;

    const actualByPrompt = new Map<string, number>();
    for (const r of actuals ?? []) {
      const prev = actualByPrompt.get(r.prompt_id) ?? 0;
      actualByPrompt.set(r.prompt_id, prev + Number(r.actual_credits));
    }

    const rows = (analyses ?? []).map((a) => {
      const expected = Number(a.estimated_expected);
      const actual = actualByPrompt.get(a.prompt_id) ?? null;
      const accuracy =
        actual !== null && actual > 0
          ? Math.max(0, Math.round((1 - Math.abs(expected - actual) / actual) * 100))
          : null;
      return {
        id: a.id,
        promptId: a.prompt_id,
        createdAt: a.created_at,
        platform: a.platform,
        taskType: (a as { task_type?: string }).task_type ?? "other",
        title: (a.prompts as { title: string } | null)?.title ?? "Prompt",
        complexity: Number(a.complexity_score),
        confidence: Number(a.confidence_score),
        min: Number(a.estimated_min),
        expected,
        max: Number(a.estimated_max),
        actual,
        accuracy,
      };
    });

    const totalEstimated = rows.reduce((s, r) => s + r.expected, 0);
    const totalActual = rows.reduce((s, r) => s + (r.actual ?? 0), 0);
    const withAccuracy = rows.filter((r) => r.accuracy !== null);
    const avgAccuracy =
      withAccuracy.length > 0
        ? Math.round(withAccuracy.reduce((s, r) => s + (r.accuracy ?? 0), 0) / withAccuracy.length)
        : null;
    const savings = (optimizations ?? []).reduce(
      (s, o) => s + Math.max(0, Number(o.estimated_original) - Number(o.estimated_optimized)),
      0,
    );

    // Série temporal agregada por dia (ordem cronológica).
    const buckets = new Map<
      string,
      { date: string; estimated: number; actual: number; count: number; complexity: number; accSum: number; accCount: number }
    >();
    for (const r of rows) {
      const date = String(r.createdAt).slice(0, 10);
      const b =
        buckets.get(date) ??
        { date, estimated: 0, actual: 0, count: 0, complexity: 0, accSum: 0, accCount: 0 };
      b.estimated += r.expected;
      b.actual += r.actual ?? 0;
      b.count += 1;
      b.complexity += r.complexity;
      if (r.accuracy !== null) {
        b.accSum += r.accuracy;
        b.accCount += 1;
      }
      buckets.set(date, b);
    }
    const series = [...buckets.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((b) => ({
        date: b.date,
        estimated: Math.round(b.estimated * 10) / 10,
        actual: Math.round(b.actual * 10) / 10,
        count: b.count,
        complexity: Math.round(b.complexity / b.count),
        accuracy: b.accCount > 0 ? Math.round(b.accSum / b.accCount) : null,
      }));

    return {
      profile: { name: profile?.name ?? null, email: profile?.email ?? null },
      plan: { name: plan?.name ?? "Free", code: plan?.code ?? "free", limit: plan?.monthly_analysis_limit ?? 5 },
      used: usageRow?.analyses_count ?? 0,
      metrics: {
        totalAnalyses: rows.length,
        totalEstimated: Math.round(totalEstimated * 10) / 10,
        totalActual: Math.round(totalActual * 10) / 10,
        avgAccuracy,
        savings: Math.round(savings * 10) / 10,
        avgComplexity:
          rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.complexity, 0) / rows.length) : 0,
      },
      series,
      analyses: rows.slice(0, 20),
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

/** Lista completa de análises do usuário, com consumo real e diferença. */
export const listAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: analyses }, { data: actuals }] = await Promise.all([
      supabase
        .from("prompt_analyses")
        .select(
          "id, prompt_id, created_at, platform, task_type, complexity_score, confidence_score, estimated_min, estimated_expected, estimated_max, prompts:prompt_id (title, is_demo, project_id, projects:project_id (name))",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("actual_usage").select("prompt_id, actual_credits").eq("user_id", userId),
    ]);

    const actualByPrompt = new Map<string, number>();
    for (const r of actuals ?? []) {
      actualByPrompt.set(r.prompt_id, (actualByPrompt.get(r.prompt_id) ?? 0) + Number(r.actual_credits));
    }

    return (analyses ?? []).map((a) => {
      const p = a.prompts as
        | { title: string; is_demo: boolean; projects: { name: string } | null }
        | null;
      const expected = Number(a.estimated_expected);
      const actual = actualByPrompt.get(a.prompt_id) ?? null;
      return {
        id: a.id,
        promptId: a.prompt_id,
        createdAt: a.created_at,
        platform: a.platform,
        taskType: (a as { task_type?: string }).task_type ?? "other",
        title: p?.title ?? "Prompt",
        isDemo: p?.is_demo ?? false,
        project: p?.projects?.name ?? null,
        complexity: Number(a.complexity_score),
        confidence: Number(a.confidence_score),
        min: Number(a.estimated_min),
        expected,
        max: Number(a.estimated_max),
        actual,
        diff: actual === null ? null : Math.round((actual - expected) * 100) / 100,
        errorPct:
          actual === null || actual === 0
            ? null
            : Math.round((Math.abs(actual - expected) / actual) * 100),
      };
    });
  });

export const deleteAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("prompt_analyses")
      .select("prompt_id")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("Análise não encontrada");
    await supabase.from("prompt_analyses").delete().eq("id", data.id).eq("user_id", userId);
    await supabase.from("prompt_optimizations").delete().eq("prompt_id", row.prompt_id).eq("user_id", userId);
    await supabase.from("actual_usage").delete().eq("prompt_id", row.prompt_id).eq("user_id", userId);
    await supabase.from("prompts").delete().eq("id", row.prompt_id).eq("user_id", userId);
    return { ok: true };
  });

/** Duplica o prompt de uma análise para reanálise (sem consumir o limite). */
export const duplicateAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("prompt_analyses")
      .select("prompt_id, platform, task_type, prompts:prompt_id (title, content, project_id)")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("Análise não encontrada");
    const p = row.prompts as { title: string; content: string; project_id: string | null } | null;
    return {
      title: `${p?.title ?? "Prompt"} (cópia)`,
      content: p?.content ?? "",
      platform: row.platform,
      taskType: (row as { task_type?: string }).task_type ?? "other",
      projectId: p?.project_id ?? null,
    };
  });

/** Comparação estimado × real de um prompt específico. */
export const getAccuracy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ promptId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: analysis }, { data: actuals }] = await Promise.all([
      supabase
        .from("prompt_analyses")
        .select("estimated_expected")
        .eq("prompt_id", data.promptId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("actual_usage")
        .select("actual_credits, execution_date, notes")
        .eq("prompt_id", data.promptId)
        .eq("user_id", userId)
        .order("execution_date", { ascending: false }),
    ]);
    const expected = Number(analysis?.estimated_expected ?? 0);
    const actual = (actuals ?? []).reduce((s, r) => s + Number(r.actual_credits), 0);
    const hasActual = (actuals ?? []).length > 0;
    return {
      expected,
      actual: hasActual ? Math.round(actual * 100) / 100 : null,
      absoluteError: hasActual ? Math.round(Math.abs(actual - expected) * 100) / 100 : null,
      percentError: hasActual && actual > 0 ? Math.round((Math.abs(actual - expected) / actual) * 100) : null,
      accuracy:
        hasActual && actual > 0
          ? Math.max(0, Math.round((1 - Math.abs(actual - expected) / actual) * 100))
          : null,
      entries: (actuals ?? []).map((r) => ({
        credits: Number(r.actual_credits),
        date: r.execution_date,
        notes: r.notes,
      })),
    };
  });

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data) };
  });

/** Painel administrativo: métricas agregadas de toda a plataforma. */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: analyses }, { data: actuals }, { data: plans }, { data: aiLogs }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id, user_id, name, email, created_at, plans:plan_id (code, name)"),
        supabaseAdmin
          .from("prompt_analyses")
          .select("id, user_id, prompt_id, platform, estimated_expected, complexity_score, created_at"),
        supabaseAdmin.from("actual_usage").select("prompt_id, actual_credits"),
        supabaseAdmin.from("plans").select("id, code, name, monthly_analysis_limit"),
        supabaseAdmin.from("ai_usage_logs").select("provider, model, estimated_cost, input_tokens, output_tokens"),
      ]);

    const actualByPrompt = new Map<string, number>();
    for (const r of actuals ?? []) {
      actualByPrompt.set(r.prompt_id, (actualByPrompt.get(r.prompt_id) ?? 0) + Number(r.actual_credits));
    }

    const rows = analyses ?? [];
    const totalEstimated = rows.reduce((s, a) => s + Number(a.estimated_expected), 0);
    const totalActual = [...actualByPrompt.values()].reduce((s, v) => s + v, 0);

    const accuracies = rows
      .map((a) => {
        const actual = actualByPrompt.get(a.prompt_id);
        if (!actual || actual <= 0) return null;
        return Math.max(0, (1 - Math.abs(Number(a.estimated_expected) - actual) / actual) * 100);
      })
      .filter((v): v is number => v !== null);

    const byPlatform = new Map<string, number>();
    for (const a of rows) byPlatform.set(a.platform, (byPlatform.get(a.platform) ?? 0) + 1);

    const byPlan = new Map<string, number>();
    for (const p of profiles ?? []) {
      const plan = (p.plans as { name: string } | null)?.name ?? "Free";
      byPlan.set(plan, (byPlan.get(plan) ?? 0) + 1);
    }

    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const activeUsers = new Set(
      rows.filter((a) => new Date(a.created_at).getTime() >= since).map((a) => a.user_id),
    ).size;

    return {
      users: (profiles ?? []).length,
      activeUsers,
      totalAnalyses: rows.length,
      totalEstimated: Math.round(totalEstimated * 10) / 10,
      totalActual: Math.round(totalActual * 10) / 10,
      avgAccuracy:
        accuracies.length > 0
          ? Math.round(accuracies.reduce((s, v) => s + v, 0) / accuracies.length)
          : null,
      plans: (plans ?? []).map((p) => ({
        code: p.code,
        name: p.name,
        limit: p.monthly_analysis_limit,
        users: byPlan.get(p.name) ?? 0,
      })),
      byPlatform: [...byPlatform.entries()].map(([platform, count]) => ({ platform, count })),
      aiCost: {
        calls: (aiLogs ?? []).length,
        estimatedCost:
          Math.round((aiLogs ?? []).reduce((s, l) => s + Number(l.estimated_cost), 0) * 10000) / 10000,
        inputTokens: (aiLogs ?? []).reduce((s, l) => s + Number(l.input_tokens), 0),
        outputTokens: (aiLogs ?? []).reduce((s, l) => s + Number(l.output_tokens), 0),
      },
    };
  });

export const listEstimatorParameters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");
    const { data } = await context.supabase
      .from("estimator_parameters")
      .select("id, platform, parameter_name, parameter_value, description, active")
      .order("platform")
      .order("parameter_name");
    return data ?? [];
  });

export const updateEstimatorParameter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), value: z.number().min(0).max(1000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");
    const { error } = await context.supabase
      .from("estimator_parameters")
      .update({ parameter_value: data.value })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
