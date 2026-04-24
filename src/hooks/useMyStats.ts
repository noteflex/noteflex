import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface MySession {
  id: string;
  level: number;
  started_at: string;
  duration_seconds: number | null;
  total_notes: number;
  correct_notes: number;
  accuracy: number | null;
  avg_reaction_ms: number | null;
  xp_earned: number;
}

export interface MyDailyStat {
  stat_date: string;
  sessions_count: number;
  total_notes: number;
  correct_notes: number;
  xp_earned: number;
  avg_accuracy: number | null;
  avg_reaction_ms: number | null;
  total_duration_seconds: number;
}

export interface MyNoteMastery {
  note_key: string;
  clef: string;
  total_attempts: number;
  correct_count: number;
  recent_accuracy: number;
  avg_reaction_ms: number | null;
  trend: string | null;
}

export interface MyStats {
  sessions: MySession[];
  dailyStats30d: MyDailyStat[];
  weakNotes: MyNoteMastery[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function useMyStats(user: User | null): MyStats {
  const [sessions, setSessions] = useState<MySession[]>([]);
  const [dailyStats30d, setDailyStats30d] = useState<MyDailyStat[]>([]);
  const [weakNotes, setWeakNotes] = useState<MyNoteMastery[]>([]);
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
      const { data: s, error: se } = await supabase
        .from("user_sessions")
        .select(
          "id, level, started_at, duration_seconds, total_notes, correct_notes, accuracy, avg_reaction_ms, xp_earned"
        )
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(20);
      if (se) throw se;
      setSessions((s ?? []) as MySession[]);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      const startDate = thirtyDaysAgo.toISOString().slice(0, 10);
      const { data: ds, error: dse } = await supabase
        .from("user_stats_daily")
        .select(
          "stat_date, sessions_count, total_notes, correct_notes, xp_earned, avg_accuracy, avg_reaction_ms, total_duration_seconds"
        )
        .eq("user_id", user.id)
        .gte("stat_date", startDate)
        .order("stat_date", { ascending: true });
      if (dse) throw dse;
      setDailyStats30d((ds ?? []) as MyDailyStat[]);

      const { data: nm, error: nme } = await supabase
        .from("note_mastery")
        .select(
          "note_key, clef, total_attempts, correct_count, recent_accuracy, avg_reaction_ms, trend"
        )
        .eq("user_id", user.id)
        .gte("total_attempts", 5)
        .order("recent_accuracy", { ascending: true })
        .limit(10);
      if (nme) throw nme;
      setWeakNotes((nm ?? []) as MyNoteMastery[]);

      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err?.message ?? "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return {
    sessions,
    dailyStats30d,
    weakNotes,
    loading,
    error,
    lastUpdated,
    refresh: fetchAll,
  };
}