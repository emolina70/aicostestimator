# Plano: Otimização de prompts nativa do Lovable (sem conta OpenAI)

## Resposta curta
Sim. O projeto já tem acesso ao motor de IA da própria plataforma Lovable, que roda modelos de última geração sem exigir conta, chave ou créditos da OpenAI. Esse caminho já existe no código como plano B (`optimizeWithGateway`); o plano é **promovê-lo a caminho principal** e aposentar a dependência da chave pessoal da OpenAI.

## O que muda para você
- Nenhum usuário precisa de conta OpenAI, e você também não.
- O custo passa a ser consumo de créditos do próprio workspace Lovable, medido e visível.
- A tela "Otimizar prompt" deixa de quebrar por falta de créditos na OpenAI.
- A qualidade da otimização sobe: o modelo usado é mais recente que o `gpt-4.1` da configuração atual.

## Escopo da implementação

### 1. Inverter a ordem do motor de otimização
Em `src/lib/optimizer.functions.ts`:
- Caminho principal passa a ser o motor Lovable (`optimizeWithGateway`).
- A chave própria da OpenAI vira **opcional**: se `OPENAI_API_KEY` estiver configurada e o administrador ativar a preferência, ela é usada; caso contrário, nem é tentada (hoje ela é sempre tentada e falha antes do fallback, gastando tempo em toda requisição).
- Se o motor Lovable falhar, o motor heurístico local (`buildOptimizedPrompt` em `src/lib/estimator.ts`) entra como último recurso, garantindo que a tela nunca fique sem resposta.

### 2. Elevar o modelo e ativar raciocínio
Em `src/lib/ai/openai.server.ts` (função do gateway):
- Manter o modelo `openai/gpt-5.6-sol` e a chamada em streaming já existente.
- Remover qualquer limite de tempo artificial na chamada — otimizações de prompts longos (até 120k caracteres) podem levar minutos e não devem ser abortadas.
- Manter o schema JSON estrito atual (`optimized_prompt`, `analysis`, `improvements`, `missing_information`, notas antes/depois).

### 3. Enriquecer as instruções do otimizador
Ampliar o `SYSTEM_INSTRUCTIONS` para que o prompt gerado contemple, quando aplicável ao pedido do usuário, o conjunto completo do que um sistema costuma exigir:
- objetivo e contexto de negócio;
- perfis de usuário, permissões e regras de acesso;
- modelo de dados e relacionamentos;
- autenticação, segurança e isolamento de dados;
- validações, tratamento de erros e estados vazios;
- interface, responsividade e acessibilidade;
- integrações externas e variáveis sensíveis;
- ordem de execução em etapas;
- critérios de aceitação verificáveis.

Regra preservada: nunca inventar requisito de negócio. O que faltar vai para "informações faltantes", como já acontece hoje.

### 4. Ajustes de interface
- `src/routes/_authenticated/optimize.tsx`: substituir qualquer menção a "OpenAI" por "IA do Lovable"; mostrar selo indicando qual motor produziu o resultado (Lovable / OpenAI própria / regras locais).
- Ajustar as mensagens de erro em `FRIENDLY_ERROR` para o novo contexto (sem "contate o administrador para configurar a OpenAI").
- Manter o botão "Estimar créditos" que leva o prompt otimizado para a tela de análise.

### 5. Controle de consumo por usuário
Como o custo agora é do workspace, adicionar um limite de otimizações por plano, espelhando o que já existe para análises:
- Free: 5 otimizações/mês; Starter: 100; Pro: 1.000.
- Contagem lida da tabela `openai_optimizations` (registros de sucesso do mês corrente).
- Botão desabilitado com aviso claro ao atingir o limite, no mesmo padrão já usado na tela de análise.

### 6. Registro e histórico
A tabela `openai_optimizations` continua sendo usada sem mudança de estrutura; o campo `model` passa a registrar o motor efetivamente usado, permitindo auditar no painel administrativo qual motor atendeu cada otimização.

## Detalhes técnicos
- Chamada ao gateway em `https://ai.gateway.lovable.dev/v1/responses`, autenticada pelo cabeçalho `Lovable-API-Key`, com `stream: true` e `store: false`, exatamente como já implementado.
- Modelo: `openai/gpt-5.6-sol`.
- Todo o tratamento permanece server-side (`*.server.ts`); nenhuma chave chega ao navegador.
- Erros 429 (limite) e 402 (créditos do workspace esgotados) são tratados e exibidos com mensagem específica.

## Fora do escopo
- Não haverá pedido de chave OpenAI a nenhum usuário.
- A `OPENAI_API_KEY` existente permanece salva, apenas deixa de ser obrigatória.
