-- 1) 사용자별 연습 곡(악보) 관리 테이블
CREATE TABLE public.user_scores (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  -- 상태 추적: 연습 중, 완료, 중단(포기)
  status VARCHAR(50) DEFAULT 'IN_PROGRESS'
    CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'DISCONTINUED')),
  discontinued_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.set_updated_at_user_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_scores_updated_at
BEFORE UPDATE ON public.user_scores
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_user_scores();

-- 2) 마이크로 학습 기록 테이블 (초견 속도 측정 핵심)
CREATE TABLE public.practice_logs (
  id BIGSERIAL PRIMARY KEY,
  score_id BIGINT NOT NULL REFERENCES public.user_scores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  measure_number INT NOT NULL,
  expected_note VARCHAR(10) NOT NULL,
  played_note VARCHAR(10),
  reaction_time_ms INT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 읽기 성능을 위한 인덱스
CREATE INDEX idx_practice_logs_user_score
  ON public.practice_logs(user_id, score_id);
