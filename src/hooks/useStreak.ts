// 스트릭 단일 source — user_streaks + daily_activity (Step 2).
//
// 정책:
//   - 진실 source = user_streaks (record_practice_day RPC가 갱신).
//   - profiles.current_streak/longest_streak/last_practice_date 는 옛 시스템 잔재 — 본 훅 미사용.
//   - 주간 7도트 = daily_activity 의 월~일 7일 매핑.
//   - 비로그인 / 미로드 시 빈 상태(현재 0일, week 전부 미완) 반환.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getLocalDateKey } from "@/lib/localDate";

export interface StreakWeekDay {
  /** YYYY-MM-DD 로컬 */
  date: string;
  /** 0=월 ~ 6=일 (월요일 시작 인덱스) */
  weekdayIndex: number;
  /** daily_activity 에 해당 날짜 row 존재 */
  done: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface StreakState {
  loading: boolean;
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string | null;
  /** 로컬 오늘 = user_streaks.last_practice_date */
  todayDone: boolean;
  /** 월~일 7일 (월요일 시작) */
  week: StreakWeekDay[];
  refresh: () => Promise<void>;
}

/** 월요일 자정 (로컬). */
function startOfWeekMonday(now: Date = new Date()): Date {
  const d = new Date(now);
  const dow = d.getDay(); // 0=일,1=월,...,6=토
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 월~일 7일 메타(date·index·isToday·isFuture). done 은 별도 fetch 후 합쳐 채운다. */
function buildWeekFrame(now: Date = new Date()): Omit<StreakWeekDay, "done">[] {
  const todayKey = getLocalDateKey(now);
  const monday = startOfWeekMonday(now);
  const frame: Omit<StreakWeekDay, "done">[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateKey = getLocalDateKey(d);
    frame.push({
      date: dateKey,
      weekdayIndex: i,
      isToday: dateKey === todayKey,
      isFuture: dateKey > todayKey,
    });
  }
  return frame;
}

function emptyWeek(): StreakWeekDay[] {
  return buildWeekFrame().map((f) => ({ ...f, done: false }));
}

export function useStreak(): StreakState {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [lastPracticeDate, setLastPracticeDate] = useState<string | null>(null);
  const [week, setWeek] = useState<StreakWeekDay[]>(() => emptyWeek());

  const fetchAll = useCallback(async () => {
    if (!user) {
      setCurrentStreak(0);
      setLongestStreak(0);
      setLastPracticeDate(null);
      setWeek(emptyWeek());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const frame = buildWeekFrame();
      const startDate = frame[0].date;
      const endDate = frame[6].date;

      const [streakRes, activityRes] = await Promise.all([
        supabase
          .from("user_streaks")
          .select("current_streak, longest_streak, last_practice_date")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("daily_activity")
          .select("local_date")
          .eq("user_id", user.id)
          .gte("local_date", startDate)
          .lte("local_date", endDate),
      ]);

      const s = streakRes.data;
      setCurrentStreak(s?.current_streak ?? 0);
      setLongestStreak(s?.longest_streak ?? 0);
      setLastPracticeDate(s?.last_practice_date ?? null);

      const doneSet = new Set<string>(
        (activityRes.data ?? []).map((r) => r.local_date as string),
      );
      setWeek(frame.map((f) => ({ ...f, done: doneSet.has(f.date) })));
    } catch {
      // 실패는 조용히 — UI 는 직전 값 또는 빈 상태 표시
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const todayDone = lastPracticeDate === getLocalDateKey();

  return {
    loading,
    currentStreak,
    longestStreak,
    lastPracticeDate,
    todayDone,
    week,
    refresh: fetchAll,
  };
}
