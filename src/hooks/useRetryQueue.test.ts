import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRetryQueue } from "./useRetryQueue";

/**
 * useRetryQueue 유닛 테스트
 *
 * 규칙 검증:
 *  - 오답 1회 → n+2 뒤 due
 *  - 오답 2회 → n+1 뒤 due
 *  - 오답 3회+ → 즉시 (현재 턴에서) due
 *  - 정답 시 큐에서 제거
 *  - 음표 식별: key + octave + accidental + clef 조합
 */

const noteG4 = { key: "G", octave: "4", clef: "treble" as const };
const noteF3 = { key: "F", octave: "3", clef: "bass" as const };
const noteGsharp4 = { key: "G", octave: "4", accidental: "#" as const, clef: "treble" as const };

describe("useRetryQueue", () => {
  describe("기본 동작", () => {
    it("초기 상태는 빈 큐", () => {
      const { result } = renderHook(() => useRetryQueue());
      expect(result.current.size).toBe(0);
      expect(result.current.snapshot).toEqual([]);
    });

    it("빈 큐에서 popDueOrNull은 null 반환", () => {
      const { result } = renderHook(() => useRetryQueue());
      expect(result.current.popDueOrNull(0)).toBeNull();
      expect(result.current.popDueOrNull(100)).toBeNull();
    });
  });

  describe("n+2 규칙 (첫 오답)", () => {
    it("turn 0에서 오답 등록 → turn 2에 due", () => {
      const { result } = renderHook(() => useRetryQueue());

      act(() => {
        result.current.scheduleRetry(noteG4, 0);
      });

      expect(result.current.size).toBe(1);

      // turn 0, 1에서는 아직 due 아님
      expect(result.current.popDueOrNull(0)).toBeNull();
      expect(result.current.popDueOrNull(1)).toBeNull();

      // turn 2에서 드디어 due
      let popped: ReturnType<typeof result.current.popDueOrNull> = null;
      act(() => {
        popped = result.current.popDueOrNull(2);
      });
      expect(popped).toEqual(noteG4);
    });

    it("pop 후 큐에서 제거됨", () => {
      const { result } = renderHook(() => useRetryQueue());

      act(() => {
        result.current.scheduleRetry(noteG4, 0);
      });
      act(() => {
        result.current.popDueOrNull(2);
      });

      expect(result.current.size).toBe(0);
    });
  });

  describe("단축 규칙 (재오답)", () => {
    it("오답 2회차: n+1 뒤 due", () => {
      const { result } = renderHook(() => useRetryQueue());

      // turn 0: 첫 오답 (miss 1, due @turn 2)
      act(() => {
        result.current.scheduleRetry(noteG4, 0);
      });

      // turn 2: due로 pop
      act(() => {
        result.current.popDueOrNull(2);
      });

      // turn 2: 또 오답 (miss 2, due @turn 3 = 2+1)
      act(() => {
        result.current.scheduleRetry(noteG4, 2);
      });

      expect(result.current.popDueOrNull(2)).toBeNull();
      let popped: ReturnType<typeof result.current.popDueOrNull> = null;
      act(() => {
        popped = result.current.popDueOrNull(3);
      });
      expect(popped).toEqual(noteG4);
    });

    it("오답 3회차: 즉시 다음 턴 (n+0)", () => {
      const { result } = renderHook(() => useRetryQueue());

      // 1회차 오답 → due @ turn 2
      act(() => {
        result.current.scheduleRetry(noteG4, 0);
      });
      act(() => {
        result.current.popDueOrNull(2);
      });

      // 2회차 오답 → due @ turn 3
      act(() => {
        result.current.scheduleRetry(noteG4, 2);
      });
      act(() => {
        result.current.popDueOrNull(3);
      });

      // 3회차 오답 → due @ turn 3 (즉시)
      act(() => {
        result.current.scheduleRetry(noteG4, 3);
      });

      let popped: ReturnType<typeof result.current.popDueOrNull> = null;
      act(() => {
        popped = result.current.popDueOrNull(3);
      });
      expect(popped).toEqual(noteG4);
    });
  });

  describe("정답 시 큐에서 제거", () => {
    it("resolve 호출 시 해당 음표 사라짐", () => {
      const { result } = renderHook(() => useRetryQueue());

      act(() => {
        result.current.scheduleRetry(noteG4, 0);
      });
      expect(result.current.size).toBe(1);

      act(() => {
        result.current.resolve(noteG4);
      });
      expect(result.current.size).toBe(0);
      expect(result.current.popDueOrNull(2)).toBeNull();
    });

    it("없는 음표 resolve는 무해", () => {
      const { result } = renderHook(() => useRetryQueue());

      act(() => {
        result.current.resolve(noteG4);
      });
      expect(result.current.size).toBe(0);
    });
  });

  describe("음표 식별 (clef/octave/accidental 분리)", () => {
    it("같은 key라도 clef 다르면 별개", () => {
      const { result } = renderHook(() => useRetryQueue());

      act(() => {
        result.current.scheduleRetry(
          { key: "G", octave: "4", clef: "treble" },
          0
        );
        result.current.scheduleRetry(
          { key: "G", octave: "4", clef: "bass" },
          0
        );
      });

      expect(result.current.size).toBe(2);
    });

    it("같은 key/clef라도 octave 다르면 별개", () => {
      const { result } = renderHook(() => useRetryQueue());

      act(() => {
        result.current.scheduleRetry(
          { key: "G", octave: "4", clef: "treble" },
          0
        );
        result.current.scheduleRetry(
          { key: "G", octave: "5", clef: "treble" },
          0
        );
      });

      expect(result.current.size).toBe(2);
    });

    it("G와 G# 구분", () => {
      const { result } = renderHook(() => useRetryQueue());

      act(() => {
        result.current.scheduleRetry(noteG4, 0);
        result.current.scheduleRetry(noteGsharp4, 0);
      });

      expect(result.current.size).toBe(2);
    });

    it("같은 식별자로 재등록하면 miss count 누적 (중복 X)", () => {
      const { result } = renderHook(() => useRetryQueue());

      act(() => {
        result.current.scheduleRetry(noteG4, 0);
      });
      expect(result.current.size).toBe(1);

      // 같은 음표 또 오답 → 업데이트 (size 그대로)
      act(() => {
        result.current.scheduleRetry(noteG4, 2);
      });
      expect(result.current.size).toBe(1);
      expect(result.current.snapshot[0].missCount).toBe(2);
    });
  });

  describe("복수 항목 동시 처리", () => {
    it("여러 음표 등록 → scheduledAt 작은 것부터 pop", () => {
      const { result } = renderHook(() => useRetryQueue());

      act(() => {
        result.current.scheduleRetry(noteG4, 0); // due @2
        result.current.scheduleRetry(noteF3, 1); // due @3
      });

      // turn 3: 둘 다 due지만 먼저 들어온 G4가 먼저 나와야 함
      let first: ReturnType<typeof result.current.popDueOrNull> = null;
      act(() => {
        first = result.current.popDueOrNull(3);
      });
      expect(first).toEqual(noteG4);

      let second: ReturnType<typeof result.current.popDueOrNull> = null;
      act(() => {
        second = result.current.popDueOrNull(3);
      });
      expect(second).toEqual(noteF3);

      expect(result.current.size).toBe(0);
    });
  });

  describe("reset", () => {
    it("모든 항목 제거", () => {
      const { result } = renderHook(() => useRetryQueue());

      act(() => {
        result.current.scheduleRetry(noteG4, 0);
        result.current.scheduleRetry(noteF3, 0);
        result.current.scheduleRetry(noteGsharp4, 0);
      });
      expect(result.current.size).toBe(3);

      act(() => {
        result.current.reset();
      });
      expect(result.current.size).toBe(0);
      expect(result.current.snapshot).toEqual([]);
    });
  });

  describe("has 조회", () => {
    it("큐에 있으면 true, 없으면 false", () => {
      const { result } = renderHook(() => useRetryQueue());

      expect(result.current.has(noteG4)).toBe(false);

      act(() => {
        result.current.scheduleRetry(noteG4, 0);
      });
      expect(result.current.has(noteG4)).toBe(true);
      expect(result.current.has(noteF3)).toBe(false);
    });
  });

  describe("옵션 B: 방금 정답한 음표 1턴 pop 제외 (markJustAnswered)", () => {
    // 사용자가 방금 정답한 음표가 같은 턴 또는 직후 턴에 retry로 다시 등장하는 것을 막는다.
    // §0.1 N+2 즉시 등장 버그의 보조 안전장치.

    it("markJustAnswered 직후 1턴은 due여도 pop 안 됨", () => {
      const { result } = renderHook(() => useRetryQueue());

      act(() => {
        result.current.scheduleRetry(noteG4, 0); // due @ turn 2
      });
      act(() => {
        result.current.markJustAnswered(noteG4, 1);
      });

      // turn 2: due이지만 마커로 블록
      expect(result.current.popDueOrNull(2)).toBeNull();

      // turn 3: 마커 만료 → pop 가능
      let popped: ReturnType<typeof result.current.popDueOrNull> = null;
      act(() => {
        popped = result.current.popDueOrNull(3);
      });
      expect(popped).toEqual(noteG4);
    });

    it("같은 턴에 marked + due여도 pop 안 됨", () => {
      const { result } = renderHook(() => useRetryQueue());

      act(() => {
        result.current.scheduleRetry(noteG4, 0); // due @ turn 2
      });
      act(() => {
        result.current.markJustAnswered(noteG4, 2);
      });

      // 같은 턴에 marked → 블록
      expect(result.current.popDueOrNull(2)).toBeNull();
    });

    it("markJustAnswered는 다른 음표 pop에 영향 없음", () => {
      const { result } = renderHook(() => useRetryQueue());

      act(() => {
        result.current.scheduleRetry(noteF3, 0); // due @ turn 2
      });
      act(() => {
        result.current.markJustAnswered(noteG4, 1); // 다른 음표 마킹
      });

      let popped: ReturnType<typeof result.current.popDueOrNull> = null;
      act(() => {
        popped = result.current.popDueOrNull(2);
      });
      expect(popped).toEqual(noteF3);
    });

    it("reset 시 마커도 클리어", () => {
      const { result } = renderHook(() => useRetryQueue());

      act(() => {
        result.current.markJustAnswered(noteG4, 1);
      });
      act(() => {
        result.current.reset();
      });
      act(() => {
        result.current.scheduleRetry(noteG4, 0); // due @ turn 2
      });

      // reset 후엔 마커 영향 없음
      let popped: ReturnType<typeof result.current.popDueOrNull> = null;
      act(() => {
        popped = result.current.popDueOrNull(2);
      });
      expect(popped).toEqual(noteG4);
    });
  });

  describe("§0.1 전역 dedup: popDueOrNull(turn, lastShownNote?)", () => {
    // retry pop 음표가 직전 표시 음표와 같지 않도록 호출자가 lastShownNote를 전달하면
    // popDueOrNull은 그 ID를 skip한다. 다른 due 후보 있으면 그것 pop, 없으면 null
    // (caller는 일반 batch[0] (이미 dedup된)로 fallback → 1턴 지연).

    it("lastShownNote와 동일한 due만 있으면 null 반환 (1턴 지연 fallback)", () => {
      const { result } = renderHook(() => useRetryQueue());

      // turn 0: G4 오답 → due @ turn 2
      act(() => {
        result.current.scheduleRetry(noteG4, 0);
      });

      // turn 2: due이지만 직전 표시가 G4였다면 skip
      expect(result.current.popDueOrNull(2, noteG4)).toBeNull();
      // 큐에는 그대로 남아있음 (다음 턴 재시도 가능)
      expect(result.current.size).toBe(1);

      // turn 3: lastShownNote 다른 음표면 pop 가능 (1턴 지연 후 등장)
      let popped: ReturnType<typeof result.current.popDueOrNull> = null;
      act(() => {
        popped = result.current.popDueOrNull(3, noteF3);
      });
      expect(popped).toEqual(noteG4);
    });

    it("다른 due 후보 있으면 그것 pop (lastShownNote와 일치하는 것만 skip)", () => {
      const { result } = renderHook(() => useRetryQueue());

      // turn 0: G4 오답 → due @ turn 2
      // turn 0: F3 오답 → due @ turn 2
      act(() => {
        result.current.scheduleRetry(noteG4, 0);
        result.current.scheduleRetry(noteF3, 0);
      });

      // turn 2: 둘 다 due. 직전이 G4면 F3 pop
      let popped: ReturnType<typeof result.current.popDueOrNull> = null;
      act(() => {
        popped = result.current.popDueOrNull(2, noteG4);
      });
      expect(popped).toEqual(noteF3);
      // G4는 큐에 남아있음
      expect(result.current.has(noteG4)).toBe(true);
      expect(result.current.size).toBe(1);
    });

    it("lastShownNote 없으면 기존 동작 (가장 오래 기다린 것 우선)", () => {
      const { result } = renderHook(() => useRetryQueue());

      act(() => {
        result.current.scheduleRetry(noteG4, 0); // due @2
        result.current.scheduleRetry(noteF3, 1); // due @3
      });

      let popped: ReturnType<typeof result.current.popDueOrNull> = null;
      act(() => {
        popped = result.current.popDueOrNull(3); // lastShownNote 없음
      });
      expect(popped).toEqual(noteG4); // 먼저 due된 것
    });

    it("lastShownNote는 ja(markJustAnswered)와 함께 작동 (둘 다 skip)", () => {
      const { result } = renderHook(() => useRetryQueue());

      // 큐에 G4, F3 둘 다 due
      act(() => {
        result.current.scheduleRetry(noteG4, 0); // due @ 2
        result.current.scheduleRetry(noteF3, 0); // due @ 2
      });

      // ja 마커: F3 (1턴 윈도우)
      // lastShownNote: G4
      // → 둘 다 skip → null
      act(() => {
        result.current.markJustAnswered(noteF3, 1);
      });
      expect(result.current.popDueOrNull(2, noteG4)).toBeNull();

      // turn 3: ja 만료. lastShownNote=G4면 F3 pop
      let popped: ReturnType<typeof result.current.popDueOrNull> = null;
      act(() => {
        popped = result.current.popDueOrNull(3, noteG4);
      });
      expect(popped).toEqual(noteF3);
    });

    it("clef 다르면 같은 key/octave여도 skip 안 함", () => {
      const { result } = renderHook(() => useRetryQueue());
      const noteG4Bass = { key: "G", octave: "4", clef: "bass" as const };

      act(() => {
        result.current.scheduleRetry(noteG4, 0); // treble due @ 2
      });

      // lastShown은 G4 bass — 다른 ID이므로 skip 안 됨
      let popped: ReturnType<typeof result.current.popDueOrNull> = null;
      act(() => {
        popped = result.current.popDueOrNull(2, noteG4Bass);
      });
      expect(popped).toEqual(noteG4);
    });

    it("accidental 다르면 같은 key/octave/clef여도 skip 안 함", () => {
      const { result } = renderHook(() => useRetryQueue());

      act(() => {
        result.current.scheduleRetry(noteGsharp4, 0); // due @ 2
      });

      // lastShown은 G4 (natural) — 다른 ID
      let popped: ReturnType<typeof result.current.popDueOrNull> = null;
      act(() => {
        popped = result.current.popDueOrNull(2, noteG4);
      });
      expect(popped).toEqual(noteGsharp4);
    });
  });
});