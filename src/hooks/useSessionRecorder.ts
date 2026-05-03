// ═══════════════════════════════════════════════════════════════
// useSessionRecorder (v2)
// ═══════════════════════════════════════════════════════════════
// 게임 세션을 기록하고 종료 시 user_sessions 테이블에 INSERT하는 훅.
//
// XP 계산 공식 (v2 - 2026-04-21):
//   1. 기본: 정답당 +1 XP
//   2. 속도 보너스 (정답 + 레벨별 차등):
//      Lv1-2: ≤0.8s = +2, ≤1.5s = +1
//      Lv3-4: ≤1.0s = +2, ≤2.0s = +1
//      Lv5-6: ≤1.3s = +2, ≤2.5s = +1
//      Lv7:   ≤1.5s = +2, ≤3.0s = +1
//      Custom(0): ≤1.0s = +2, ≤2.0s = +1
//   3. 연속 정답 마일스톤 (세션당 1번):
//      5연속: +5, 10연속: +10, 20연속: +25
//   4. 세션 완료 보너스: +20 XP (게임오버 시 0)
//   5. 정확도 보너스 (완료 시만):
//      100%: +30, 90%+: +15, 80%+: +5
// ═══════════════════════════════════════════════════════════════

import { useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getUserEnvOffset, clampReactionMs } from "@/lib/userEnvironmentOffset";

// ═══════════════════════════════════════════════════════════════
// 타입 정의
// ═══════════════════════════════════════════════════════════════

export interface NoteAttempt {
  note: string;
  correct: boolean;
  reactionMs: number;
  reactionMsRaw?: number;
  clef: "treble" | "bass";
  accidental?: "sharp" | "flat" | "natural" | null;
}

export type SessionType = "regular" | "focus_mode" | "custom_score" | "tutorial";
export type SessionEndReason = "completed" | "gameover" | "cancelled";

interface SessionState {
  level: number;
  sessionType: SessionType;
  startedAt: Date;
  attempts: NoteAttempt[];
}

// ═══════════════════════════════════════════════════════════════
// 레벨별 속도 기준 (반응 시간 ms)
// ═══════════════════════════════════════════════════════════════

interface SpeedThreshold {
  excellent: number;
  good: number;
}

function getSpeedThresholds(level: number): SpeedThreshold {
  if (level === 0) return { excellent: 1000, good: 2000 };
  if (level <= 2) return { excellent: 800, good: 1500 };
  if (level <= 4) return { excellent: 1000, good: 2000 };
  if (level <= 6) return { excellent: 1300, good: 2500 };
  return { excellent: 1500, good: 3000 };
}

// ═══════════════════════════════════════════════════════════════
// XP 계산 (v2)
// ═══════════════════════════════════════════════════════════════

interface XpBreakdown {
  basePoints: number;
  speedBonus: number;
  streakBonus: number;
  completionBonus: number;
  accuracyBonus: number;
  total: number;
  streakMilestones: number[];
}

function calculateXPBreakdown(
  attempts: NoteAttempt[],
  level: number,
  endReason: SessionEndReason,
): XpBreakdown {
  const thresholds = getSpeedThresholds(level);

  let basePoints = 0;
  let speedBonus = 0;
  let consecutive = 0;
  const reachedMilestones = new Set<number>();

  for (const attempt of attempts) {
    if (!attempt.correct) {
      consecutive = 0;
      continue;
    }

    basePoints += 1;

    if (attempt.reactionMs <= thresholds.excellent) {
      speedBonus += 2;
    } else if (attempt.reactionMs <= thresholds.good) {
      speedBonus += 1;
    }

    consecutive += 1;
    if (consecutive >= 5 && !reachedMilestones.has(5)) {
      reachedMilestones.add(5);
    }
    if (consecutive >= 10 && !reachedMilestones.has(10)) {
      reachedMilestones.add(10);
    }
    if (consecutive >= 20 && !reachedMilestones.has(20)) {
      reachedMilestones.add(20);
    }
  }

  let streakBonus = 0;
  if (reachedMilestones.has(5)) streakBonus += 5;
  if (reachedMilestones.has(10)) streakBonus += 10;
  if (reachedMilestones.has(20)) streakBonus += 25;

  const completionBonus = endReason === "completed" ? 20 : 0;

  const totalNotes = attempts.length;
  const correctNotes = attempts.filter((a) => a.correct).length;
  const accuracy = totalNotes > 0 ? correctNotes / totalNotes : 0;

  let accuracyBonus = 0;
  if (endReason === "completed" && totalNotes > 0) {
    if (accuracy === 1.0) accuracyBonus = 30;
    else if (accuracy >= 0.9) accuracyBonus = 15;
    else if (accuracy >= 0.8) accuracyBonus = 5;
  }

  const total =
    basePoints + speedBonus + streakBonus + completionBonus + accuracyBonus;

  return {
    basePoints,
    speedBonus,
    streakBonus,
    completionBonus,
    accuracyBonus,
    total,
    streakMilestones: Array.from(reachedMilestones).sort((a, b) => a - b),
  };
}

// ═══════════════════════════════════════════════════════════════
// 약점/강점 음표 추출
// ═══════════════════════════════════════════════════════════════

function extractNoteStats(attempts: NoteAttempt[]) {
  const noteMap = new Map<string, { correct: number; total: number }>();

  for (const a of attempts) {
    const key = a.note;
    const current = noteMap.get(key) || { correct: 0, total: 0 };
    current.total += 1;
    if (a.correct) current.correct += 1;
    noteMap.set(key, current);
  }

  const notes = Array.from(noteMap.entries()).map(([note, stats]) => ({
    note,
    accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
    attempts: stats.total,
  }));

  const weakNotes = notes
    .filter((n) => n.attempts >= 2)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  const strongNotes = notes
    .filter((n) => n.attempts >= 2)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 5);

  return { weakNotes, strongNotes };
}

