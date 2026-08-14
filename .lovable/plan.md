# Otimização de prompt com IA (ChatGPT)

Hoje o prompt otimizado é gerado por regras locais (motor heurístico). O objetivo é passar a gerar o prompt otimizado sempre por IA (ChatGPT via Lovable AI Gateway), sem seletor — o motor heurístico continua só para score, faixa de créditos, fatores e etapas.

## O que muda para o usuário

- O prompt otimizado exibido no relatório passa a ser sempre o texto gerado pelo modelo de IA — com a mesma estrutura de seções (Objetivo, Contexto, Requisitos, Escopo Técnico, Ordem de Execução, Restrições, Critérios de Aceite) e sem perder nenhum requisito do texto original.
- O relatório mostra a etiqueta "Otimizado por IA" no bloco do prompt otimizado.
- Se a chamada de IA falhar (erro, limite de créditos), a análise não quebra: cai automaticamente para a otimização heurística e um aviso discreto informa isso.

## O que NÃO muda

- Score de complexidade, faixa de créditos (mín./provável/máx.), nível de confiança, fatores e etapas continuam vindo do motor heurístico atual.
- Limites de plano e contagem mensal de análises seguem iguais.

## Detalhes técnicos

- Novo provedor `LovableAIProvider` registrado em `src/lib/ai/provider.server.ts`, implementando `optimizePrompt` via Lovable AI Gateway (modelo `openai/gpt-5.6-sol`, Responses API, chamada em streaming consumida no servidor). Chave `LOVABLE_API_KEY` lida apenas no servidor.
- `analyzePrompt` em `src/lib/analysis.functions.ts` passa a chamar sempre a IA para gerar `optimizedPrompt` (e recalcula a redução estimada reanalisando o texto gerado com o motor atual, que já detecta prompts otimizados); fallback heurístico automático em caso de falha.
- Uso e custo da chamada gravados em `ai_usage_logs` via `logAIUsage`, já existente.
- Persistência: o registro em `prompt_optimizations` passa a guardar o texto vindo da IA; nenhuma mudança de schema é necessária (opcionalmente, o motor usado pode ser anexado ao texto/reconhecido pelo marcador de seção).
- UI: etiqueta de origem ("Otimizado por IA" / fallback) em `src/components/AnalysisReport.tsx`; sem seletor novo na tela de análise.
