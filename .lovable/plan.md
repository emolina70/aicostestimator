# Plano: Otimização de prompts com chave OpenAI por usuário (BYOK)

## Objetivo
Garantir que, ao liberar a aplicação para outros usuários, **ninguém consuma a conta OpenAI do administrador**. Cada usuário passa a usar a própria chave OpenAI, criptografada em repouso e isolada por usuário. A chave global do projeto (`OPENAI_API_KEY`) deixa de ser usada para otimização.

## Comportamento padrão escolhido
Cada usuário traz a própria chave (BYOK). Sem chave configurada, a tela de otimização mostra um aviso direcionando para Configurações. **Não há mais fallback automático para a chave compartilhada nem para o Lovable Gateway** — o gateway consumiria créditos do workspace do admin, o que volta a quebrar o isolamento. (O motor heurístico de otimização, sem custo, pode permanecer como fallback final opcional — decisão de UI.)

## Passos de implementação

### 1. Migração: tabela `public.user_api_keys`
```sql
create table public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  encrypted_key text not null,           -- AES-256-GCM (iv + ciphertext + tag), base64
  key_hint text not null default '',     -- ex.: "sk-...AB12" — últimos 4 chars, nunca a chave inteira
  model text not null default 'gpt-4.1',
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.user_api_keys to authenticated;
grant all on public.user_api_keys to service_role;
alter table public.user_api_keys enable row level security;
create policy "user owns own key" on public.user_api_keys
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
```
RLS garante que cada usuário só vê a própria linha.

### 2. Segredo de criptografia
Gerar `USER_KEY_ENCRYPTION_KEY` (32 bytes, via `generate_secret`) — chave mestra do projeto, lida apenas no backend, usada para criptografar/descriptografar as chaves OpenAI dos usuários. Nunca exposta ao navegador.

### 3. Backend: `src/lib/ai/user-keys.server.ts` (server-only)
- `encryptKey(plaintext, masterKey)` / `decryptKey(encrypted, masterKey)` com AES-256-GCM (Web Crypto `crypto.subtle`, disponível no Worker runtime).
- `getUserOpenAIKey(supabase, userId)`: busca a linha de `user_api_keys`, descriptografa, retorna `{ apiKey, model }` ou `null`.
- `upsertUserOpenAIKey(supabase, userId, plaintext, model)`: criptografa, salva `key_hint` (últimos 4 chars), faz upsert.
- `clearUserOpenAIKey(supabase, userId)`: delete.

### 4. Server functions: `src/lib/api-key.functions.ts`
- `saveOpenAIKey` (POST, auth): valida a chave (formato `sk-`, ≥ 20 chars), upsert.
- `getOpenAIKeyStatus` (GET, auth): retorna `{ configured: boolean, hint, model }` — **nunca** retorna a chave.
- `removeOpenAIKey` (DELETE, auth).
- `getOpenAIModels` estático: lista de modelos selecionáveis (gpt-4.1, gpt-4o, gpt-4o-mini, etc.).

### 5. Ajuste do motor de otimização
- `optimizeWithOpenAI(prompt)` em `src/lib/ai/openai.server.ts`: receber a chave do usuário por parâmetro (remover a leitura de `OPENAI_API_KEY` neste caminho).
- `optimizer.functions.ts`: buscar a chave do usuário via `getUserOpenAIKey`. Se ausente → erro `not_configured` com mensagem clara ("Configure sua chave OpenAI em Configurações"). Se a chave falhar (quota/inválida) → retornar o erro ao usuário, **sem** cair para a chave compartilhada nem para o gateway.
- Remover a dependência de `optimizeWithGateway` no fluxo de otimização (manter o arquivo para uso administrativo futuro, mas não chamar automaticamente).

### 6. UI: Configurações (`src/routes/_authenticated/settings.tsx`)
Novo card "Chave OpenAI":
- Se não configurada: campo de senha para colar a chave + seletor de modelo + botão "Salvar".
- Se configurada: badge "Configurada", mostra `key_hint` e modelo; botão "Substituir" (abre o campo) e "Remover".
- Nunca exibe a chave salva de volta.
- Texto explicativo: "Sua chave é usada apenas no backend, criptografada, e nunca enviada ao navegador. Cada otimização consome créditos da sua própria conta."

### 7. UI: Otimizar prompt (`src/routes/_optimize`)
- Ao carregar, consultar `getOpenAIKeyStatus`. Se `configured === false`, exibir banner no topo: "Você ainda não configurou sua chave OpenAI." com botão para ir a `/settings`.
- Manter o botão de otimização, mas ele retornará o erro `not_configured` se não houver chave — capturar e exibir como toast/banner.

### 8. Atualizar `openai_optimizations`
- Já existe. Continua gravando o `model` e tokens. Garantir que `model` reflita o modelo escolhido pelo usuário (não mais fixo `gpt-4.1`).

## Escopo excluído
- Não há cobrança/repasse de custo entre usuários.
- Não há chave compartilhada de admin para otimização.
- O Lovable AI Gateway deixa de ser fallback automático neste caminho.

## Riscos / observações
- Web Crypto AES-GCM funciona no runtime Worker (nodejs_compat). Validar com um teste real de salvar/otimizar.
- A chave mestra (`USER_KEY_ENCRYPTION_KEY`) é única por projeto; se rotacionada, as chaves dos usuários ficam indecifráveis — documentar isso no card de Configurações.
