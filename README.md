# AI Cost Estimator

Crie uma aplicação SaaS chamada "AI Dev Cost Optimizer"

1. OBJETIVO DO PRODUTO

Crie uma aplicação SaaS web responsiva cujo objetivo seja analisar prompts destinados a ferramentas de desenvolvimento assistido por IA, inicialmente com foco no Lovable, estimando antecipadamente o possível consumo de créditos necessário para executar o prompt.

A aplicação NÃO deve afirmar que consegue prever o consumo exato de créditos.

Ela deve apresentar uma ESTIMATIVA probabilística, mostrando:

consumo mínimo provável;

consumo mais provável;

consumo máximo provável;

nível de confiança da estimativa;

nível de complexidade;

fatores que influenciaram a estimativa;

recomendações para reduzir a complexidade;

possibilidade de dividir o prompt em etapas;

versão otimizada do prompt.

O sistema deverá ser projetado para futuramente suportar outras plataformas de desenvolvimento por IA, como Cursor, Claude Code, GitHub Copilot, OpenAI Codex e outras.

Portanto, não crie uma arquitetura rigidamente dependente do Lovable.

2. TECNOLOGIAS

Utilize:

React;

TypeScript;

Vite;

Tailwind CSS;

shadcn/ui;

Supabase;

PostgreSQL;

Supabase Authentication;

Supabase Row Level Security;

Supabase Edge Functions quando necessário;

arquitetura preparada para integração com APIs externas de IA.

A aplicação deve ser totalmente responsiva para desktop, tablet e smartphone.

3. ARQUITETURA

Separar claramente:

Frontend

Responsável por:

interface;

formulários;

dashboards;

apresentação das análises;

gerenciamento de estado;

validações básicas.

Backend / Supabase

Responsável por:

autenticação;

persistência;

histórico;

configurações;

controle de usuários;

controle de planos;

métricas;

segurança;

chamadas para APIs externas;

lógica que não deve ficar exposta no navegador.

NUNCA expor chaves de API de provedores de IA no frontend.

Todas as chaves e secrets devem ser armazenadas como secrets/environment variables no backend.

4. AUTENTICAÇÃO

Implementar autenticação utilizando Supabase Auth.

Permitir:

cadastro;

login;

logout;

recuperação de senha;

alteração de senha;

perfil do usuário.

Criar estrutura preparada para:

usuário;

plano;

limite de análises;

consumo mensal.

Inicialmente implementar:

FREE

Limite de 5 análises por mês.

STARTER

Limite de 100 análises por mês.

PRO

Análises ampliadas e histórico completo.

Não implementar cobrança real inicialmente.

A arquitetura deverá ficar preparada para futura integração com Stripe ou outro gateway.

5. BANCO DE DADOS

Criar tabelas adequadamente normalizadas.

Sugestão inicial:

profiles

Campos:

id

user_id

name

email

plan_id

created_at

updated_at

plans

Campos:

id

name

monthly_analysis_limit

active

created_at

updated_at

projects

Campos:

id

user_id

name

description

platform

created_at

updated_at

prompts

Campos:

id

user_id

project_id

title

content

platform

created_at

updated_at

prompt_analyses

Campos:

id

prompt_id

complexity_score

confidence_score

estimated_min

estimated_expected

estimated_max

frontend_score

backend_score

database_score

authentication_score

integration_score

logic_score

estimated_entities

estimated_operations

recommendation

created_at

prompt_optimizations

Campos:

id

prompt_id

original_prompt

optimized_prompt

estimated_original

estimated_optimized

estimated_reduction_percentage

created_at

actual_usage

Campos:

id

prompt_id

actual_credits

execution_date

notes

created_at

estimator_parameters

Campos:

id

parameter_name

parameter_value

description

active

updated_at

usage_history

Registrar análises realizadas pelo usuário.

Utilizar UUIDs como identificadores.

Criar índices adequados.

6. ROW LEVEL SECURITY

Implementar RLS no Supabase.

Um usuário somente poderá acessar:

seus próprios projetos;

seus próprios prompts;

suas próprias análises;

seus próprios registros de consumo;

seu próprio histórico.

Dados administrativos deverão ser protegidos.

Não confiar apenas nas validações do frontend.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://aicostestimator.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ed6a7718-e4a6-4929-ae21-0ba60f791598).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
