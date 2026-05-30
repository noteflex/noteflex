import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getUserTier } from "@/lib/subscriptionTier";
import { logger } from "@/lib/sentry";

const GUEST_LIMIT = 3;
const FREE_LIMIT = 7;

const GUEST_STORAGE_PREFIX = "noteflex.guest_daily.";

/** UTC 기준 오늘 날짜 YYYY-MM-DD. localStorage 키·DB 모두 동일 기준. */
function getUtcToday(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

/** UTC 자정까지 남은 ms. */
function getTimeUntilUtcMidnight(): number {
  const now = new Date();
  const utcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return utcMidnight - now.getTime();
}

/** Guest localStorage count 읽기 + 다른 날짜 키 cleanup. */
function readGuestCount(): number {
  try {
    const today = getUtcToday();
    const todayKey = GUEST_STORAGE_PREFIX + today;
    let todayCount = 0;
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(GUEST_STORAGE_PREFIX)) continue;
      if (key === todayKey) {
        const v = parseInt(localStorage.getItem(key) ?? "0", 10);
        todayCount = isNaN(v) ? 0 : v;
      } else {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    return todayCount;
  } catch {
    return 0;
  }
}

function writeGuestCount(count: number): void {
  try {
    localStorage.setItem(GUEST_STORAGE_PREFIX + getUtcToday(), String(count));
  } catch {
    // localStorage 비활성·full 시 silent (게임은 계속 진행)
  }
}

export interface UseDailyLimitResult {
  todayCount: number;
  limit: number;
  hasReached: boolean;
  /** UTC 자정까지 남은 ms. 1초마다 자동 갱신. */
  timeUntilResetMs: number;
  /** 게임 진입 시점 1회 호출. premium = no-op, free = RPC, guest = localStorage. */
  recordSession: () => Promise<void>;
  isLoading: boolean;
}

export function useDailyLimit(): UseDailyLimitResult {
  const { user, profile } = useAuth();
  const tier = getUserTier(user ?? null, profile ?? null);

  const [todayCount, setTodayCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [timeUntilResetMs, setTimeUntilResetMs] = useState(() => getTimeUntilUtcMidnight());
  const fetchedRef = useRef<string | null>(null);

  // 카운트다운 1초마다 갱신
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeUntilResetMs(getTimeUntilUtcMidnight());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 마운트 / tier 변경 시 todayCount 로드
  useEffect(() => {
    const fetchKey = `${tier}:${user?.id ?? "guest"}`;
    if (fetchedRef.current === fetchKey) return;
    fetchedRef.current = fetchKey;

    if (tier === "pro") {
      setTodayCount(0);
      setIsLoading(false);
      return;
    }

    if (tier === "guest") {
      setTodayCount(readGuestCount());
      setIsLoading(false);
      return;
    }

    // free
    setIsLoading(true);
    supabase.rpc("get_today_session_count").then(({ data, error }) => {
      if (error) {
        logger.error("일일 한도 조회 미설정", error, {
          description: "get_today_session_count RPC 실패",
          cause: error.message,
          impact: "일일 한도 영역 미설정 — Free 사용자 영역 게임 시작 차단 가능",
          action: "get_today_session_count RPC 있는지 확인",
          metadata: { user_id: user?.id, tier },
        });
        setTodayCount(0);
      } else {
        setTodayCount(typeof data === "number" ? data : 0);
      }
      setIsLoading(false);
    });
  }, [tier, user?.id]);

  const recordSession = useCallback(async () => {
    if (tier === "pro") return;

    if (tier === "guest") {
      const next = readGuestCount() + 1;
      writeGuestCount(next);
      setTodayCount(next);
      return;
    }

    // free
    const { data, error } = await supabase.rpc("increment_daily_session");
    if (error) {
      logger.error("일일 한도 카운트 미설정", error, {
        description: "게임 기록한 부분에서 daily_sessions 영역 카운트 미설정 적용됨",
        cause: error.message,
        impact: "사용자 영역 일일 한도 영역 초과 가능 (Free 사용자 영역)",
        action: "useDailyLimit.ts:132 영역 확인, increment_daily_session RPC 있는지 확인",
        metadata: { user_id: user?.id, tier },
      });
      return;
    }
    const newCount = typeof data === "number" ? data : 0;
    if (typeof data === "number") {
      setTodayCount(data);
    } else {
      setTodayCount((c) => c + 1);
    }
    // 한도 도달 영역 기록한 부분 완료 (Free tier 영역만)
    const limitForCheck = tier === "guest" ? GUEST_LIMIT : FREE_LIMIT;
    if (newCount >= limitForCheck) {
      logger.warn("일일 한도 도달", {
        description: "사용자 영역 일일 게임 한도 영역 완료",
        user_id: user?.id,
        session_count: newCount,
        daily_limit: limitForCheck,
        tier,
      });
    }
  }, [tier, user?.id]);

  const limit = tier === "pro" ? Infinity : tier === "guest" ? GUEST_LIMIT : FREE_LIMIT;
  const hasReached = todayCount >= limit;

  return {
    todayCount,
    limit,
    hasReached,
    timeUntilResetMs,
    recordSession,
    isLoading,
  };
}
