/**
 * Otimização de prompts pela IA nativa do Lovable (AI Gateway) — SERVER ONLY.
 *
 * Nenhuma conta ou chave da OpenAI é necessária: a chamada usa a
 * `LOVABLE_API_KEY` do projeto, lida exclusivamente no backend.
 */


export type OptimizationPayload = {
  original_prompt: string;
  optimized_prompt: string;
  analysis: string;
  improvements: string[];
  missing_information: string[];
  quality_score_before: number;
  quality_score_after: number;
};

/** Motor que efetivamente produziu a otimização. */
export type OptimizationEngine = "lovable" | "local";

export type OptimizationOutcome =
  | {
      ok: true;
      data: OptimizationPayload;
      engine: OptimizationEngine;
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
      engine: OptimizationEngine;
      model: string;
      durationMs: number;
    };

const SYSTEM_INSTRUCTIONS = `Você é um Especialista em Engenharia de Prompt e desenvolvimento de aplicações utilizando ferramentas de IA (Lovable, Cursor, Claude Code, GitHub Copilot, OpenAI Codex).

Sua tarefa é transformar o prompt recebido em um prompt claro, preciso, estruturado e executável, mantendo integralmente a intenção original do usuário.

Siga esta sequência:
1. COMPREENDER — identifique exatamente o que o usuário deseja construir, alterar ou executar.
2. IDENTIFICAR PROBLEMAS — ambiguidades, informações insuficientes, requisitos conflitantes, ausência de critérios de aceitação, instruções genéricas, requisitos implícitos e redundâncias.
3. ESTRUTURAR — organize o conteúdo em uma estrutura lógica com seções em markdown.
4. OTIMIZAR — reescreva de forma clara, objetiva, detalhada, estruturada, executável e orientada a resultados.
5. PRESERVAR INTENÇÃO — jamais altere o objetivo original.
6. AVALIAR — atribua notas de qualidade (0 a 100) ao prompt original e ao prompt otimizado.

O prompt otimizado deve cobrir, SEMPRE QUE APLICÁVEL ao pedido do usuário, o conjunto completo do que um sistema costuma exigir:
- objetivo do produto e contexto de negócio;
- perfis de usuário, permissões e regras de acesso;
- modelo de dados: entidades, campos e relacionamentos;
- autenticação, segurança e isolamento de dados por usuário;
- validações de entrada, tratamento de erros e estados vazios/carregando;
- interface, navegação, responsividade e acessibilidade;
- integrações externas e tratamento de credenciais sensíveis;
- ordem de execução em etapas independentes e verificáveis;
- critérios de aceitação objetivos e testáveis.

Regras obrigatórias:
- NÃO invente requisitos de negócio que não estejam implícitos no prompt original.
- Quando faltar informação relevante, registre-a em "missing_information" (com uma decisão razoável sugerida ou a pergunta a ser respondida) em vez de inventar.
- Nunca resuma nem descarte requisitos já presentes no prompt original.
- Itens estruturais e técnicos padrão (validação, erros, responsividade, critérios de aceite) podem e devem ser explicitados, pois são boas práticas, não requisitos de negócio inventados.
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
/** Modelo usado pela IA nativa do Lovable. */
export const GATEWAY_MODEL = "openai/gpt-5.6-sol";

/** Otimiza o prompt usando a IA nativa do Lovable. */
export async function optimizeWithGateway(prompt: string): Promise<OptimizationOutcome> {
  const model = GATEWAY_MODEL;
  const startedAt = Date.now();
  const apiKey = process.env["LOVABLE_API_KEY"];

  if (!apiKey) {
    return {
      ok: false,
      code: "not_configured",
      detail: "LOVABLE_API_KEY ausente no backend.",
    engine: "lovable" as const,
    model,
      durationMs: 0,
    };
  }

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
        stream: true,
        store: false,
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
    return {
      ok: false,
      code: "network",
      detail: err instanceof Error ? err.message : "falha de rede",
    engine: "lovable" as const,
    model,
      durationMs: Date.now() - startedAt,
    };
  }

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      code: res.status === 429 ? "rate_limited" : res.status === 402 ? "quota_exceeded" : "upstream",
      detail: `Gateway ${res.status}: ${body.slice(0, 500)}`,
    engine: "lovable" as const,
    model,
      durationMs: Date.now() - startedAt,
    };
  }

  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: {
            output_text?: string;
            usage?: { input_tokens?: number; output_tokens?: number };
          };
        };
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
          text += evt.delta;
        } else if (evt.type === "response.completed" && evt.response) {
          inputTokens = evt.response.usage?.input_tokens ?? 0;
          outputTokens = evt.response.usage?.output_tokens ?? 0;
          if (!text && typeof evt.response.output_text === "string") text = evt.response.output_text;
        }
      } catch {
        // ignora eventos não-JSON
      }
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.trim()) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      code: "invalid_response",
      detail: "JSON inválido retornado pelo gateway",
    engine: "lovable" as const,
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
    engine: "lovable" as const,
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
    engine: "lovable" as const,
    model,
    inputTokens,
    outputTokens,
    durationMs: Date.now() - startedAt,
  };
}

