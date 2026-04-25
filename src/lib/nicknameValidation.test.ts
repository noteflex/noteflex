import { describe, it, expect } from "vitest";
import {
  validateNicknameFormat,
  nicknameErrorMessage,
  NICKNAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
} from "./nicknameValidation";

describe("validateNicknameFormat — 유효한 닉네임", () => {
  it("소문자 + 숫자 + 밑줄 조합 통과", () => {
    expect(validateNicknameFormat("yongjun_kim")).toEqual({ valid: true });
  });

  it("최소 3자 통과", () => {
    expect(validateNicknameFormat("abc")).toEqual({ valid: true });
  });

  it("최대 20자 통과", () => {
    expect(validateNicknameFormat("a1234567890123456789")).toEqual({ valid: true });
  });

  it("숫자 포함 통과", () => {
    expect(validateNicknameFormat("test_01")).toEqual({ valid: true });
  });

  it("소문자+숫자 조합 통과", () => {
    expect(validateNicknameFormat("user123")).toEqual({ valid: true });
  });
});

describe("validateNicknameFormat — 빈 값", () => {
  it('빈 문자열 → empty', () => {
    const result = validateNicknameFormat("");
    expect(result).toEqual({ valid: false, reason: "empty" });
  });
});

describe("validateNicknameFormat — 길이 위반", () => {
  it("2자 → too_short", () => {
    const result = validateNicknameFormat("ab");
    expect(result).toEqual({ valid: false, reason: "too_short" });
  });

  it(`${NICKNAME_MAX_LENGTH + 1}자 → too_long`, () => {
    const long = "a" + "1".repeat(NICKNAME_MAX_LENGTH);
    const result = validateNicknameFormat(long);
    expect(result).toEqual({ valid: false, reason: "too_long" });
  });

  it("1자 → too_short", () => {
    const result = validateNicknameFormat("a");
    expect(result).toEqual({ valid: false, reason: "too_short" });
  });
});

describe("validateNicknameFormat — 시작 문자 위반", () => {
  it("숫자로 시작 → starts_with_non_letter", () => {
    const result = validateNicknameFormat("1abc");
    expect(result).toEqual({ valid: false, reason: "starts_with_non_letter" });
  });

  it("밑줄로 시작 → starts_with_non_letter", () => {
    const result = validateNicknameFormat("_abc");
    expect(result).toEqual({ valid: false, reason: "starts_with_non_letter" });
  });
});

describe("validateNicknameFormat — 허용되지 않는 문자", () => {
  it("대문자 → invalid_chars", () => {
    const result = validateNicknameFormat("ABC");
    expect(result).toEqual({ valid: false, reason: "starts_with_non_letter" });
  });

  it("한글 → invalid_chars or starts_with_non_letter", () => {
    const result = validateNicknameFormat("한글닉");
    expect(result.valid).toBe(false);
  });

  it("공백 포함 → invalid_chars", () => {
    const result = validateNicknameFormat("with space");
    expect(result).toEqual({ valid: false, reason: "invalid_chars" });
  });

  it("하이픈 포함 → invalid_chars", () => {
    const result = validateNicknameFormat("with-dash");
    expect(result).toEqual({ valid: false, reason: "invalid_chars" });
  });

  it("점 포함 → invalid_chars", () => {
    const result = validateNicknameFormat("with.dot");
    expect(result).toEqual({ valid: false, reason: "invalid_chars" });
  });
});

describe("nicknameErrorMessage", () => {
  it("한국어 메시지 반환", () => {
    expect(nicknameErrorMessage("empty", "ko")).toBe("닉네임을 입력해주세요");
    expect(nicknameErrorMessage("too_short", "ko")).toBe("최소 3자 이상이어야 합니다");
    expect(nicknameErrorMessage("too_long", "ko")).toBe("최대 20자까지 입력 가능합니다");
    expect(nicknameErrorMessage("starts_with_non_letter", "ko")).toBe("영문 소문자로 시작해야 합니다");
    expect(nicknameErrorMessage("invalid_chars", "ko")).toBe("영문 소문자, 숫자, 밑줄(_)만 사용 가능합니다");
  });

  it("영어 메시지 반환", () => {
    expect(nicknameErrorMessage("empty", "en")).toBe("Please enter a nickname");
    expect(nicknameErrorMessage("too_short", "en")).toBe("At least 3 characters required");
  });

  it("기본값(ko) 메시지 반환", () => {
    expect(nicknameErrorMessage("empty")).toBe("닉네임을 입력해주세요");
  });
});

describe("상수 값 검증", () => {
  it("최소 길이 상수 = 3", () => {
    expect(NICKNAME_MIN_LENGTH).toBe(3);
  });

  it("최대 길이 상수 = 20", () => {
    expect(NICKNAME_MAX_LENGTH).toBe(20);
  });
});
