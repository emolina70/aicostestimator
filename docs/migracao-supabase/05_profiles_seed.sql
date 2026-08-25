-- ============================================================
-- Inserção dos dados da tabela public.profiles
-- Execute APÓS rodar 01_schema.sql, 02_rls.sql, 03_functions.sql e 04_seed.sql.
-- ============================================================
--
-- IMPORTANTE — user_id:
-- O campo user_id referencia auth.users(id). No novo projeto, os IDs dos
-- usuários serão DIFERENTES (gen_random_uuid() no cadastro). Portanto:
--   1. Primeiro recrie/crie os usuários em auth.users (via Admin API ou
--      novo cadastro) e anote o NOVO id de cada usuário.
--   2. Substitua os valores de user_id abaixo pelos novos IDs.
--
-- IMPORTANTE — plan_id:
-- Aqui resolvemos plan_id por subconsulta em plans.code, então não importa
-- quais IDs os planos receberam no novo projeto. Se preferir, pode trocar a
-- subconsulta pelo UUID literal do plano.
-- ============================================================

-- IDs ORIGINAIS (para referência):
--   Eduardo  | user_id f3ac2e5b-d7a8-4884-a28f-42d47bc9ac9e | plano Free
--   Admin    | user_id e3b9a6f7-8b8d-456d-9a70-a5a93a98ed56 | plano Pro

insert into public.profiles (id, user_id, name, email, plan_id, created_at, updated_at) values
  (
    '64593de3-dc61-442b-b19b-af99f7196320',                              -- id (manter se quiser preservar)
    'f3ac2e5b-d7a8-4884-a28f-42d47bc9ac9e',                              -- user_id (TROQUE pelo novo auth.users.id)
    'Eduardo',
    'teste99674@gmail.com',
    (select id from public.plans where code = 'free'),                   -- plan_id resolvido por code
    '2026-08-12 14:49:24.853589+00',
    '2026-08-12 14:49:24.853589+00'
  ),
  (
    'b2bc6048-6ed9-4761-9340-334d4c447133',                              -- id
    'e3b9a6f7-8b8d-456d-9a70-a5a93a98ed56',                              -- user_id (TROQUE pelo novo auth.users.id)
    'Admin',
    'admin@admin.com',
    (select id from public.plans where code = 'pro'),                    -- plan_id resolvido por code
    '2026-08-12 16:04:53.809545+00',
    '2026-08-12 19:06:49.667207+00'
  )
on conflict (user_id) do update set
  name       = excluded.name,
  email      = excluded.email,
  plan_id    = excluded.plan_id,
  updated_at = excluded.updated_at;

-- ============================================================
-- Alternativa: se o trigger on_auth_user_created já cria o perfil
-- automaticamente no cadastro, basta ATUALIZAR o plano de cada
-- usuário recém-criado (sem precisar deste INSERT):
--
--   update public.profiles
--   set plan_id = (select id from public.plans where code = 'pro')
--   where email = 'admin@admin.com';
--
--   update public.profiles
--   set plan_id = (select id from public.plans where code = 'free')
--   where email = 'teste99674@gmail.com';
-- ============================================================
