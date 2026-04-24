import { supabase } from "@/integrations/supabase/client";

// ═════════════════════════════════════════════════════════════
// 국가/언어 자동 감지
// ═════════════════════════════════════════════════════════════

/** 브라우저 언어에서 언어 코드 추출 (예: "ko-KR" → "ko") */
export function detectLocale(): string {
  const lang = navigator.language || "ko";
  return lang.split("-")[0].toLowerCase();
}

/** 브라우저 언어에서 국가 코드 추출 (예: "ko-KR" → "KR") */
export function detectCountryCode(): string {
  const lang = navigator.language || "ko-KR";
  const parts = lang.split("-");
  return parts.length >= 2 ? parts[1].toUpperCase() : "KR";
}

/** 브라우저 타임존 (예: "Asia/Seoul") */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul";
  } catch {
    return "Asia/Seoul";
  }
}

// ═════════════════════════════════════════════════════════════
// 프로필 완성 업데이트
// ═════════════════════════════════════════════════════════════

export interface ProfileCompletionInput {
  nickname: string;
  birth_year: number;
  birth_month: number;
  birth_day: number;
  country_code: string;
  locale: string;
  timezone: string;
  tos_agreed: boolean;
  privacy_agreed: boolean;
  marketing_agreed: boolean;
}

/**
 * 프로필 필수 정보 업데이트 (회원가입 2단계 또는 Google 로그인 후 보강)
 */
export async function completeProfile(
  userId: string,
  input: ProfileCompletionInput
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({
      nickname: input.nickname.trim(),
      birth_year: input.birth_year,
      birth_month: input.birth_month,
      birth_day: input.birth_day,
      country_code: input.country_code,
      locale: input.locale,
      timezone: input.timezone,
      tos_agreed_at: input.tos_agreed ? now : null,
      privacy_agreed_at: input.privacy_agreed ? now : null,
      marketing_agreed_at: input.marketing_agreed ? now : null,
      profile_completed: true,
    })
    .eq("id", userId);

  if (error) {
    console.error("[profile] Update error:", error);
    return { error: error.message };
  }
  return { error: null };
}

// ═════════════════════════════════════════════════════════════
// 검증 유틸
// ═════════════════════════════════════════════════════════════

export function validateNickname(nickname: string): string | null {
  const trimmed = nickname.trim();
  if (!trimmed) return "닉네임을 입력해주세요.";
  if (trimmed.length < 2) return "닉네임은 2자 이상이어야 합니다.";
  if (trimmed.length > 20) return "닉네임은 20자 이하여야 합니다.";
  return null;
}

export function validateBirthDate(
  year: number,
  month: number,
  day: number
): string | null {
  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) return "생년을 확인해주세요.";
  if (month < 1 || month > 12) return "생월을 확인해주세요.";
  if (day < 1 || day > 31) return "생일을 확인해주세요.";

  // 유효한 날짜인지 체크 (예: 2월 31일은 안 됨)
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "올바른 날짜를 입력해주세요.";
  }

  // 미래 날짜 방지
  if (date > new Date()) return "미래 날짜는 입력할 수 없습니다.";

  return null;
}

