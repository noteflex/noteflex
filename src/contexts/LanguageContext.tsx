import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getStrings, type Strings } from "@/i18n/strings";

export type Lang = "ko" | "en" | "ja" | "zh";

const SUPPORTED_LANGS: readonly Lang[] = ["ko", "en", "ja", "zh"] as const;
const DEFAULT_LANG: Lang = "en";
const LANG_STORAGE_KEY = "noteflex.lang";
const LEGACY_BLOG_LANG_KEY = "noteflex.blog_lang";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

// sentinel 객체: useContext 반환값이 이것과 같으면 Provider가 없는 환경.
const NO_PROVIDER = Symbol("no-provider");
const LanguageContext = createContext<LanguageContextValue | typeof NO_PROVIDER>(NO_PROVIDER);

function isSupportedLang(value: string | null): value is Lang {
  return value !== null && (SUPPORTED_LANGS as readonly string[]).includes(value);
}

function detectAutoLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  // 1. timezone === 'Asia/Seoul' → 한국 사용자로 추정 (PIPA 정합)
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Asia/Seoul") return "ko";
  } catch {
    // Intl 미지원 환경 = skip
  }
  // 2. navigator.language === 'ko-*' → 한국어 우선
  try {
    if (navigator.language?.toLowerCase().startsWith("ko")) return "ko";
  } catch {
    // navigator 미지원 = skip
  }
  // 3. 그 외 → 기본 영어
  return DEFAULT_LANG;
}

function readInitialLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    // 1. 사용자 명시 선택 우선 (localStorage)
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (isSupportedLang(stored)) return stored;

    // 2. Legacy 마이그레이션: 블로그 영역에서만 박혔던 noteflex.blog_lang
    const legacy = window.localStorage.getItem(LEGACY_BLOG_LANG_KEY);
    if (isSupportedLang(legacy)) {
      window.localStorage.setItem(LANG_STORAGE_KEY, legacy);
      window.localStorage.removeItem(LEGACY_BLOG_LANG_KEY);
      return legacy;
    }
  } catch {
    // localStorage 접근 실패 시 자동 감지로 폴백
  }
  // 3. timezone·navigator 기반 자동 감지
  return detectAutoLang();
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  function setLang(newLang: Lang) {
    setLangState(newLang);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, newLang);
    } catch {
      // 무시
    }
  }

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (ctx === NO_PROVIDER) {
    // Provider 없는 환경 — localStorage 우선, 없으면 DEFAULT_LANG
    let lang: Lang = DEFAULT_LANG;
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
        if (isSupportedLang(stored)) lang = stored;
      } catch {}
    }
    return { lang, setLang: () => {} };
  }
  return ctx;
}

export function useT(): Strings {
  const { lang } = useLang();
  return getStrings(lang);
}
