ALTER TABLE public.user_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scores"
  ON public.user_scores FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scores"
  ON public.user_scores FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scores"
  ON public.user_scores FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scores"
  ON public.user_scores FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own practice logs"
  ON public.practice_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own practice logs"
  ON public.practice_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.user_scores s
    WHERE s.id = practice_logs.score_id AND s.user_id = auth.uid()
  ));
