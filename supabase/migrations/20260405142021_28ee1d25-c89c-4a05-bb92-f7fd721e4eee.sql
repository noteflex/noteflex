CREATE TABLE public.user_note_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  note_key TEXT NOT NULL,
  octave INTEGER NOT NULL,
  clef TEXT NOT NULL DEFAULT 'treble',
  is_correct BOOLEAN NOT NULL,
  response_time NUMERIC(5,2),
  error_type TEXT,
  level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_note_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own logs"
ON public.user_note_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own logs"
ON public.user_note_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_note_logs_user_id ON public.user_note_logs(user_id);
CREATE INDEX idx_note_logs_created_at ON public.user_note_logs(created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_note_logs;