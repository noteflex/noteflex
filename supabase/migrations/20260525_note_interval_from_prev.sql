-- Migration: 20260525_note_interval_from_prev.sql
-- user_note_logs에 직전 음과의 부호 있는 반음 거리 컬럼 추가.
-- NULL = 세션 첫 음표 (소급 불가, 신규 데이터부터 수집).
-- 용도: "도약 지연(Interval Leap Delay)" AI 리포트 데이터 전제.

ALTER TABLE public.user_note_logs
  ADD COLUMN IF NOT EXISTS interval_from_prev INTEGER;
