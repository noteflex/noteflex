import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAdaptiveDifficulty } from "./useAdaptiveDifficulty";

describe("useAdaptiveDifficulty", () => {
  it("Free 사용자 → 항상 0 (warmup·정답률 무관)", () => {
    const { result } = renderHook(() =>
      useAdaptiveDifficulty("lv1-s1", false),
    );

    expect(result.current.getWeakSlotRatio()).toBe(0);
    expect(result.current.getAdaptiveMode()).toBe("free");

    act(() => {
      for (let i = 0; i < 10; i++) result.current.recordAttempt(true);
    });
    expect(result.current.getWeakSlotRatio()).toBe(0);
    expect(result.current.getAdaptiveMode()).toBe("free");

    // 오답 누적해도 free 유지.
    act(() => {
      for (let i = 0; i < 10; i++) result.current.recordAttempt(false);
    });
    expect(result.current.getWeakSlotRatio()).toBe(0);
    expect(result.current.getAdaptiveMode()).toBe("free");
  });

  it("Premium 처음 5턴 (total<=5) → warmup 0.6", () => {
    const { result } = renderHook(() => useAdaptiveDifficulty("lv1-s1", true));

    // 초기 (total=0) → warmup
    expect(result.current.getWeakSlotRatio()).toBe(0.6);
    expect(result.current.getAdaptiveMode()).toBe("warmup");

    for (let i = 1; i <= 5; i++) {
      act(() => {
        result.current.recordAttempt(true);
      });
      expect(result.current.getWeakSlotRatio()).toBe(0.6);
      expect(result.current.getAdaptiveMode()).toBe("warmup");
    }
  });

  it("Premium 6턴 째 정답률 100% → boost_weak 0.8", () => {
    const { result } = renderHook(() => useAdaptiveDifficulty("lv1-s1", true));

    act(() => {
      for (let i = 0; i < 6; i++) result.current.recordAttempt(true);
    });

    expect(result.current.getWeakSlotRatio()).toBe(0.8);
    expect(result.current.getAdaptiveMode()).toBe("boost_weak");
  });

  it("Premium 6턴 째 정답률 ~33% → reduce_weak 0.3", () => {
    const { result } = renderHook(() => useAdaptiveDifficulty("lv1-s1", true));

    // 6턴 중 2 정답 → 정답률 33% (< 0.55)
    act(() => {
      result.current.recordAttempt(true);
      result.current.recordAttempt(true);
      result.current.recordAttempt(false);
      result.current.recordAttempt(false);
      result.current.recordAttempt(false);
      result.current.recordAttempt(false);
    });

    expect(result.current.getWeakSlotRatio()).toBe(0.3);
    expect(result.current.getAdaptiveMode()).toBe("reduce_weak");
  });

  it("Premium 10턴 중 7 정답 (70%) → normal 0.6", () => {
    const { result } = renderHook(() => useAdaptiveDifficulty("lv1-s1", true));

    act(() => {
      for (let i = 0; i < 7; i++) result.current.recordAttempt(true);
      for (let i = 0; i < 3; i++) result.current.recordAttempt(false);
    });

    expect(result.current.getWeakSlotRatio()).toBe(0.6);
    expect(result.current.getAdaptiveMode()).toBe("normal");
  });

  it("경계값 정확히 0.92 → normal (strict >)", () => {
    const { result } = renderHook(() => useAdaptiveDifficulty("lv1-s1", true));

    // 정답률 정확히 0.92: 23 정답 / 25 시도
    act(() => {
      for (let i = 0; i < 23; i++) result.current.recordAttempt(true);
      for (let i = 0; i < 2; i++) result.current.recordAttempt(false);
    });

    // 0.92는 boost 영역 X (> 0.92만 boost)
    expect(result.current.getWeakSlotRatio()).toBe(0.6);
    expect(result.current.getAdaptiveMode()).toBe("normal");
  });

  it("경계값 정확히 0.55 → normal (strict <)", () => {
    const { result } = renderHook(() => useAdaptiveDifficulty("lv1-s1", true));

    // 정답률 정확히 0.55: 11 정답 / 20 시도
    act(() => {
      for (let i = 0; i < 11; i++) result.current.recordAttempt(true);
      for (let i = 0; i < 9; i++) result.current.recordAttempt(false);
    });

    // 0.55는 reduce 영역 X (< 0.55만 reduce)
    expect(result.current.getWeakSlotRatio()).toBe(0.6);
    expect(result.current.getAdaptiveMode()).toBe("normal");
  });

  it("경계값 0.93 → boost (> 0.92)", () => {
    const { result } = renderHook(() => useAdaptiveDifficulty("lv1-s1", true));

    // 정답률 ~0.933: 14 정답 / 15 시도 = 0.9333...
    act(() => {
      for (let i = 0; i < 14; i++) result.current.recordAttempt(true);
      result.current.recordAttempt(false);
    });

    expect(result.current.getWeakSlotRatio()).toBe(0.8);
    expect(result.current.getAdaptiveMode()).toBe("boost_weak");
  });

  it("경계값 0.5 → reduce (< 0.55)", () => {
    const { result } = renderHook(() => useAdaptiveDifficulty("lv1-s1", true));

    // 정답률 0.5: 5 정답 / 10 시도
    act(() => {
      for (let i = 0; i < 5; i++) result.current.recordAttempt(true);
      for (let i = 0; i < 5; i++) result.current.recordAttempt(false);
    });

    expect(result.current.getWeakSlotRatio()).toBe(0.3);
    expect(result.current.getAdaptiveMode()).toBe("reduce_weak");
  });

  it("sublevelKey 변경 시 자동 reset → warmup으로 복귀", () => {
    const { result, rerender } = renderHook(
      ({ key }) => useAdaptiveDifficulty(key, true),
      { initialProps: { key: "lv1-s1" } },
    );

    act(() => {
      for (let i = 0; i < 10; i++) result.current.recordAttempt(true);
    });
    expect(result.current.getAdaptiveMode()).toBe("boost_weak");

    // sublevel 전환
    rerender({ key: "lv1-s2" });

    expect(result.current.getWeakSlotRatio()).toBe(0.6);
    expect(result.current.getAdaptiveMode()).toBe("warmup");
  });

  it("reset() 호출 → warmup으로 복귀", () => {
    const { result } = renderHook(() => useAdaptiveDifficulty("lv1-s1", true));

    act(() => {
      for (let i = 0; i < 20; i++) result.current.recordAttempt(true);
    });
    expect(result.current.getAdaptiveMode()).toBe("boost_weak");

    act(() => {
      result.current.reset();
    });
    expect(result.current.getWeakSlotRatio()).toBe(0.6);
    expect(result.current.getAdaptiveMode()).toBe("warmup");
  });

  it("getAdaptiveMode와 getWeakSlotRatio 분기 일관성 검증", () => {
    const { result } = renderHook(() => useAdaptiveDifficulty("lv1-s1", true));

    const expectMatch = (
      mode: "warmup" | "boost_weak" | "reduce_weak" | "normal" | "free",
      ratio: number,
    ) => {
      expect(result.current.getAdaptiveMode()).toBe(mode);
      expect(result.current.getWeakSlotRatio()).toBe(ratio);
    };

    expectMatch("warmup", 0.6);

    act(() => {
      for (let i = 0; i < 6; i++) result.current.recordAttempt(true);
    });
    expectMatch("boost_weak", 0.8);

    act(() => {
      // 오답 누적 → 6/12 = 50% → reduce
      for (let i = 0; i < 6; i++) result.current.recordAttempt(false);
    });
    expectMatch("reduce_weak", 0.3);

    act(() => {
      // 정답 더 → 12/18 ≈ 0.667 → normal
      for (let i = 0; i < 6; i++) result.current.recordAttempt(true);
    });
    expectMatch("normal", 0.6);
  });

  it("Premium → Free 전환 (rerender) 시 free 모드로 변경", () => {
    const { result, rerender } = renderHook(
      ({ premium }) => useAdaptiveDifficulty("lv1-s1", premium),
      { initialProps: { premium: true } },
    );

    act(() => {
      for (let i = 0; i < 10; i++) result.current.recordAttempt(true);
    });
    expect(result.current.getAdaptiveMode()).toBe("boost_weak");

    // Premium → Free 전환
    rerender({ premium: false });

    expect(result.current.getWeakSlotRatio()).toBe(0);
    expect(result.current.getAdaptiveMode()).toBe("free");
  });
});
