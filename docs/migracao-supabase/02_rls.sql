-- ============================================================
-- Arquivo 2/4: GRANTs, RLS e políticas de acesso
-- ============================================================

-- 1) Função de verificação de papel (SECURITY DEFINER evita recursão de RLS)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- 2) GRANTs (obrigatórios: RLS sozinha não libera a Data API/PostgREST)
grant select, insert, update, delete on public.projects            to authenticated;
grant select, insert, update, delete on public.prompts             to authenticated;
grant select, insert, update, delete on public.prompt_analyses     to authenticated;
grant select, insert, update, delete on public.prompt_optimizations to authenticated;
grant select, insert, update, delete on public.actual_usage        to authenticated;
grant select, insert, update          on public.profiles           to authenticated;
grant select, insert, update, delete on public.plans               to authenticated;
grant select                          on public.plans              to anon;
grant select, insert, update, delete on public.estimator_parameters to authenticated;
grant select                          on public.user_roles         to authenticated;
grant select                          on public.usage_history      to authenticated;
grant select, insert                  on public.openai_optimizations to authenticated;
grant select                          on public.ai_usage_logs      to authenticated;

grant all on public.plans, public.profiles, public.user_roles, public.projects,
             public.prompts, public.prompt_analyses, public.prompt_optimizations,
             public.openai_optimizations, public.actual_usage, public.usage_history,
             public.estimator_parameters, public.ai_usage_logs
  to service_role;

-- 3) Habilitar RLS em todas as tabelas
alter table public.plans                enable row level security;
alter table public.profiles             enable row level security;
alter table public.user_roles           enable row level security;
alter table public.projects             enable row level security;
alter table public.prompts              enable row level security;
alter table public.prompt_analyses      enable row level security;
alter table public.prompt_optimizations enable row level security;
alter table public.openai_optimizations enable row level security;
alter table public.actual_usage         enable row level security;
alter table public.usage_history        enable row level security;
alter table public.estimator_parameters enable row level security;
alter table public.ai_usage_logs        enable row level security;

-- 4) Políticas ------------------------------------------------

-- plans: catálogo público (somente planos ativos); admin gerencia
create policy "plans readable" on public.plans
  for select using (active);
create policy "admins manage plans" on public.plans
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- profiles: cada usuário só enxerga/edita o próprio perfil (sem delete)
create policy "own profile select" on public.profiles
  for select to authenticated using (auth.uid() = user_id);
create policy "own profile insert" on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy "own profile update" on public.profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_roles: leitura do próprio papel; escrita apenas via service_role
create policy "read own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

-- dados do usuário: acesso total apenas aos próprios registros
create policy "own projects" on public.projects
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own prompts" on public.prompts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own analyses" on public.prompt_analyses
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own optimizations" on public.prompt_optimizations
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own actual usage" on public.actual_usage
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- openai_optimizations: usuário lê/insere os seus; admin lê todos
create policy "own openai optimizations select" on public.openai_optimizations
  for select to authenticated using (auth.uid() = user_id);
create policy "own openai optimizations insert" on public.openai_optimizations
  for insert to authenticated with check (auth.uid() = user_id);
create policy "admins read openai optimizations" on public.openai_optimizations
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- usage_history: somente leitura própria (escrita via função increment_usage)
create policy "own usage history" on public.usage_history
  for select to authenticated using (auth.uid() = user_id);

-- estimator_parameters: leitura dos ativos; escrita só admin
create policy "params readable" on public.estimator_parameters
  for select to authenticated using (active);
create policy "admins manage params" on public.estimator_parameters
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ai_usage_logs: leitura própria e leitura total para admin (escrita via service_role)
create policy "own ai usage select" on public.ai_usage_logs
  for select to authenticated using (auth.uid() = user_id);
create policy "admins read ai usage" on public.ai_usage_logs
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
