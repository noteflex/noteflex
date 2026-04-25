/**
 * Noteflex 글로벌 닉네임 정책.
 * 서버측 CHECK 제약과 동일한 규칙을 클라이언트에서도 적용.
 * CHECK: nickname ~ '^[a-z][a-z0-9_]{2,19}$'
 */

export const NICKNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;
export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 20;

export type NicknameValidationResult =
  | { valid: true }
  | { valid: false; reason: NicknameInvalidReason };

export type NicknameInvalidReason =
  | "too_short"
  | "too_long"
  | "starts_with_non_letter"
  | "invalid_chars"
  | "empty";

export function validateNicknameFormat(nickname: string): NicknameValidationResult {
  if (!nickname || nickname.length === 0) {
    return { valid: false, reason: "empty" };
  }
  if (nickname.length < NICKNAME_MIN_LENGTH) {
    return { valid: false, reason: "too_short" };
  }
  if (nickname.length > NICKNAME_MAX_LENGTH) {
    return { valid: false, reason: "too_long" };
  }
  if (!/^[a-z]/.test(nickname)) {
    return { valid: false, reason: "starts_with_non_letter" };
  }
  if (!NICKNAME_PATTERN.test(nickname)) {
    return { valid: false, reason: "invalid_chars" };
  }
  return { valid: true };
}

/** 사용자 친화 메시지 (i18n 가능하게 키 분리) */
export function nicknameErrorMessage(
  reason: NicknameInvalidReason,
  locale: "ko" | "en" = "ko"
): string {
  const messages: Record<typeof locale, Record<NicknameInvalidReason, string>> = {
    ko: {
      empty: "닉네임을 입력해주세요",
      too_short: "최소 3자 이상이어야 합니다",
      too_long: "최대 20자까지 입력 가능합니다",
      starts_with_non_letter: "영문 소문자로 시작해야 합니다",
      invalid_chars: "영문 소문자, 숫자, 밑줄(_)만 사용 가능합니다",
    },
    en: {
      empty: "Please enter a nickname",
      too_short: "At least 3 characters required",
      too_long: "Up to 20 characters allowed",
      starts_with_non_letter: "Must start with a lowercase letter",
      invalid_chars: "Only lowercase letters, numbers, and underscores",
    },
  };
  return messages[locale][reason];
}
