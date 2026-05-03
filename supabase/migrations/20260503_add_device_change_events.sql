-- §7.3 device change event logging (audio device 변경 → 자동 재측정 트리거 추적)

CREATE TABLE public.device_change_events (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_kinds   TEXT[]      NOT NULL,
  triggered_recalibration BOOLEAN NOT NULL DEFAULT FALSE,
  previous_offset_ms INTEGER,
  new_offset_ms  INTEGER,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_change_events_user_id
  ON public.device_change_events(user_id);
CREATE INDEX idx_device_change_events_event_at
  ON public.device_change_events(event_at DESC);

ALTER TABLE public.device_change_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own device change events"
  ON public.device_change_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own device change events"
  ON public.device_change_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all device change events"
  ON public.device_change_events FOR SELECT
  USING (public.is_admin());

COMMENT ON TABLE public.device_change_events IS
  'Audio/video device change events for calibration trigger analysis (§7.3 + §7.10). '
  'false positive 빈도 분석 후 audio output 전용 감지 보강 결정 (출시 후 PENDING).';
