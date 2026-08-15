/**
 * Integração com a OpenAI (Responses API) — SERVER ONLY.
 *
 * A chave `OPENAI_API_KEY` é lida exclusivamente aqui, dentro do backend.
 * Nada deste arquivo é enviado ao navegador (`*.server.ts`).
 */

/** Modelo centralizado: configurável por variável de ambiente. */
export const DEFAULT_OPENAI_MODEL = "gpt-4.1";
export function getOpenAIModel(): string {
  return process.env["OPENAI_MODEL"]?.trim() || DEFAULT_OPENAI_MODEL;
}

export const OPTIMIZATION_MIN_CHARS = 10;
export const OPTIMIZATION_MAX_CHARS = 120000;
const REQUEST_TIMEOUT_MS = 120000;

export type OptimizationPayload = {
  original_prompt: string;
  optimized_prompt: string;
  analysis: string;
  improvements: string[];
  missing_information: string[];
  quality_score_before: number;
  quality_score_after: number;
};

export type OptimizationOutcome =
  | {
      ok: true;
      data: OptimizationPayload;
      model: string;
      inputTokens: number;
      outputTokens: number;
      durationMs: number;
    }
  | {
      ok: false;
      /** Código estável para o frontend traduzir em mensagem amigável. */
      code:
        | "quota_exceeded"
        | "not_configured"
        | "invalid_key"
        | "rate_limited"
        | "timeout"
        | "upstream"
        | "invalid_response"
        | "network";
      /** Detalhe técnico — apenas para log do backend. */
      detail: string;
      model: string;
      durationMs: number;
    };

const SYSTEM_INSTRUCTIONS = `Você é um Especialista em Engenharia de Prompt e desenvolvimento de aplicações utilizando ferramentas de IA (Lovable, Cursor, Claude Code, GitHub Copilot, OpenAI Codex).

Sua tarefa é transformar o prompt recebido em um prompt claro, preciso, estruturado e executável, mantendo integralmente a intenção original do usuário.

Siga esta sequência:
1. COMPREENDER — identifique exatamente o que o usuário deseja construir, alterar ou executar.
2. IDENTIFICAR PROBLEMAS — ambiguidades, informações insuficientes, requisitos conflitantes, ausência de critérios de aceitação, instruções genéricas, requisitos implícitos e redundâncias.
3. ESTRUTURAR — organize o conteúdo em uma estrutura lógica.
4. OTIMIZAR — reescreva de forma clara, objetiva, detalhada, estruturada, executável e orientada a resultados.
5. PRESERVAR INTENÇÃO — jamais altere o objetivo original.
6. AVALIAR — atribua notas de qualidade (0 a 100) ao prompt original e ao prompt otimizado.

Ao otimizar, considere quando aplicável: objetivo principal, contexto, requisitos funcionais e não funcionais, regras de negócio, entradas, saídas esperadas, usuários, perfis e permissões, integrações, banco de dados, autenticação, segurança, validações, tratamento de erros, experiência do usuário, interface, responsividade e critérios de aceitação.

Regras obrigatórias:
- NÃO invente requisitos de negócio que não estejam implícitos no prompt original.
- Quando faltar informação relevante, registre-a em "missing_information" (com uma decisão razoável sugerida ou a pergunta a ser respondida) em vez de inventar.
- Nunca resuma nem descarte requisitos já presentes no prompt original.
- Escreva sempre em português do Brasil.
- O campo "optimized_prompt" deve conter APENAS o prompt final, em markdown, pronto para ser colado na ferramenta de IA.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    original_prompt: { type: "string" },
    optimized_prompt: { type: "string" },
    analysis: { type: "string" },
    improvements: { type: "array", items: { type: "string" } },
    missing_information: { type: "array", items: { type: "string" } },
    quality_score_before: { type: "integer" },
    quality_score_after: { type: "integer" },
  },
  required: [
    "original_prompt",
    "optimized_prompt",
    "analysis",
    "improvements",
    "missing_information",
    "quality_score_before",
    "quality_score_after",
  ],
} as const;

function clampScore(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

/** Extrai o texto final de uma resposta da Responses API. */
function extractOutputText(json: unknown): string {
  const j = json as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof j.output_text === "string" && j.output_text.trim()) return j.output_text;
  let text = "";
  for (const item of j.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string") text += part.text;
    }
  }
  return text;
}

export async function optimizeWithOpenAI(prompt: string): Promise<OptimizationOutcome> {
  const model = getOpenAIModel();
  const startedAt = Date.now();
  const apiKey = process.env["OPENAI_API_KEY"];

  if (!apiKey) {
    return {
      ok: false,
      code: "not_configured",
      detail: "OPENAI_API_KEY não está configurada no ambiente do backend.",
      model,
      durationMs: 0,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        instructions: SYSTEM_INSTRUCTIONS,
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: `Prompt original do usuário:\n\n${prompt}` }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "prompt_optimization",
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      code: aborted ? "timeout" : "network",
      detail: err instanceof Error ? err.message : "falha de rede",
      model,
      durationMs: Date.now() - startedAt,
    };
  }
  clearTimeout(timer);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      code:
        res.status === 401 || res.status === 403
          ? "invalid_key"
          : res.status === 429
            ? body.includes("insufficient_quota")
              ? "quota_exceeded"
              : "rate_limited"
            : "upstream",
      detail: `OpenAI ${res.status}: ${body.slice(0, 500)}`,
      model,
      durationMs: Date.now() - startedAt,
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (err) {
    return {
      ok: false,
      code: "invalid_response",
      detail: err instanceof Error ? err.message : "corpo inválido",
      model,
      durationMs: Date.now() - startedAt,
    };
  }

  const usage = (json as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  const text = extractOutputText(json).trim();
  if (!text) {
    return {
      ok: false,
      code: "invalid_response",
      detail: "resposta sem conteúdo de texto",
      model,
      durationMs: Date.now() - startedAt,
    };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      code: "invalid_response",
      detail: "JSON inválido retornado pelo modelo",
      model,
      durationMs: Date.now() - startedAt,
    };
  }

  const optimized = String(parsed["optimized_prompt"] ?? "").trim();
  if (!optimized) {
    return {
      ok: false,
      code: "invalid_response",
      detail: "campo optimized_prompt ausente ou vazio",
      model,
      durationMs: Date.now() - startedAt,
    };
  }

  return {
    ok: true,
    data: {
      original_prompt: prompt,
      optimized_prompt: optimized,
      analysis: String(parsed["analysis"] ?? "").trim(),
      improvements: toStringArray(parsed["improvements"]),
      missing_information: toStringArray(parsed["missing_information"]),
      quality_score_before: clampScore(parsed["quality_score_before"]),
      quality_score_after: clampScore(parsed["quality_score_after"]),
    },
    model,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    durationMs: Date.now() - startedAt,
  };
}
