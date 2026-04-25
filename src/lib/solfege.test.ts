import { describe, it, expect, vi, afterEach } from "vitest";
import {
  toSolfege,
  toSolfegeAriaLabel,
  detectSolfegeFromLocale,
  SOLFEGE_LABELS,
} from "./solfege";

const ALL_KEYS = ["C", "D", "E", "F", "G", "A", "B"] as const;

describe("toSolfege", () => {
  it("한국어 시스템: C → 도", () => {
    expect(toSolfege("C", "ko")).toBe("도");
  });

  it("영어 시스템: C → C", () => {
    expect(toSolfege("C", "en")).toBe("C");
  });

  it("라틴 시스템: C → Do", () => {
    expect(toSolfege("C", "latin")).toBe("Do");
  });

  it("한국어 시스템: 7개 음표 전부 매핑 확인", () => {
    const koExpected = ["도", "레", "미", "파", "솔", "라", "시"];
    ALL_KEYS.forEach((key, i) => {
      expect(toSolfege(key, "ko")).toBe(koExpected[i]);
    });
  });

  it("영어 시스템: 7개 음표 전부 원형 유지", () => {
    ALL_KEYS.forEach((key) => {
      expect(toSolfege(key, "en")).toBe(key);
    });
  });

  it("라틴 시스템: 7개 음표 전부 매핑 확인", () => {
    const latinExpected = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"];
    ALL_KEYS.forEach((key, i) => {
      expect(toSolfege(key, "latin")).toBe(latinExpected[i]);
    });
  });

  it("알 수 없는 key는 원형 반환", () => {
    expect(toSolfege("X", "ko")).toBe("X");
  });
});

describe("toSolfegeAriaLabel", () => {
  it("기본 suffix '선택' 적용", () => {
    expect(toSolfegeAriaLabel("C", "ko")).toBe("도 선택");
    expect(toSolfegeAriaLabel("C", "en")).toBe("C 선택");
    expect(toSolfegeAriaLabel("C", "latin")).toBe("Do 선택");
  });

  it("커스텀 suffix 적용", () => {
    expect(toSolfegeAriaLabel("G", "ko", "누르기")).toBe("솔 누르기");
  });
});

describe("detectSolfegeFromLocale", () => {
  it("ko-KR → ko", () => {
    expect(detectSolfegeFromLocale("ko-KR")).toBe("ko");
  });

  it("ko → ko", () => {
    expect(detectSolfegeFromLocale("ko")).toBe("ko");
  });

  it("en-US → en", () => {
    expect(detectSolfegeFromLocale("en-US")).toBe("en");
  });

  it("fr-FR → latin", () => {
    expect(detectSolfegeFromLocale("fr-FR")).toBe("latin");
  });

  it("it-IT → latin", () => {
    expect(detectSolfegeFromLocale("it-IT")).toBe("latin");
  });

  it("es-ES → latin", () => {
    expect(detectSolfegeFromLocale("es-ES")).toBe("latin");
  });

  it("pt-BR → latin", () => {
    expect(detectSolfegeFromLocale("pt-BR")).toBe("latin");
  });

  it("de-DE → en (fallback)", () => {
    expect(detectSolfegeFromLocale("de-DE")).toBe("en");
  });

  it("ja-JP → en (fallback)", () => {
    expect(detectSolfegeFromLocale("ja-JP")).toBe("en");
  });

  it("undefined 시 navigator.language 기반 동작 (에러 없음)", () => {
    const result = detectSolfegeFromLocale(undefined);
    expect(["ko", "en", "latin"]).toContain(result);
  });
});

describe("SOLFEGE_LABELS 완전성", () => {
  it("3개 시스템 모두 7개 음표 키 보유", () => {
    const systems = ["ko", "en", "latin"] as const;
    systems.forEach((system) => {
      ALL_KEYS.forEach((key) => {
        expect(SOLFEGE_LABELS[system]).toHaveProperty(key);
        expect(typeof SOLFEGE_LABELS[system][key]).toBe("string");
        expect(SOLFEGE_LABELS[system][key].length).toBeGreaterThan(0);
      });
    });
  });
});
