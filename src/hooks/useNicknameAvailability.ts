import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  validateNicknameFormat,
  nicknameErrorMessage,
} from "@/lib/nicknameValidation";
import { logger } from "@/lib/sentry";

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
          logger.warn("닉네임 중복", {
            description: "회원가입 영역에서 사용자 영역 박은 닉네임 영역 박혀있는 영역",
            nickname_length: nickname.length,
          });
          const suggestions = await generateSuggestions(nickname);
          setStatus({ state: "taken", suggestions });
        }
      } catch (err) {
        logger.error("닉네임 영역 확인 박지 X", err, {
          description: "check_nickname_available RPC 실패",
          cause: err instanceof Error ? err.message : String(err),
          impact: "회원가입 영역 영역 닉네임 입력 박지 X 박힘",
          action: "check_nickname_available RPC 박힌지 확인 (Phase 3 박은 영역)",
        });
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
