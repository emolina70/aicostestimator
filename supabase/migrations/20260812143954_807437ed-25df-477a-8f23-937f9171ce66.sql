-- roles
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- plans
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  monthly_analysis_limit integer NOT NULL DEFAULT 5,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated;
GRANT SELECT ON public.plans TO anon;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable" ON public.plans FOR SELECT USING (active);
CREATE POLICY "admins manage plans" ON public.plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.plans (code,name,monthly_analysis_limit) VALUES
  ('free','Free',5),('starter','Starter',100),('pro','Pro',1000);

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  name text,
  email text,
  plan_id uuid REFERENCES public.plans(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, plan_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), NEW.email,
          (SELECT id FROM public.plans WHERE code = 'free'))
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id,'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- projects
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  platform text NOT NULL DEFAULT 'lovable',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own projects" ON public.projects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX projects_user_idx ON public.projects(user_id);
CREATE TRIGGER projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- prompts
CREATE TABLE public.prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  platform text NOT NULL DEFAULT 'lovable',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompts TO authenticated;
GRANT ALL ON public.prompts TO service_role;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prompts" ON public.prompts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX prompts_user_idx ON public.prompts(user_id, created_at DESC);
CREATE INDEX prompts_project_idx ON public.prompts(project_id);
CREATE TRIGGER prompts_updated BEFORE UPDATE ON public.prompts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- prompt_analyses
CREATE TABLE public.prompt_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  platform text NOT NULL DEFAULT 'lovable',
  complexity_score numeric NOT NULL DEFAULT 0,
  confidence_score numeric NOT NULL DEFAULT 0,
  estimated_min numeric NOT NULL DEFAULT 0,
  estimated_expected numeric NOT NULL DEFAULT 0,
  estimated_max numeric NOT NULL DEFAULT 0,
  frontend_score numeric NOT NULL DEFAULT 0,
  backend_score numeric NOT NULL DEFAULT 0,
  database_score numeric NOT NULL DEFAULT 0,
  authentication_score numeric NOT NULL DEFAULT 0,
  integration_score numeric NOT NULL DEFAULT 0,
  logic_score numeric NOT NULL DEFAULT 0,
  estimated_entities integer NOT NULL DEFAULT 0,
  estimated_operations integer NOT NULL DEFAULT 0,
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_analyses TO authenticated;
GRANT ALL ON public.prompt_analyses TO service_role;
ALTER TABLE public.prompt_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own analyses" ON public.prompt_analyses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX analyses_user_idx ON public.prompt_analyses(user_id, created_at DESC);
CREATE INDEX analyses_prompt_idx ON public.prompt_analyses(prompt_id);

-- prompt_optimizations
CREATE TABLE public.prompt_optimizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  original_prompt text NOT NULL,
  optimized_prompt text NOT NULL,
  estimated_original numeric NOT NULL DEFAULT 0,
  estimated_optimized numeric NOT NULL DEFAULT 0,
  estimated_reduction_percentage numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_optimizations TO authenticated;
GRANT ALL ON public.prompt_optimizations TO service_role;
ALTER TABLE public.prompt_optimizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own optimizations" ON public.prompt_optimizations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX optimizations_prompt_idx ON public.prompt_optimizations(prompt_id);

-- actual_usage
CREATE TABLE public.actual_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  actual_credits numeric NOT NULL,
  execution_date date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.actual_usage TO authenticated;
GRANT ALL ON public.actual_usage TO service_role;
ALTER TABLE public.actual_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own actual usage" ON public.actual_usage FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX actual_usage_prompt_idx ON public.actual_usage(prompt_id);

-- usage_history
CREATE TABLE public.usage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_month date NOT NULL,
  analyses_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_month)
);
GRANT SELECT ON public.usage_history TO authenticated;
GRANT ALL ON public.usage_history TO service_role;
ALTER TABLE public.usage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own usage history" ON public.usage_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER usage_history_updated BEFORE UPDATE ON public.usage_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- estimator_parameters
CREATE TABLE public.estimator_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'lovable',
  parameter_name text NOT NULL,
  parameter_value numeric NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, parameter_name)
);
GRANT SELECT ON public.estimator_parameters TO authenticated;
GRANT ALL ON public.estimator_parameters TO service_role;
ALTER TABLE public.estimator_parameters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "params readable" ON public.estimator_parameters FOR SELECT TO authenticated USING (active);
CREATE POLICY "admins manage params" ON public.estimator_parameters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER params_updated BEFORE UPDATE ON public.estimator_parameters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.estimator_parameters (platform, parameter_name, parameter_value, description) VALUES
  ('lovable','base_credits',1.0,'Custo base de qualquer prompt'),
  ('lovable','credits_per_complexity_point',0.28,'Créditos adicionais por ponto de complexidade'),
  ('lovable','min_factor',0.6,'Multiplicador do cenário mínimo'),
  ('lovable','max_factor',1.9,'Multiplicador do cenário máximo');

-- counter function used by server-side analysis
CREATE OR REPLACE FUNCTION public.increment_usage(_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count integer;
BEGIN
  INSERT INTO public.usage_history (user_id, period_month, analyses_count)
  VALUES (_user_id, date_trunc('month', now())::date, 1)
  ON CONFLICT (user_id, period_month)
  DO UPDATE SET analyses_count = public.usage_history.analyses_count + 1
  RETURNING analyses_count INTO _count;
  RETURN _count;
END; $$;