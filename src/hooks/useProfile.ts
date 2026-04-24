import { useCallback, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  is_premium: boolean;
  premium_until: string | null;
  locale: string | null;
  created_at: string;
  updated_at: string;
  // 게임화 + 권한 필드
  role: string | null;
  current_streak: number;
  longest_streak: number;
  total_xp: number;
  current_league: string | null;
  last_practice_date: string | null;
  is_minor: boolean | null;
  profile_completed: boolean;
  onboarding_completed: boolean;
}

interface UseProfileResult {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 현재 로그인한 사용자의 profiles 테이블 레코드를 가져온다.
 *  - user가 null이면 profile도 null
 *  - profiles 테이블 변경 시 실시간으로 갱신
 */
export function useProfile(user: User | null): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (): Promise<void> => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (fetchError) {
      console.error("[useProfile] Fetch error:", fetchError);
      setError(fetchError.message);
      setProfile(null);
    } else {
      setProfile(data as Profile);
    }

    setLoading(false);
  }, [user]);

  // 초기 로드 + user 변경 시 재조회
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // 실시간 구독 (프로필 업데이트 시 자동 반영)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          setProfile(payload.new as Profile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { profile, loading, error, refresh: fetchProfile };
}