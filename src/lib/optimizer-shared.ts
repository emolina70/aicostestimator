import { z } from "zod";

export const MIN_CHARS = 10;
export const MAX_CHARS = 120000;

export const optimizeInput = z.object({
  content: z
    .string()
    .trim()
    .min(MIN_CHARS, "Informe um prompt para iniciar a otimização.")
    .max(MAX_CHARS, `O prompt excede o limite de ${MAX_CHARS.toLocaleString("pt-BR")} caracteres.`),
});

export const FRIENDLY_ERROR: Record<string, string> = {
  not_configured: "O motor de IA não está disponível neste momento. Tente novamente em instantes.",
  invalid_key: "O motor de IA não está disponível neste momento. Tente novamente em instantes.",
  quota_exceeded:
    "Os créditos de IA do workspace se esgotaram. Recarregue os créditos para continuar otimizando.",
  rate_limited: "Muitas otimizações em sequência. Aguarde alguns instantes e tente novamente.",
  timeout: "A otimização demorou mais que o esperado. Tente novamente.",
  upstream: "Não foi possível realizar a otimização neste momento. Tente novamente.",
  network: "Não foi possível realizar a otimização neste momento. Tente novamente.",
  invalid_response: "Ocorreu um erro inesperado durante a otimização. Tente novamente.",
};

/** Início do mês corrente em UTC, usado para contar o consumo mensal. */
export function monthStartISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
