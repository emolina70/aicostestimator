-- ============================================================
-- Arquivo 3/4: Funções de negócio e trigger de novos usuários
-- ============================================================

-- 1) Contador mensal de análises (bypassa RLS de propósito)
create or replace function public.increment_usage(_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare _count integer;
begin
  insert into public.usage_history (user_id, period_month, analyses_count)
  values (_user_id, date_trunc('month', now())::date, 1)
  on conflict (user_id, period_month)
  do update set analyses_count = public.usage_history.analyses_count + 1
  returning analyses_count into _count;
  return _count;
end;
$$;

grant execute on function public.increment_usage(uuid) to authenticated, service_role;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, anon, service_role;

-- 2) Provisionamento automático de perfil + papel no cadastro
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, name, email, plan_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    (select id from public.plans where code = 'free')
  )
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict do nothing;

  return new;
end;
$$;

-- 3) Trigger em auth.users (executar com o owner do projeto / SQL Editor)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
