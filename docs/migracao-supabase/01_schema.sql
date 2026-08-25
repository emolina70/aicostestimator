-- ============================================================
-- AI Dev Cost Optimizer — Migração para Supabase externo
-- Arquivo 1/4: Extensões, tipos, funções e tabelas
-- Execute no SQL Editor do novo projeto Supabase, na ordem 01 -> 04.
-- ============================================================

-- 1) Extensões -------------------------------------------------
create extension if not exists pgcrypto with schema extensions;   -- gen_random_uuid()

-- 2) Tipos -----------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'user');
  end if;
end $$;

-- 3) Funções utilitárias --------------------------------------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 4) Tabelas ---------------------------------------------------

-- 4.1 plans
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  monthly_analysis_limit integer not null default 5,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4.2 profiles (1:1 com auth.users, sem FK para auth.users)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  name text,
  email text,
  plan_id uuid references public.plans(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4.3 user_roles (papéis SEMPRE em tabela separada — evita escalonamento de privilégio)
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- 4.4 projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  description text,
  platform text not null default 'lovable',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4.5 prompts
create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  content text not null,
  platform text not null default 'lovable',
  task_type text not null default 'other',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4.6 prompt_analyses
create table if not exists public.prompt_analyses (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  user_id uuid not null,
  platform text not null default 'lovable',
  task_type text not null default 'other',
  complexity_score numeric not null default 0,
  confidence_score numeric not null default 0,
  estimated_min numeric not null default 0,
  estimated_expected numeric not null default 0,
  estimated_max numeric not null default 0,
  frontend_score numeric not null default 0,
  backend_score numeric not null default 0,
  database_score numeric not null default 0,
  authentication_score numeric not null default 0,
  integration_score numeric not null default 0,
  logic_score numeric not null default 0,
  estimated_entities integer not null default 0,
  estimated_operations integer not null default 0,
  factors jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  recommendation text,
  created_at timestamptz not null default now()
);

-- 4.7 prompt_optimizations
create table if not exists public.prompt_optimizations (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  user_id uuid not null,
  original_prompt text not null,
  optimized_prompt text not null,
  estimated_original numeric not null default 0,
  estimated_optimized numeric not null default 0,
  estimated_reduction_percentage numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 4.8 openai_optimizations (histórico das otimizações por IA)
create table if not exists public.openai_optimizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  prompt_id uuid references public.prompts(id) on delete set null,
  original_prompt text not null,
  optimized_prompt text,
  analysis text,
  improvements jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  quality_score_before integer,
  quality_score_after integer,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  duration_ms integer not null default 0,
  status text not null default 'success',
  error_message text,
  created_at timestamptz not null default now()
);

-- 4.9 actual_usage (consumo real informado pelo usuário)
create table if not exists public.actual_usage (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  user_id uuid not null,
  actual_credits numeric not null,
  execution_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

-- 4.10 usage_history (consumo mensal de análises)
create table if not exists public.usage_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  period_month date not null,
  analyses_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_month)
);

-- 4.11 estimator_parameters (calibração do motor de estimativa)
create table if not exists public.estimator_parameters (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'lovable',
  parameter_name text not null,
  parameter_value numeric not null,
  description text,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (platform, parameter_name)
);

-- 4.12 ai_usage_logs (telemetria de chamadas de IA)
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null,
  model text not null,
  operation text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 5) Índices ---------------------------------------------------
create index if not exists projects_user_idx on public.projects (user_id);
create index if not exists prompts_user_idx on public.prompts (user_id, created_at desc);
create index if not exists prompts_project_idx on public.prompts (project_id);
create index if not exists analyses_user_idx on public.prompt_analyses (user_id, created_at desc);
create index if not exists analyses_prompt_idx on public.prompt_analyses (prompt_id);
create index if not exists optimizations_prompt_idx on public.prompt_optimizations (prompt_id);
create index if not exists actual_usage_prompt_idx on public.actual_usage (prompt_id);
create index if not exists openai_optimizations_user_created_idx on public.openai_optimizations (user_id, created_at desc);

-- 6) Triggers de updated_at ------------------------------------
drop trigger if exists plans_updated on public.plans;
create trigger plans_updated before update on public.plans
  for each row execute function public.update_updated_at_column();

drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated before update on public.profiles
  for each row execute function public.update_updated_at_column();

drop trigger if exists projects_updated on public.projects;
create trigger projects_updated before update on public.projects
  for each row execute function public.update_updated_at_column();

drop trigger if exists prompts_updated on public.prompts;
create trigger prompts_updated before update on public.prompts
  for each row execute function public.update_updated_at_column();

drop trigger if exists usage_history_updated on public.usage_history;
create trigger usage_history_updated before update on public.usage_history
  for each row execute function public.update_updated_at_column();

drop trigger if exists params_updated on public.estimator_parameters;
create trigger params_updated before update on public.estimator_parameters
  for each row execute function public.update_updated_at_column();
