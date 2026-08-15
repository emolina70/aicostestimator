CREATE TABLE public.openai_optimizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prompt_id uuid REFERENCES public.prompts(id) ON DELETE SET NULL,
  original_prompt text NOT NULL,
  optimized_prompt text,
  analysis text,
  improvements jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_information jsonb NOT NULL DEFAULT '[]'::jsonb,
  quality_score_before integer,
  quality_score_after integer,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.openai_optimizations TO authenticated;
GRANT ALL ON public.openai_optimizations TO service_role;

ALTER TABLE public.openai_optimizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own openai optimizations select" ON public.openai_optimizations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own openai optimizations insert" ON public.openai_optimizations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins read openai optimizations" ON public.openai_optimizations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX openai_optimizations_user_created_idx ON public.openai_optimizations (user_id, created_at DESC);