/** 만 나이 계산 */
export function calculateAge(
  year: number,
  month: number,
  day: number
): number {
  const today = new Date();
  const birth = new Date(year, month - 1, day);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// ═════════════════════════════════════════════════════════════
// 이메일 중복 체크
// ═════════════════════════════════════════════════════════════

/**
 * profiles 테이블에서 해당 이메일로 이미 가입된 사용자가 있는지 확인.
 * 가입 전 UX 개선용 (Step 1에서 먼저 거르기).
 *
 * Note: auth.users 직접 조회는 보안상 불가 → profiles.email로 조회.
 * 트리거(handle_new_user)가 가입 시 profiles.email도 채워주므로 정확.
 */
export async function checkEmailExists(email: string): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return false;
  
    const { data, error } = await supabase.rpc("check_email_exists", {
      p_email: normalized,
    });
  
    if (error) {
      console.warn("[profile] Email check error:", error);
      return false;
    }
  
    return !!data;
  }
  
  // ═════════════════════════════════════════════════════════════
  // 국가 감지 (타임존 기반) — 브라우저 언어보다 정확
  // ═════════════════════════════════════════════════════════════
  
  const TIMEZONE_TO_COUNTRY: Record<string, string> = {
    // Asia
    "Asia/Seoul": "KR",
    "Asia/Tokyo": "JP",
    "Asia/Shanghai": "CN",
    "Asia/Hong_Kong": "HK",
    "Asia/Taipei": "TW",
    "Asia/Singapore": "SG",
    "Asia/Bangkok": "TH",
    "Asia/Jakarta": "ID",
    "Asia/Manila": "PH",
    "Asia/Kolkata": "IN",
    "Asia/Dubai": "AE",
    // Europe
    "Europe/London": "GB",
    "Europe/Paris": "FR",
    "Europe/Berlin": "DE",
    "Europe/Madrid": "ES",
    "Europe/Rome": "IT",
    "Europe/Amsterdam": "NL",
    "Europe/Moscow": "RU",
    "Europe/Stockholm": "SE",
    "Europe/Oslo": "NO",
    "Europe/Helsinki": "FI",
    "Europe/Warsaw": "PL",
    "Europe/Istanbul": "TR",
    "Europe/Athens": "GR",
    "Europe/Vienna": "AT",
    "Europe/Zurich": "CH",
    "Europe/Prague": "CZ",
    "Europe/Budapest": "HU",
    "Europe/Lisbon": "PT",
    "Europe/Dublin": "IE",
    // Americas
    "America/New_York": "US",
    "America/Los_Angeles": "US",
    "America/Chicago": "US",
    "America/Denver": "US",
    "America/Toronto": "CA",
    "America/Vancouver": "CA",
    "America/Mexico_City": "MX",
    "America/Sao_Paulo": "BR",
    "America/Buenos_Aires": "AR",
    "America/Santiago": "CL",
    // Oceania
    "Australia/Sydney": "AU",
    "Australia/Melbourne": "AU",
    "Pacific/Auckland": "NZ",
    // Africa
    "Africa/Cairo": "EG",
    "Africa/Johannesburg": "ZA",
  };
  
  /** 타임존으로 국가 추론. 실패 시 브라우저 언어, 그것도 실패 시 'KR'. */
  export function detectCountryCodeSmart(): string {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && TIMEZONE_TO_COUNTRY[tz]) {
        return TIMEZONE_TO_COUNTRY[tz];
      }
    } catch {
      // ignore
    }
  
    // fallback: 브라우저 언어
    const lang = navigator.language || "ko-KR";
    const parts = lang.split("-");
    if (parts.length >= 2) return parts[1].toUpperCase();
    return "KR";
  }
  
  // ═════════════════════════════════════════════════════════════
  // 드롭다운용 국가 목록 (OECD 주요국 + 한국어 이름)
  // ═════════════════════════════════════════════════════════════
  
  export interface CountryOption {
    code: string;
    name: string;
    flag: string;
  }
  
  export const COUNTRY_OPTIONS: CountryOption[] = [
    { code: "KR", name: "대한민국", flag: "🇰🇷" },
    { code: "US", name: "United States", flag: "🇺🇸" },
    { code: "JP", name: "日本", flag: "🇯🇵" },
    { code: "CN", name: "中国", flag: "🇨🇳" },
    { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
    { code: "DE", name: "Deutschland", flag: "🇩🇪" },
    { code: "FR", name: "France", flag: "🇫🇷" },
    { code: "IT", name: "Italia", flag: "🇮🇹" },
    { code: "ES", name: "España", flag: "🇪🇸" },
    { code: "CA", name: "Canada", flag: "🇨🇦" },
    { code: "AU", name: "Australia", flag: "🇦🇺" },
    { code: "NL", name: "Nederland", flag: "🇳🇱" },
    { code: "SE", name: "Sverige", flag: "🇸🇪" },
    { code: "NO", name: "Norge", flag: "🇳🇴" },
    { code: "FI", name: "Suomi", flag: "🇫🇮" },
    { code: "DK", name: "Danmark", flag: "🇩🇰" },
    { code: "CH", name: "Schweiz", flag: "🇨🇭" },
    { code: "AT", name: "Österreich", flag: "🇦🇹" },
    { code: "BE", name: "België", flag: "🇧🇪" },
    { code: "IE", name: "Ireland", flag: "🇮🇪" },
    { code: "PT", name: "Portugal", flag: "🇵🇹" },
    { code: "PL", name: "Polska", flag: "🇵🇱" },
    { code: "CZ", name: "Česko", flag: "🇨🇿" },
    { code: "HU", name: "Magyarország", flag: "🇭🇺" },
    { code: "GR", name: "Ελλάδα", flag: "🇬🇷" },
    { code: "TR", name: "Türkiye", flag: "🇹🇷" },
    { code: "MX", name: "México", flag: "🇲🇽" },
    { code: "BR", name: "Brasil", flag: "🇧🇷" },
    { code: "AR", name: "Argentina", flag: "🇦🇷" },
    { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
    { code: "TW", name: "台灣", flag: "🇹🇼" },
    { code: "HK", name: "香港", flag: "🇭🇰" },
    { code: "SG", name: "Singapore", flag: "🇸🇬" },
    { code: "TH", name: "ประเทศไทย", flag: "🇹🇭" },
    { code: "ID", name: "Indonesia", flag: "🇮🇩" },
    { code: "PH", name: "Philippines", flag: "🇵🇭" },
    { code: "VN", name: "Việt Nam", flag: "🇻🇳" },
    { code: "IN", name: "India", flag: "🇮🇳" },
    { code: "AE", name: "الإمارات", flag: "🇦🇪" },
    { code: "IL", name: "ישראל", flag: "🇮🇱" },
    { code: "RU", name: "Россия", flag: "🇷🇺" },
    { code: "ZA", name: "South Africa", flag: "🇿🇦" },
    { code: "EG", name: "مصر", flag: "🇪🇬" },
    { code: "OTHER", name: "기타 / Other", flag: "🌍" },
  ];