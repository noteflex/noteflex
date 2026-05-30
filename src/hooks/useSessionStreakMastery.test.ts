import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionStreakMastery } from "./useSessionStreakMastery";

describe("useSessionStreakMastery", () => {
  it("연속 5회 정답 + 평균 1.0초 → 마스터 (×0.3)", () => {
    const { result } = renderHook(() => useSessionStreakMastery("lv1-s1"));

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.recordAttempt("treble:F4", true, 1.0);
      }
    });

    expect(result.current.getMasteryMultiplier("treble:F4")).toBe(0.3);
    expect(result.current.isMastered("treble:F4")).toBe(true);
  });

  it("연속 5회 정답이지만 평균 2초 (느림) → 미마스터 (×1.0)", () => {
    const { result } = renderHook(() => useSessionStreakMastery("lv1-s1"));

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.recordAttempt("treble:F4", true, 2.0);
      }
    });

    expect(result.current.getMasteryMultiplier("treble:F4")).toBe(1.0);
    expect(result.current.isMastered("treble:F4")).toBe(false);
  });

  it("연속 4회 정답 → 임계 미달, ×1.0", () => {
    const { result } = renderHook(() => useSessionStreakMastery("lv1-s1"));

    act(() => {
      for (let i = 0; i < 4; i++) {
        result.current.recordAttempt("treble:F4", true, 0.8);
      }
    });

    expect(result.current.getMasteryMultiplier("treble:F4")).toBe(1.0);
    expect(result.current.isMastered("treble:F4")).toBe(false);
  });

  it("4회 정답 + 1회 오답 → 즉시 리셋", () => {
    const { result } = renderHook(() => useSessionStreakMastery("lv1-s1"));

    act(() => {
      for (let i = 0; i < 4; i++) {
        result.current.recordAttempt("treble:F4", true, 1.0);
      }
      result.current.recordAttempt("treble:F4", false, 3.0);
    });

    // 리셋 후 streak=0, ×1.0
    expect(result.current.getMasteryMultiplier("treble:F4")).toBe(1.0);
    expect(result.current.isMastered("treble:F4")).toBe(false);

    // 다시 5회 쌓아야 마스터됨.
    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.recordAttempt("treble:F4", true, 1.0);
      }
    });
    expect(result.current.getMasteryMultiplier("treble:F4")).toBe(0.3);
  });

  it("마스터 상태에서 오답 → 즉시 리셋", () => {
    const { result } = renderHook(() => useSessionStreakMastery("lv1-s1"));

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.recordAttempt("treble:F4", true, 1.0);
      }
    });
    expect(result.current.getMasteryMultiplier("treble:F4")).toBe(0.3);

    act(() => {
      result.current.recordAttempt("treble:F4", false, 4.0);
    });
    expect(result.current.getMasteryMultiplier("treble:F4")).toBe(1.0);
  });

  it("sublevelKey 변경 시 자동 reset", () => {
    const { result, rerender } = renderHook(
      ({ key }) => useSessionStreakMastery(key),
      { initialProps: { key: "lv1-s1" } },
    );

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.recordAttempt("treble:F4", true, 1.0);
      }
    });
    expect(result.current.getMasteryMultiplier("treble:F4")).toBe(0.3);

    // sublevel 전환
    rerender({ key: "lv1-s2" });

    expect(result.current.getMasteryMultiplier("treble:F4")).toBe(1.0);
    expect(result.current.isMastered("treble:F4")).toBe(false);
  });

  it("미기록 음 getMasteryMultiplier → 1.0", () => {
    const { result } = renderHook(() => useSessionStreakMastery("lv1-s1"));
    expect(result.current.getMasteryMultiplier("treble:G4")).toBe(1.0);
    expect(result.current.isMastered("treble:G4")).toBe(false);
  });

  it("reset() 호출 후 모든 음 1.0", () => {
    const { result } = renderHook(() => useSessionStreakMastery("lv1-s1"));

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.recordAttempt("treble:F4", true, 1.0);
        result.current.recordAttempt("bass:C3", true, 0.8);
      }
    });
    expect(result.current.getMasteryMultiplier("treble:F4")).toBe(0.3);
    expect(result.current.getMasteryMultiplier("bass:C3")).toBe(0.3);

    act(() => {
      result.current.reset();
    });
    expect(result.current.getMasteryMultiplier("treble:F4")).toBe(1.0);
    expect(result.current.getMasteryMultiplier("bass:C3")).toBe(1.0);
  });

  it("음표별로 독립적인 streak 관리", () => {
    const { result } = renderHook(() => useSessionStreakMastery("lv1-s1"));

    act(() => {
      // F4는 5회 마스터
      for (let i = 0; i < 5; i++) {
        result.current.recordAttempt("treble:F4", true, 1.0);
      }
      // G4는 3회만
      for (let i = 0; i < 3; i++) {
        result.current.recordAttempt("treble:G4", true, 1.0);
      }
    });

    expect(result.current.getMasteryMultiplier("treble:F4")).toBe(0.3);
    expect(result.current.getMasteryMultiplier("treble:G4")).toBe(1.0);

    act(() => {
      // F4만 오답 → F4 리셋, G4는 그대로
      result.current.recordAttempt("treble:F4", false, 2.0);
    });

    expect(result.current.getMasteryMultiplier("treble:F4")).toBe(1.0);

    act(() => {
      // G4 추가 2회 → 5회 도달, 마스터
      result.current.recordAttempt("treble:G4", true, 1.0);
      result.current.recordAttempt("treble:G4", true, 1.0);
    });
    expect(result.current.getMasteryMultiplier("treble:G4")).toBe(0.3);
  });

  it("recentResponseTimes 버퍼는 최근 5개만 유지 (FIFO)", () => {
    const { result } = renderHook(() => useSessionStreakMastery("lv1-s1"));

    // 처음 5번: 3초씩 (느림). 평균 3.0초 → 미마스터.
    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.recordAttempt("treble:F4", true, 3.0);
      }
    });
    expect(result.current.getMasteryMultiplier("treble:F4")).toBe(1.0);

    // 추가 5번: 0.5초씩 (빠름). 최근 5개는 모두 0.5초 → 평균 0.5초, streak=10 → 마스터.
    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.recordAttempt("treble:F4", true, 0.5);
      }
    });
    expect(result.current.getMasteryMultiplier("treble:F4")).toBe(0.3);
  });
});
