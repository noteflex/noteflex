import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface DailyStat {
  stat_date: string;
  xp_earned: number;
  sessions_count: number;
  total_notes: number;
  correct_notes: number;
  avg_accuracy: number | null;
}

export interface League {
  id: number;
  name: string;
  rank: number;
  icon: string | null;
  color: string | null;
  description: string | null;
}

export interface LeagueStanding {
  weekly_xp: number;
  rank_in_group: number | null;
  group_id: string;
}

export interface UserStats {
  currentStreak: number;
  longestStreak: number;
  totalXp: number;
  currentLeagueName: string | null;
  lastPracticeDate: string | null;
  todayXp: number;
  weekStats: DailyStat[];
  league: League | null;
  standing: LeagueStanding | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function last7Dates(): string[] {
  const result: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    result.push(toDateString(d));
  }
  return result;
}

export function useUserStats(user: User | null): UserStats {
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [currentLeagueName, setCurrentLeagueName] = useState<string | null>(null);
  const [lastPracticeDate, setLastPracticeDate] = useState<string | null>(null);
  const [todayXp, setTodayXp] = useState(0);
  const [weekStats, setWeekStats] = useState<DailyStat[]>([]);
  const [league, setLeague] = useState<League | null>(null);
  const [standing, setStanding] = useState<LeagueStanding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: p, error: pe } = await supabase
        .from("profiles")
        .select(
          "current_streak, longest_streak, total_xp, current_league, last_practice_date"
        )
        .eq("id", user.id)
        .maybeSingle();
      if (pe) throw pe;

      setCurrentStreak(p?.current_streak ?? 0);
      setLongestStreak(p?.longest_streak ?? 0);
      setTotalXp(Number(p?.total_xp ?? 0));
      setCurrentLeagueName(p?.current_league ?? null);
      setLastPracticeDate(p?.last_practice_date ?? null);

      const dates = last7Dates();
      const startDate = dates[0];
      const endDate = dates[dates.length - 1];
      const { data: stats, error: se } = await supabase
        .from("user_stats_daily")
        .select(
          "stat_date, xp_earned, sessions_count, total_notes, correct_notes, avg_accuracy"
        )
        .eq("user_id", user.id)
        .gte("stat_date", startDate)
        .lte("stat_date", endDate)
        .order("stat_date", { ascending: true });
      if (se) throw se;

      const statMap = new Map<string, DailyStat>();
      (stats ?? []).forEach((r: any) =>
        statMap.set(r.stat_date as string, r as DailyStat)
      );

      const weekData: DailyStat[] = dates.map((d) => {
        const existing = statMap.get(d);
        if (existing) return existing;
        return {
          stat_date: d,
          xp_earned: 0,
          sessions_count: 0,
          total_notes: 0,
          correct_notes: 0,
          avg_accuracy: null,
        };
      });
      setWeekStats(weekData);
      setTodayXp(statMap.get(endDate)?.xp_earned ?? 0);

      if (p?.current_league) {
        const { data: l, error: le } = await supabase
          .from("leagues")
          .select("id, name, rank, icon, color, description")
          .eq("name", p.current_league)
          .maybeSingle();
        if (le) throw le;
        setLeague(l as League | null);
      } else {
        setLeague(null);
      }

      const { data: lm, error: lme } = await supabase
        .from("league_members")
        .select("weekly_xp, rank_in_group, group_id, joined_at")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lme) throw lme;
      if (lm) {
        setStanding({
          weekly_xp: lm.weekly_xp ?? 0,
          rank_in_group: lm.rank_in_group ?? null,
          group_id: lm.group_id as string,
        });
      } else {
        setStanding(null);
      }

      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err?.message ?? "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return {
    currentStreak,
    longestStreak,
    totalXp,
    currentLeagueName,
    lastPracticeDate,
    todayXp,
    weekStats,
    league,
    standing,
    loading,
    error,
    lastUpdated,
    refresh: fetchAll,
  };
}