import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AdminUserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  role: string | null;
  is_premium: boolean;
  premium_until: string | null;
  is_minor: boolean | null;
  current_streak: number;
  total_xp: number;
  current_league: string | null;
  last_practice_date: string | null;
  created_at: string;
}

export interface AdminUsersFilters {
  search: string;
  role: "all" | "user" | "admin";
  premium: "all" | "premium" | "free";
  minor: "all" | "minor" | "adult";
}

const PAGE_SIZE = 20;

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AdminUsersFilters>({
    search: "",
    role: "all",
    premium: "all",
    minor: "all",
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("profiles")
        .select(
          `id, email, display_name, nickname, avatar_url, role,
           is_premium, premium_until, is_minor,
           current_streak, total_xp, current_league,
           last_practice_date, created_at`,
          { count: "exact" }
        );

      // 필터 적용
      if (filters.search.trim()) {
        const q = filters.search.trim();
        query = query.or(
          `email.ilike.%${q}%,display_name.ilike.%${q}%,nickname.ilike.%${q}%`
        );
      }
      if (filters.role !== "all") {
        query = query.eq("role", filters.role);
      }
      if (filters.premium === "premium") {
        query = query.eq("is_premium", true);
      } else if (filters.premium === "free") {
        query = query.eq("is_premium", false);
      }
      if (filters.minor === "minor") {
        query = query.eq("is_minor", true);
      } else if (filters.minor === "adult") {
        query = query.eq("is_minor", false);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error: qe, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (qe) throw qe;
      setUsers((data ?? []) as AdminUserRow[]);
      setTotal(count ?? 0);
    } catch (err: any) {
      setError(err?.message ?? "불러오기 실패");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const updateFilter = <K extends keyof AdminUsersFilters>(
    key: K,
    value: AdminUsersFilters[K]
  ) => {
    setPage(0); // 필터 바뀌면 첫 페이지로
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return {
    users,
    total,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    loading,
    error,
    filters,
    updateFilter,
    refresh: fetchUsers,
  };
}