import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AdminUserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  role: string | null;
  is_premium: boolean;
  premium_until: string | null;
  is_minor: boolean | null;
  locale: string | null;
  country_code: string | null;
  timezone: string | null;
  current_streak: number;
  longest_streak: number;
  total_xp: number;
  current_league: string | null;
  last_practice_date: string | null;
  profile_completed: boolean;
  onboarding_completed: boolean;
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  tos_agreed_at: string | null;
  privacy_agreed_at: string | null;
  marketing_agreed_at: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserSession {
  id: string;
  level: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  total_notes: number;
  correct_notes: number;
  accuracy: number | null;
  avg_reaction_ms: number | null;
  xp_earned: number;
  session_type: string | null;
}

export interface AdminUserDailyStat {
  stat_date: string;
  sessions_count: number;
  total_notes: number;
  correct_notes: number;
  xp_earned: number;
  avg_accuracy: number | null;
  total_duration_seconds: number;
}

export interface AdminUserNoteMastery {
  note_key: string;
  clef: string;
  total_attempts: number;
  correct_count: number;
  recent_accuracy: number;
  mastery_level: number | null;
  avg_reaction_ms: number | null;
  trend: string | null;
  last_seen_at: string | null;
}

export interface AdminUserDetail {
  profile: AdminUserProfile | null;
  sessions: AdminUserSession[];
  dailyStats: AdminUserDailyStat[];
  weakNotes: AdminUserNoteMastery[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAdminUserDetail(userId: string | undefined): AdminUserDetail {
  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [sessions, setSessions] = useState<AdminUserSession[]>([]);
  const [dailyStats, setDailyStats] = useState<AdminUserDailyStat[]>([]);
  const [weakNotes, setWeakNotes] = useState<AdminUserNoteMastery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. profiles
      const { data: p, error: pe } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (pe) throw pe;
      setProfile(p as AdminUserProfile | null);

      // 2. 최근 세션 20개
      const { data: s, error: se } = await supabase
        .from("user_sessions")
        .select(
          "id, level, started_at, ended_at, duration_seconds, total_notes, correct_notes, accuracy, avg_reaction_ms, xp_earned, session_type"
        )
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(20);
      if (se) throw se;
      setSessions((s ?? []) as AdminUserSession[]);

      // 3. 최근 30일 일일 통계
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      const startDate = thirtyDaysAgo.toISOString().slice(0, 10);
      const { data: ds, error: dse } = await supabase
        .from("user_stats_daily")
        .select(
          "stat_date, sessions_count, total_notes, correct_notes, xp_earned, avg_accuracy, total_duration_seconds"
        )
        .eq("user_id", userId)
        .gte("stat_date", startDate)
        .order("stat_date", { ascending: true });
      if (dse) throw dse;
      setDailyStats((ds ?? []) as AdminUserDailyStat[]);

      // 4. 약점 음표 Top 10 (최소 5회 이상 시도, recent_accuracy 낮은 순)
      const { data: nm, error: nme } = await supabase
        .from("note_mastery")
        .select(
          "note_key, clef, total_attempts, correct_count, recent_accuracy, mastery_level, avg_reaction_ms, trend, last_seen_at"
        )
        .eq("user_id", userId)
        .gte("total_attempts", 5)
        .order("recent_accuracy", { ascending: true })
        .limit(10);
      if (nme) throw nme;
      setWeakNotes((nm ?? []) as AdminUserNoteMastery[]);
    } catch (err: any) {
      setError(err?.message ?? "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return {
    profile,
    sessions,
    dailyStats,
    weakNotes,
    loading,
    error,
    refresh: fetchAll,
  };
}