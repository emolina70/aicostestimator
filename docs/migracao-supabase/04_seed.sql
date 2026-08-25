-- ============================================================
-- Arquivo 4/4: Dados obrigatórios (planos e parâmetros do estimador)
-- ============================================================

insert into public.plans (code, name, monthly_analysis_limit, active) values
  ('free','Free',5,true),
  ('starter','Starter',100,true),
  ('pro','Pro',1000,true)
on conflict (code) do update set
  name = excluded.name,
  monthly_analysis_limit = excluded.monthly_analysis_limit,
  active = excluded.active;

insert into public.estimator_parameters (platform, parameter_name, parameter_value, description, active) values
  ('claude-code','authentication_weight',0.14,'Peso da dimensão Autenticação no score de complexidade',true),
  ('claude-code','backend_weight',0.20,'Peso da dimensão Backend no score de complexidade',true),
  ('claude-code','complexity_weight',0.62,'Peso geral do score ponderado das dimensões',true),
  ('claude-code','crud_weight',1.00,'Multiplicador aplicado aos sinais de CRUD/entidades',true),
  ('claude-code','database_weight',0.20,'Peso da dimensão Banco de dados no score de complexidade',true),
  ('claude-code','frontend_weight',0.18,'Peso da dimensão Frontend no score de complexidade',true),
  ('claude-code','integration_weight',0.16,'Peso da dimensão Integrações no score de complexidade',true),
  ('claude-code','logic_weight',0.12,'Peso da dimensão Lógica no score de complexidade',true),
  ('codex','authentication_weight',0.14,'Peso da dimensão Autenticação no score de complexidade',true),
  ('codex','backend_weight',0.20,'Peso da dimensão Backend no score de complexidade',true),
  ('codex','complexity_weight',0.62,'Peso geral do score ponderado das dimensões',true),
  ('codex','crud_weight',1.00,'Multiplicador aplicado aos sinais de CRUD/entidades',true),
  ('codex','database_weight',0.20,'Peso da dimensão Banco de dados no score de complexidade',true),
  ('codex','frontend_weight',0.18,'Peso da dimensão Frontend no score de complexidade',true),
  ('codex','integration_weight',0.16,'Peso da dimensão Integrações no score de complexidade',true),
  ('codex','logic_weight',0.12,'Peso da dimensão Lógica no score de complexidade',true),
  ('copilot','authentication_weight',0.14,'Peso da dimensão Autenticação no score de complexidade',true),
  ('copilot','backend_weight',0.20,'Peso da dimensão Backend no score de complexidade',true),
  ('copilot','complexity_weight',0.62,'Peso geral do score ponderado das dimensões',true),
  ('copilot','crud_weight',1.00,'Multiplicador aplicado aos sinais de CRUD/entidades',true),
  ('copilot','database_weight',0.20,'Peso da dimensão Banco de dados no score de complexidade',true),
  ('copilot','frontend_weight',0.18,'Peso da dimensão Frontend no score de complexidade',true),
  ('copilot','integration_weight',0.16,'Peso da dimensão Integrações no score de complexidade',true),
  ('copilot','logic_weight',0.12,'Peso da dimensão Lógica no score de complexidade',true),
  ('cursor','authentication_weight',0.14,'Peso da dimensão Autenticação no score de complexidade',true),
  ('cursor','backend_weight',0.20,'Peso da dimensão Backend no score de complexidade',true),
  ('cursor','complexity_weight',0.62,'Peso geral do score ponderado das dimensões',true),
  ('cursor','crud_weight',1.00,'Multiplicador aplicado aos sinais de CRUD/entidades',true),
  ('cursor','database_weight',0.20,'Peso da dimensão Banco de dados no score de complexidade',true),
  ('cursor','frontend_weight',0.18,'Peso da dimensão Frontend no score de complexidade',true),
  ('cursor','integration_weight',0.16,'Peso da dimensão Integrações no score de complexidade',true),
  ('cursor','logic_weight',0.12,'Peso da dimensão Lógica no score de complexidade',true),
  ('lovable','authentication_weight',0.14,'Peso da dimensão Autenticação no score de complexidade',true),
  ('lovable','backend_weight',0.20,'Peso da dimensão Backend no score de complexidade',true),
  ('lovable','base_credits',1.0,'Custo base de qualquer prompt',true),
  ('lovable','complexity_weight',0.62,'Peso geral do score ponderado das dimensões',true),
  ('lovable','credits_per_complexity_point',0.28,'Créditos adicionais por ponto de complexidade',true),
  ('lovable','crud_weight',1.00,'Multiplicador aplicado aos sinais de CRUD/entidades',true),
  ('lovable','database_weight',0.20,'Peso da dimensão Banco de dados no score de complexidade',true),
  ('lovable','frontend_weight',0.18,'Peso da dimensão Frontend no score de complexidade',true),
  ('lovable','integration_weight',0.16,'Peso da dimensão Integrações no score de complexidade',true),
  ('lovable','logic_weight',0.12,'Peso da dimensão Lógica no score de complexidade',true),
  ('lovable','max_factor',1.9,'Multiplicador do cenário máximo',true),
  ('lovable','min_factor',0.6,'Multiplicador do cenário mínimo',true),
  ('other','authentication_weight',0.14,'Peso da dimensão Autenticação no score de complexidade',true),
  ('other','backend_weight',0.20,'Peso da dimensão Backend no score de complexidade',true),
  ('other','complexity_weight',0.62,'Peso geral do score ponderado das dimensões',true),
  ('other','crud_weight',1.00,'Multiplicador aplicado aos sinais de CRUD/entidades',true),
  ('other','database_weight',0.20,'Peso da dimensão Banco de dados no score de complexidade',true),
  ('other','frontend_weight',0.18,'Peso da dimensão Frontend no score de complexidade',true),
  ('other','integration_weight',0.16,'Peso da dimensão Integrações no score de complexidade',true),
  ('other','logic_weight',0.12,'Peso da dimensão Lógica no score de complexidade',true);

-- Reaplicando com upsert (execute esta versão se a tabela já tiver dados):
-- on conflict (platform, parameter_name) do update set parameter_value = excluded.parameter_value;
