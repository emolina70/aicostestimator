ALTER TABLE public.prompts ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  operation text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  estimated_cost numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own ai usage select" ON public.ai_usage_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "admins read ai usage" ON public.ai_usage_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Pesos ajustáveis do estimador para cada plataforma
INSERT INTO public.estimator_parameters (platform, parameter_name, parameter_value, description)
SELECT p.platform, w.name, w.value, w.descr
FROM (VALUES ('lovable'),('cursor'),('claude-code'),('copilot'),('codex'),('other')) AS p(platform)
CROSS JOIN (VALUES
  ('frontend_weight', 0.18, 'Peso da dimensão Frontend no score de complexidade'),
  ('backend_weight', 0.20, 'Peso da dimensão Backend no score de complexidade'),
  ('database_weight', 0.20, 'Peso da dimensão Banco de dados no score de complexidade'),
  ('authentication_weight', 0.14, 'Peso da dimensão Autenticação no score de complexidade'),
  ('integration_weight', 0.16, 'Peso da dimensão Integrações no score de complexidade'),
  ('logic_weight', 0.12, 'Peso da dimensão Lógica no score de complexidade'),
  ('crud_weight', 1.00, 'Multiplicador aplicado aos sinais de CRUD/entidades'),
  ('complexity_weight', 0.62, 'Peso geral do score ponderado das dimensões')
) AS w(name, value, descr)
WHERE NOT EXISTS (
  SELECT 1 FROM public.estimator_parameters e
  WHERE e.platform = p.platform AND e.parameter_name = w.name
);

-- Dados de demonstração (claramente marcados como DEMO) para usuários existentes
WITH demo(title, content, task_type, complexity, conf, emin, eexp, emax, fe, be, db, au, itg, lg, ents, ops, rec) AS (
  VALUES
    ('[DEMO] Alterar cor de botão', 'Alterar a cor do botão principal de salvar para o tom primário do design system.', 'change', 12, 88, 0.5, 0.9, 1.4, 30, 0, 0, 0, 0, 0, 1, 1, 'O prompt já está enxuto; mantenha um objetivo por execução.'),
    ('[DEMO] Criar cadastro de clientes', 'Criar tela de cadastro de clientes com formulário, validação de CPF e listagem com busca.', 'creation', 38, 80, 1.4, 2.6, 4.1, 44, 18, 46, 6, 0, 14, 2, 3, 'Descreva as tabelas e campos exatos para evitar remodelagens de banco.'),
    ('[DEMO] Criar CRUD de produtos', 'Criar CRUD completo de produtos com tabela no banco, filtros, edição e exclusão.', 'database', 46, 78, 1.8, 3.2, 5.0, 34, 14, 62, 6, 0, 12, 3, 5, 'Descreva as tabelas e campos exatos para evitar remodelagens de banco.'),
    ('[DEMO] Criar autenticação', 'Implementar autenticação com e-mail e senha, recuperação de senha, papéis de acesso e políticas de segurança por linha.', 'authentication', 55, 76, 2.1, 3.8, 6.0, 12, 10, 30, 74, 0, 16, 3, 4, 'Trate autenticação, papéis e RLS em uma etapa dedicada.'),
    ('[DEMO] Criar dashboard financeiro', 'Criar dashboard financeiro com KPIs, gráficos de receita e despesa, filtros por período e exportação em CSV.', 'dashboard', 62, 72, 2.4, 4.3, 7.1, 66, 12, 44, 6, 8, 30, 4, 6, 'Defina o design system antes de pedir várias telas de uma vez.'),
    ('[DEMO] Criar sistema de estoque', 'Criar sistema de estoque com entradas, saídas, saldo por produto, alertas de estoque mínimo e relatórios.', 'creation', 71, 66, 3.0, 5.2, 8.6, 48, 34, 62, 20, 10, 40, 5, 8, 'Divida o prompt em etapas menores e executáveis de forma independente.'),
    ('[DEMO] Criar sistema completo de compras', 'Criar sistema completo de compras com carrinho, checkout, pagamentos, autenticação, painel administrativo, notificações por e-mail e integração com API externa de frete.', 'creation', 88, 58, 4.2, 7.4, 12.6, 62, 58, 60, 56, 74, 44, 7, 12, 'Implemente integrações externas em um prompt separado, após o núcleo funcionar.')
),
new_prompts AS (
  INSERT INTO public.prompts (user_id, title, content, platform, task_type, is_demo, created_at)
  SELECT pr.user_id, d.title, d.content, 'lovable', d.task_type, true, now() - (row_number() OVER (PARTITION BY pr.user_id ORDER BY d.complexity) * interval '3 days')
  FROM public.profiles pr
  CROSS JOIN demo d
  WHERE NOT EXISTS (SELECT 1 FROM public.prompts p WHERE p.user_id = pr.user_id AND p.is_demo)
  RETURNING id, user_id, title, content, created_at
)
INSERT INTO public.prompt_analyses (
  prompt_id, user_id, platform, task_type, complexity_score, confidence_score,
  estimated_min, estimated_expected, estimated_max,
  frontend_score, backend_score, database_score, authentication_score, integration_score, logic_score,
  estimated_entities, estimated_operations, factors, steps, recommendation, created_at
)
SELECT np.id, np.user_id, 'lovable', d.task_type, d.complexity, d.conf,
       d.emin, d.eexp, d.emax,
       d.fe, d.be, d.db, d.au, d.itg, d.lg,
       d.ents, d.ops, '[]'::jsonb, '[]'::jsonb, d.rec, np.created_at
FROM new_prompts np
JOIN demo d ON d.title = np.title;