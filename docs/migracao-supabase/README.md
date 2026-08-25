# Migração do banco para um Supabase externo

Scripts nesta pasta (execute **nesta ordem**, no SQL Editor do novo projeto):

| Ordem | Arquivo | Conteúdo |
|---|---|---|
| 1 | `01_schema.sql` | extensões, enum `app_role`, 12 tabelas, índices, triggers de `updated_at` |
| 2 | `02_rls.sql` | função `has_role`, GRANTs, RLS e todas as políticas |
| 3 | `03_functions.sql` | `increment_usage`, `handle_new_user` e trigger em `auth.users` |
| 4 | `04_seed.sql` | planos (Free/Starter/Pro) e 52 parâmetros do estimador |

## Passo a passo

1. **Crie o novo projeto** no Supabase (escolha a região mais próxima dos usuários) e guarde a senha do banco.
2. **Rode os scripts 01 → 04** no SQL Editor, um de cada vez, conferindo que cada um termina sem erro.
   - O script 03 cria um trigger no schema `auth`; isso só funciona pelo SQL Editor do painel (role privilegiada).
3. **Configure a autenticação** em Authentication → Providers:
   - Email/senha habilitado; confirmação de e-mail conforme sua preferência.
   - Em Authentication → URL Configuration, defina **Site URL** e **Redirect URLs** com o domínio da aplicação.
4. **Migre os usuários** (opcional). O `auth.users` do projeto atual não é exportável por SQL comum:
   - Melhor prática: peça aos usuários que refaçam o cadastro (o trigger cria perfil + papel automaticamente); ou
   - Use a Admin API do novo projeto (`POST /auth/v1/admin/users` com a `service_role key`) para recriar contas e depois dispare "recuperar senha".
   - Se recriar usuários com **novos IDs**, os dados antigos (que referenciam `user_id`) precisarão ser remapeados.
5. **Migre os dados** (opcional). Exporte por tabela e importe respeitando a ordem de dependências:
   `plans → profiles → user_roles → projects → prompts → prompt_analyses → prompt_optimizations → openai_optimizations → actual_usage → usage_history → estimator_parameters → ai_usage_logs`.
   Exemplo por tabela:
   ```bash
   # origem
   psql "$ORIGEM_URL" -c "\copy (select * from public.prompts) to 'prompts.csv' csv header"
   # destino
   psql "$DESTINO_URL" -c "\copy public.prompts from 'prompts.csv' csv header"
   ```
   Importe como `postgres`/`service_role` (a RLS não bloqueia esses papéis).
6. **Aponte a aplicação** para o novo projeto: atualize `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID`, além dos secrets de servidor (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
7. **Recrie os secrets de IA** usados pelo backend (ex.: chave do provedor de IA) no novo ambiente.
8. **Valide**: crie um usuário de teste e confirme que (a) perfil e papel `user` são criados, (b) uma análise é salva, (c) o limite mensal do plano funciona, (d) um usuário não enxerga dados de outro.

## Boas práticas

- **Nunca** guarde papéis (`admin`) na tabela `profiles`: eles ficam em `user_roles` e são lidos pela função `has_role` (SECURITY DEFINER), evitando recursão de RLS e escalonamento de privilégio.
- **GRANT + RLS sempre juntos**: sem `GRANT`, a Data API retorna erro de permissão mesmo com políticas corretas.
- Escrita em `usage_history` e `ai_usage_logs` é intencionalmente feita só por funções `security definer` / `service_role`.
- A `service_role key` só pode existir no servidor — nunca no bundle do navegador.
- Faça backup (Database → Backups) antes de qualquer reimportação e valide em um projeto de staging primeiro.
- Depois de estabilizar, ative Point-in-Time Recovery e rode o Database Linter do Supabase.

## Criar um administrador

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'seu-email@exemplo.com'
on conflict do nothing;
```
