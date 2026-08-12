ALTER TABLE public.prompts ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'other';
ALTER TABLE public.prompt_analyses ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'other';