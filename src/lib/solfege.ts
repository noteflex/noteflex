/**
 * 전 세계 계이름 표기 시스템 3종.
 * 내부 표준(note_key)은 영어 표기("C", "D", ...)이며,
 * 이 유틸은 표시 계층에서만 변환한다.
 * DB 스키마·배치 로직·가중치 출제에는 영향 없음.
 */

export type SolfegeSystem = "ko" | "en" | "latin";

export const SOLFEGE_LABELS: Record<SolfegeSystem, Record<string, string>> = {
  ko:    { C: "도", D: "레", E: "미", F: "파", G: "솔", A: "라", B: "시" },
  en:    { C: "C",  D: "D",  E: "E",  F: "F",  G: "G",  A: "A",  B: "B"  },
  latin: { C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" },
};

/** 내부 key(C, D, ...)를 선택된 시스템의 라벨로 변환 */
export function toSolfege(key: string, system: SolfegeSystem): string {
  return SOLFEGE_LABELS[system][key] ?? key;
}

/** 접근성(aria-label) 용도. "도 선택" / "C 선택" / "Do 선택" */
export function toSolfegeAriaLabel(
  key: string,
  system: SolfegeSystem,
  suffix: string = "선택"
): string {
  return `${toSolfege(key, system)} ${suffix}`;
}

/** 브라우저 locale 기반 자동 추론 */
export function detectSolfegeFromLocale(locale?: string): SolfegeSystem {
  const lang = (locale ?? (typeof navigator !== "undefined" ? navigator.language : "en") ?? "en").toLowerCase();

  if (lang.startsWith("ko")) return "ko";

  if (
    lang.startsWith("fr") ||
    lang.startsWith("it") ||
    lang.startsWith("es") ||
    lang.startsWith("pt")
  ) {
    return "latin";
  }

  return "en";
}
