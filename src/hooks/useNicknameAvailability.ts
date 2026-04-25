import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  validateNicknameFormat,
  nicknameErrorMessage,
} from "@/lib/nicknameValidation";

export type NicknameStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken"; suggestions: string[] }
  | { state: "invalid_format"; reason: string };

export function useNicknameAvailability(nickname: string, debounceMs = 500) {
  const [status, setStatus] = useState<NicknameStatus>({ state: "idle" });

  useEffect(() => {
    if (!nickname) {
      setStatus({ state: "idle" });
      return;
    }

    // 1. 형식 검증 (즉시)
    const validation = validateNicknameFormat(nickname);
    if (!validation.valid) {
      setStatus({
        state: "invalid_format",
        reason: nicknameErrorMessage(validation.reason),
      });
      return;
    }

    // 2. 디바운스 후 서버 체크
    setStatus({ state: "checking" });
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("check_nickname_available", {
          p_nickname: nickname,
        });
        if (error) throw error;

        if (data === true) {
          setStatus({ state: "available" });
        } else {
          const suggestions = await generateSuggestions(nickname);
          setStatus({ state: "taken", suggestions });
        }
      } catch (err) {
        console.error("[nickname check]", err);
        setStatus({ state: "idle" });
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [nickname, debounceMs]);

  return status;
}

/**
 * 닉네임 충돌 시 사용 가능한 대안 3개 추천.
 * base + 숫자 (2, 3, ...) 시도, 20자 초과 방지.
 */
async function generateSuggestions(base: string): Promise<string[]> {
  const suggestions: string[] = [];
  const maxBase = base.length > 18 ? base.slice(0, 18) : base;

  for (let i = 2; i < 100 && suggestions.length < 3; i++) {
    const candidate = `${maxBase}${i}`;
    if (candidate.length > 20) break;

    const { data } = await supabase.rpc("check_nickname_available", {
      p_nickname: candidate,
    });
    if (data === true) {
      suggestions.push(candidate);
    }
  }
  return suggestions;
}
