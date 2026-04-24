DROP POLICY IF EXISTS "Users can view their own logs" ON public.user_note_logs;
DROP POLICY IF EXISTS "Users can insert their own logs" ON public.user_note_logs;

CREATE POLICY "Users can view their own logs"
ON public.user_note_logs
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own logs"
ON public.user_note_logs
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);