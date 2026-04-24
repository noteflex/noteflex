import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AdminActionLog {
  id: string;
  admin_id: string;
  action_type: string;
  target_user_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  // hydrated
  admin_email?: string | null;
  target_email?: string | null;
  admin_name?: string | null;
  target_name?: string | null;
}

export interface AdminLogsFilters {
  action_type: string; // 'all' or specific
  admin_id: string; // 'all' or specific uuid
  days: 7 | 30 | 90 | 0; // 0 = all
}

const PAGE_SIZE = 20;

export const ACTION_TYPE_LABELS: Record<string, string> = {
  grant_premium: "프리미엄 부여",
  revoke_premium: "프리미엄 해제",
  extend_premium: "프리미엄 연장",
  issue_refund: "환불",
  ban_user: "계정 정지",
  unban_user: "정지 해제",
  reset_streak: "스트릭 조정",
  grant_xp: "XP 조정",
  change_league: "리그 변경",
  update_profile: "프로필 수정",
  delete_data: "데이터 삭제",
  view_sensitive: "민감 정보 조회",
  other: "기타",
};

export function useAdminLogs() {
  const [logs, setLogs] = useState<AdminActionLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [admins, setAdmins] = useState<
    { id: string; email: string | null; display_name: string | null }[]
  >([]);
  const [filters, setFilters] = useState<AdminLogsFilters>({
    action_type: "all",
    admin_id: "all",
    days: 30,
  });

  // 관리자 목록 (필터 드롭다운용)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .eq("role", "admin")
        .order("email", { ascending: true });
      setAdmins(data ?? []);
    })();
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("admin_actions")
        .select(
          "id, admin_id, action_type, target_user_id, details, ip_address, user_agent, created_at",
          { count: "exact" }
        );

      if (filters.action_type !== "all") {
        query = query.eq("action_type", filters.action_type);
      }
      if (filters.admin_id !== "all") {
        query = query.eq("admin_id", filters.admin_id);
      }
      if (filters.days > 0) {
        const since = new Date();
        since.setDate(since.getDate() - filters.days);
        query = query.gte("created_at", since.toISOString());
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error: qe, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);
      if (qe) throw qe;

      const rows = (data ?? []) as AdminActionLog[];

      // 프로필 일괄 조회
      const userIds = new Set<string>();
      rows.forEach((r) => {
        if (r.admin_id) userIds.add(r.admin_id);
        if (r.target_user_id) userIds.add(r.target_user_id);
      });

      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, display_name, nickname")
          .in("id", Array.from(userIds));

        const profileMap = new Map<
          string,
          { email: string | null; display_name: string | null; nickname: string | null }
        >();
        (profiles ?? []).forEach((p: any) =>
          profileMap.set(p.id, {
            email: p.email,
            display_name: p.display_name,
            nickname: p.nickname,
          })
        );

        rows.forEach((r) => {
          const admin = profileMap.get(r.admin_id);
          if (admin) {
            r.admin_email = admin.email;
            r.admin_name = admin.nickname ?? admin.display_name ?? null;
          }
          if (r.target_user_id) {
            const target = profileMap.get(r.target_user_id);
            if (target) {
              r.target_email = target.email;
              r.target_name = target.nickname ?? target.display_name ?? null;
            }
          }
        });
      }

      setLogs(rows);
      setTotal(count ?? 0);
    } catch (err: any) {
      setError(err?.message ?? "불러오기 실패");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const updateFilter = <K extends keyof AdminLogsFilters>(
    key: K,
    value: AdminLogsFilters[K]
  ) => {
    setPage(0);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const distinctActionTypes = useMemo(() => {
    return Object.keys(ACTION_TYPE_LABELS);
  }, []);

  return {
    logs,
    total,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    loading,
    error,
    filters,
    updateFilter,
    admins,
    distinctActionTypes,
    refresh: fetchLogs,
  };
}