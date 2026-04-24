CREATE TABLE public.user_custom_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score_title TEXT NOT NULL,
  note_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_custom_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scores"
  ON public.user_custom_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scores"
  ON public.user_custom_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scores"
  ON public.user_custom_scores FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scores"
  ON public.user_custom_scores FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_custom_scores_user_id ON public.user_custom_scores(user_id);