// ═══════════════════════════════════════════════════════════════
// 메인 훅
// ═══════════════════════════════════════════════════════════════

export function useSessionRecorder() {
  const { user } = useAuth();
  const stateRef = useRef<SessionState | null>(null);
  const savingRef = useRef<boolean>(false);

  const startSession = useCallback(
    (level: number, sessionType: SessionType = "regular") => {
      stateRef.current = {
        level,
        sessionType,
        startedAt: new Date(),
        attempts: [],
      };
      savingRef.current = false;
    },
    [],
  );

  const recordNote = useCallback((attempt: NoteAttempt) => {
    if (!stateRef.current) {
      console.warn("[SessionRecorder] 세션이 시작되지 않음. recordNote 무시.");
      return;
    }
    const offsetMs = getUserEnvOffset();
    const corrected = clampReactionMs(attempt.reactionMs, offsetMs);
    stateRef.current.attempts.push({
      ...attempt,
      reactionMsRaw: attempt.reactionMs,
      reactionMs: corrected,
    });
  }, []);

  const endSession = useCallback(
    async (endReason: SessionEndReason = "completed") => {
      if (savingRef.current) {
        console.warn("[SessionRecorder] 이미 저장 중. 중복 호출 무시.");
        return null;
      }

      const state = stateRef.current;
      if (!state) {
        console.warn("[SessionRecorder] 세션이 없음.");
        return null;
      }

      if (!user) {
        stateRef.current = null;
        return null;
      }

      if (state.attempts.length === 0) {
        stateRef.current = null;
        return null;
      }

      savingRef.current = true;

      try {
        const endedAt = new Date();
        const durationSeconds = Math.max(
          1,
          Math.floor((endedAt.getTime() - state.startedAt.getTime()) / 1000),
        );

        const totalNotes = state.attempts.length;
        const correctNotes = state.attempts.filter((a) => a.correct).length;
        const accuracy = totalNotes > 0 ? correctNotes / totalNotes : 0;
        const avgReactionMs =
          totalNotes > 0
            ? Math.round(
                state.attempts.reduce((sum, a) => sum + a.reactionMs, 0) /
                  totalNotes,
              )
            : 0;

        const xpBreakdown = calculateXPBreakdown(
          state.attempts,
          state.level,
          endReason,
        );
        const { weakNotes, strongNotes } = extractNoteStats(state.attempts);

        const trebleCount = state.attempts.filter(
          (a) => a.clef === "treble",
        ).length;
        const bassCount = state.attempts.filter(
          (a) => a.clef === "bass",
        ).length;

        const accidentalCounts: Record<string, number> = {};
        for (const a of state.attempts) {
          const key = a.accidental || "natural";
          accidentalCounts[key] = (accidentalCounts[key] || 0) + 1;
        }

        const noteAttempts = state.attempts.map((a) => ({
          note: a.note,
          correct: a.correct,
          reaction_ms: a.reactionMs,
          reaction_ms_raw: a.reactionMsRaw ?? a.reactionMs,
          clef: a.clef,
          accidental: a.accidental ?? null,
        }));

        const avgReactionMsRaw =
          totalNotes > 0
            ? Math.round(
                state.attempts.reduce(
                  (sum, a) => sum + (a.reactionMsRaw ?? a.reactionMs),
                  0,
                ) / totalNotes,
              )
            : 0;

        const summary = {
          weak_notes: weakNotes.map((n) => n.note),
          strong_notes: strongNotes.map((n) => n.note),
          clefs: { treble: trebleCount, bass: bassCount },
          accidentals: accidentalCounts,
          perfect: correctNotes === totalNotes && endReason === "completed",
          end_reason: endReason,
          xp_breakdown: xpBreakdown,
          avg_reaction_ms_raw: avgReactionMsRaw,
          offset_ms_applied: getUserEnvOffset(),
        };

        const { data, error } = await supabase
          .from("user_sessions")
          .insert({
            user_id: user.id,
            level: state.level,
            started_at: state.startedAt.toISOString(),
            ended_at: endedAt.toISOString(),
            duration_seconds: durationSeconds,
            total_notes: totalNotes,
            correct_notes: correctNotes,
            accuracy: accuracy,
            avg_reaction_ms: avgReactionMs,
            xp_earned: xpBreakdown.total,
            session_type: state.sessionType,
            note_attempts: noteAttempts,
            summary: summary,
          })
          .select()
          .single();

        if (error) {
          console.error("[SessionRecorder] DB 저장 실패:", error);
          return null;
        }

        stateRef.current = null;

        return {
          sessionId: data.id,
          xpEarned: xpBreakdown.total,
          xpBreakdown,
          accuracy,
          totalNotes,
          correctNotes,
          durationSeconds,
          avgReactionMs,
          weakNotes,
          strongNotes,
          isPerfect: correctNotes === totalNotes && endReason === "completed",
          endReason,
        };
      } catch (err) {
        console.error("[SessionRecorder] 예외 발생:", err);
        return null;
      } finally {
        savingRef.current = false;
      }
    },
    [user],
  );

  const cancelSession = useCallback(() => {
    stateRef.current = null;
    savingRef.current = false;
  }, []);

  return {
    startSession,
    recordNote,
    endSession,
    cancelSession,
    isRecording: stateRef.current !== null,
  };
}