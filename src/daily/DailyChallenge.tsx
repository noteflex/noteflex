// Daily Challenge — 자체 플레이 루프.
// 타이머·생명·단일 음 입력·콤보·반응속도 측정 모두 자체 구현.
// 기존 NoteGame / levelSystem / adaptive / weakness 의존성 없음.
// 사운드는 부수효과 함수(playNote/playWrong/ensureAudioReady)만 사용.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { playNote, playWrong, ensureAudioReady } from "@/lib/sound";
import { getLocalDateKey } from "@/lib/localDate";
import { logger } from "@/lib/sentry";
import { DailyStaff, type DailyBatchNote } from "./DailyStaff";
import { DailyButtons } from "./DailyButtons";
import { DailyEdgeGlow } from "./DailyEdgeGlow";
import { DailyResultCard } from "./DailyResultCard";
import {
  NOTES_PER_TURN,
  TOTAL_QUESTIONS,
  TOTAL_TURNS,
  answerOf,
  generateDailyQuestions,
  getDailySeedKey,
  groupByTurn,
  soundKeyOf,
} from "./dailyGenerator";
import { classifyCorrect, computeDailyScore } from "./dailyScoring";
import type {
  DailyFinalResult,
  DailyQuestion,
  DailyQuestionResult,
} from "./dailyTypes";

// ── 플레이 파라미터 ─────────────────────────────────────────────
const DAILY_TIMER_SECONDS = 5;
const DAILY_MAX_LIVES = 3;
const COUNTDOWN_SECONDS = 3;

type Phase = "countdown" | "playing" | "ended";

interface DailyChallengeProps {
  /** 게임 종료 후 사용자가 '나가기' 버튼을 눌렀을 때만 호출. 자동 navigate 금지. */
  onExit: () => void;
  onFinish?: (result: DailyFinalResult) => void;
}

export function DailyChallenge({ onExit, onFinish }: DailyChallengeProps) {
  const dateKey = useMemo(() => getDailySeedKey(), []);
  const allQuestions = useMemo(() => generateDailyQuestions(dateKey), [dateKey]);
  const turns: DailyQuestion[][] = useMemo(
    () => groupByTurn(allQuestions),
    [allQuestions],
  );

  // admin 테스트 모드 — 생명 소진 우회로 25문제 끝까지 진행. 점수·결과 로직은 그대로.
  // 비admin·프로덕션엔 활성화되지 않음 (profile.role === "admin" 게이트).
  // user는 스트릭 갱신 RPC 호출 가드용.
  const { profile, user } = useAuth();
  const isTestMode = profile?.role === "admin";

  // i18n — 인게임 카피만 분기 (게임 로직 0 영향).
  const { lang } = useLang();
  const isKo = lang === "ko";

  // ── 상태 ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const [turnIdx, setTurnIdx] = useState(0);
  const [indexInBatch, setIndexInBatch] = useState(0);

  const [lives, setLives] = useState(DAILY_MAX_LIVES);
  const [streak, setStreak] = useState(0);
  const [results, setResults] = useState<DailyQuestionResult[]>([]);

  const [timerKey, setTimerKey] = useState(0);
  const [timerMs, setTimerMs] = useState(DAILY_TIMER_SECONDS * 1000);

  const [glow, setGlow] = useState<{ kind: "correct" | "incorrect" | null; key: number }>({
    kind: null,
    key: 0,
  });
  const fireGlow = useCallback((kind: "correct" | "incorrect") => {
    setGlow((p) => ({ kind, key: p.key + 1 }));
  }, []);

  const [finalResult, setFinalResult] = useState<DailyFinalResult | null>(null);
  const finishedRef = useRef(false);

  const questionStartRef = useRef<number>(0);

  const currentBatch = turns[turnIdx] ?? [];
  const currentQuestion: DailyQuestion | null =
    phase === "playing" && currentBatch[indexInBatch]
      ? currentBatch[indexInBatch]
      : null;

  const currentKeySig = currentBatch[0]?.keySignature ?? { name: "C major" };

  // ── 사운드 사전 활성화 (mount 시) ──────────────────────────────
  useEffect(() => {
    ensureAudioReady().catch(() => {
      // silent: 폴백 synth가 처리.
    });
  }, []);

  // ── 카운트다운 (1초 간격, 0 → playing 진입) ────────────────────
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      // 동기화 앵커 = handleCountdownComplete 등가.
      // 카운트다운 끝 → 단일 setState batch로 사운드/타이머/visible 모두 즉시 일치.
      setPhase("playing");
      questionStartRef.current = performance.now();
      setTimerMs(DAILY_TIMER_SECONDS * 1000);
      setTimerKey((k) => k + 1);
      const first = currentBatch[0];
      if (first) {
        // ensureAudioReady는 mount 시 이미 호출됨 — 여기선 즉시 재생.
        try {
          playNote(soundKeyOf(first));
        } catch {
          /* sampler 실패는 sound 모듈 내부에서 처리 */
        }
      }
      return;
    }
    const id = window.setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown]);

  // ── 문제 전환 시 사운드 + 시작 타임스탬프 (countdown 이후) ─────
  useEffect(() => {
    if (phase !== "playing" || !currentQuestion) return;
    // turnIdx/indexInBatch가 0/0인 첫 트리거는 countdown 종료 effect가 처리하므로 skip.
    // 그 외 advance에서만 사운드 재생.
    if (turnIdx === 0 && indexInBatch === 0 && results.length === 0) return;
    questionStartRef.current = performance.now();
    setTimerMs(DAILY_TIMER_SECONDS * 1000);
    setTimerKey((k) => k + 1);
    try {
      playNote(soundKeyOf(currentQuestion));
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnIdx, indexInBatch, phase]);

  // ── 타이머 tick ───────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || !currentQuestion) return;
    const tickMs = 1000 / 30;
    const id = window.setInterval(() => {
      setTimerMs((prev) => Math.max(0, prev - tickMs));
    }, tickMs);
    return () => window.clearInterval(id);
  }, [phase, currentQuestion, timerKey]);

  // ── 종료 처리 (lives==0 또는 전 문제 완료) ─────────────────────
  const finalizeIfNeeded = useCallback(
    (
      latestResults: DailyQuestionResult[],
      latestLives: number,
      reachedCount: number,
    ) => {
      if (finishedRef.current) return false;

      const livesGone = latestLives <= 0;
      const reachedEnd = reachedCount >= allQuestions.length;
      if (!livesGone && !reachedEnd) return false;

      const fullResults: DailyQuestionResult[] = [...latestResults];
      for (let i = fullResults.length; i < allQuestions.length; i++) {
        fullResults.push({
          questionIndex: i,
          status: "unreached",
          responseTimeMs: null,
          wasKeySig: allQuestions[i].category === "keysig",
        });
      }

      const correct = fullResults.filter(
        (r) => r.status === "correct_fast" || r.status === "correct_slow",
      ).length;
      const reached = fullResults.filter((r) => r.status !== "unreached").length;
      const completed = reached === allQuestions.length;

      let cur = 0;
      let best = 0;
      for (const r of fullResults) {
        const ok = r.status === "correct_fast" || r.status === "correct_slow";
        if (ok) {
          cur += 1;
          if (cur > best) best = cur;
        } else {
          cur = 0;
        }
      }

      const score = computeDailyScore(fullResults, latestLives);

      const result: DailyFinalResult = {
        dateKey,
        score,
        results: fullResults,
        livesRemaining: latestLives,
        reached,
        correct,
        bestStreak: best,
        completed,
      };
      finishedRef.current = true;
      setFinalResult(result);
      setPhase("ended");
      onFinish?.(result);

      // ── 스트릭 갱신 (부가, fire-and-forget) ──────────────────────
      // 데일리는 user_sessions에 기록 안 함(분석 격리). 스트릭만 별도 RPC로 +1.
      // 비로그인은 RPC가 auth.uid() 체크 후 no-op. user 가드는 무의미 호출 절약 목적.
      if (user) {
        const localDate = getLocalDateKey();
        void supabase
          .rpc("record_practice_day", { p_local_date: localDate })
          .then(({ error }) => {
            if (error) {
              logger.warn("record_practice_day RPC 실패 (데일리)", {
                cause: error.message,
                user_id: user.id,
                local_date: localDate,
              });
            }
          });
      }

      return true;
    },
    [allQuestions, dateKey, onFinish, user],
  );

  // ── 정답/오답/타임아웃 공통: 한 문제 결과를 적용하고 다음 위치로 ──
  const recordResultAndAdvance = useCallback(
    (
      addedResult: DailyQuestionResult,
      consumeLife: boolean,
    ) => {
      // 테스트 모드: 생명 차감 무시 → game over 자체가 트리거되지 않음.
      // status(정답/빠름/느림/오답/timeout) 분류·점수·결과 매트릭스는 그대로.
      const livesLost = consumeLife && !isTestMode;
      const nextResults = [...results, addedResult];
      const nextLives = livesLost ? Math.max(0, lives - 1) : lives;

      const isCorrect =
        addedResult.status === "correct_fast" || addedResult.status === "correct_slow";
      setStreak((s) => (isCorrect ? s + 1 : 0));

      // 다음 위치 계산.
      const isLastInBatch = indexInBatch + 1 >= currentBatch.length;
      let nextTurnIdx = turnIdx;
      let nextIndexInBatch = indexInBatch + 1;
      if (isLastInBatch) {
        nextTurnIdx = turnIdx + 1;
        nextIndexInBatch = 0;
      }

      setResults(nextResults);
      if (livesLost) setLives(nextLives);

      // 종료 판정 — reached = nextResults.length. 테스트 모드면 nextLives === lives라
      // livesGone 분기가 트리거되지 않음. 끝까지 도달 시에만 finalize.
      if (finalizeIfNeeded(nextResults, nextLives, nextResults.length)) return;

      setTurnIdx(nextTurnIdx);
      setIndexInBatch(nextIndexInBatch);
    },
    [currentBatch.length, finalizeIfNeeded, indexInBatch, isTestMode, lives, results, turnIdx],
  );

  // ── 입력 ──────────────────────────────────────────────────────
  const handleAnswer = useCallback(
    (answer: string) => {
      if (phase !== "playing" || !currentQuestion) return;
      const elapsed = performance.now() - questionStartRef.current;
      const correct = answer === answerOf(currentQuestion);

      if (correct) {
        fireGlow("correct");
        recordResultAndAdvance(
          {
            questionIndex: currentQuestion.index,
            status: classifyCorrect(elapsed),
            responseTimeMs: elapsed,
            wasKeySig: currentQuestion.category === "keysig",
          },
          false,
        );
      } else {
        playWrong();
        fireGlow("incorrect");
        recordResultAndAdvance(
          {
            questionIndex: currentQuestion.index,
            status: "wrong",
            responseTimeMs: elapsed,
            wasKeySig: currentQuestion.category === "keysig",
          },
          true,
        );
      }
    },
    [currentQuestion, fireGlow, phase, recordResultAndAdvance],
  );

  // ── 타이머 만료 ───────────────────────────────────────────────
  // 중복 발화 방지 메커니즘:
  //   본문 진입 즉시 setTimerMs(5000)을 호출해 다음 commit의 timerMs를 0이 아닌 값으로 만든다.
  //   recordResultAndAdvance의 setResults/setTurnIdx/setIndexInBatch와 같은 batch에 묶이므로,
  //   advance 반영 commit에서 timeout effect가 deps 변경(currentQuestion·recordResultAndAdvance)
  //   으로 재실행될 때 closure의 timerMs는 5000 → `timerMs > 0` 가드에서 즉시 return.
  //   문제 전환 effect도 같은 5000 값을 setTimerMs하므로 중복은 무해.
  //   (이전 99e9354의 index 기반 ref 가드는 advance 후 currentQuestion.index가 바뀌어 무력화됨.)
  useEffect(() => {
    if (phase !== "playing" || !currentQuestion) return;
    if (timerMs > 0) return;
    setTimerMs(DAILY_TIMER_SECONDS * 1000);
    playWrong();
    fireGlow("incorrect");
    recordResultAndAdvance(
      {
        questionIndex: currentQuestion.index,
        status: "timeout",
        responseTimeMs: DAILY_TIMER_SECONDS * 1000,
        wasKeySig: currentQuestion.category === "keysig",
      },
      true,
    );
  }, [timerMs, phase, currentQuestion, fireGlow, recordResultAndAdvance]);

  // ── 표시용 파생값 ─────────────────────────────────────────────
  const reachedCount = results.length;
  const displayQuestionNo = Math.min(reachedCount + 1, TOTAL_QUESTIONS);
  const timerPct = Math.max(0, Math.min(1, timerMs / (DAILY_TIMER_SECONDS * 1000)));

  // 카운트다운 동안에도 보표가 마운트되어 있도록 batchNotes는 항상 결정.
  const batchNotes: DailyBatchNote[] = currentBatch.map((q) => ({
    letter: q.letter,
    octave: q.octave,
    accidental: q.accidental,
    clef: q.clef,
  }));

  const notesHidden = phase === "countdown";

  // 조표 턴(현재 batch에 조표 표시)일 때만 swipe 입력 활성화.
  // 그 외 턴은 단순 tap → 자연 글자 commit.
  const swipeEnabled =
    (currentKeySig.sharps?.length ?? 0) > 0 || (currentKeySig.flats?.length ?? 0) > 0;

  // ── 결과 카드 (2단계) — 라우트 이동 없음, 인라인 렌더 ──
  if (phase === "ended" && finalResult) {
    return (
      <>
        {isTestMode && <TestBadge />}
        <DailyResultCard result={finalResult} onExit={onExit} />
      </>
    );
  }

  const stageLabel = isKo
    ? `Turn ${turnIdx + 1} / ${TOTAL_TURNS} · 음표 ${NOTES_PER_TURN}개`
    : `Turn ${turnIdx + 1} / ${TOTAL_TURNS} · ${NOTES_PER_TURN} notes`;

  return (
    <div className="flex flex-col items-center gap-3 w-full animate-fade-up">
      {isTestMode && <TestBadge />}
      <DailyEdgeGlow
        key={glow.key}
        trigger={glow.kind}
        onComplete={() => setGlow((p) => ({ ...p, kind: null }))}
      />

      <div className="w-full max-w-[612px] flex flex-col gap-3">
        {/* exit 행 */}
        <div className="w-full flex justify-start pt-1 mt-[10px]">
          <button
            onClick={onExit}
            aria-label="exit-daily"
            className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-3.5 py-2 text-sm font-medium text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground active:scale-95 transition-all"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            {isKo ? "나가기" : "Exit"}
          </button>
        </div>

        {/* 헤더 (점수 · 생명 · 콤보) */}
        <DailyGameHeader
          score={finalResult ? finalResult.score : 0}
          partial={results}
          lives={lives}
          maxLives={DAILY_MAX_LIVES}
          streak={streak}
        />

        {/* 스테이지 라벨 */}
        <div className="w-full flex items-center justify-center gap-3 mt-1">
          <span className="text-sm font-medium text-muted-foreground">
            {stageLabel}
            {currentKeySig.name !== "C major" && ` · ${currentKeySig.name}`}
          </span>
        </div>

        {/* 타이머 바 */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-[width] duration-100 ease-linear"
            style={{ width: `${timerPct * 100}%` }}
          />
        </div>

        {/* 보표 — 항상 마운트, 카운트다운 중엔 invisible로 wrapper + 음표 hidden.
            §sync — 카운트다운 끝 시점에 staff·음표·사운드·타이머 동시에 노출. */}
        <div
          className={`w-full max-w-[612px] mx-auto ${
            phase === "countdown" ? "invisible" : ""
          }`}
        >
          <DailyStaff
            notes={batchNotes}
            activeIndex={indexInBatch}
            keySignature={currentKeySig}
            notesHidden={notesHidden}
          />
        </div>

        {/* 카운트다운 오버레이 — 절대 배치, 보표 자리 위에 큰 숫자 */}
        {phase === "countdown" && (
          <div className="pointer-events-none w-full flex items-center justify-center -mt-32">
            <div className="text-8xl font-extrabold text-primary drop-shadow-lg tabular-nums">
              {countdown > 0 ? countdown : "GO!"}
            </div>
          </div>
        )}

        {/* 질문 + 버튼 — 항상 마운트, 카운트다운 중엔 invisible */}
        <div className={`w-full mt-1 ${phase === "countdown" ? "invisible" : ""}`}>
          <p className="text-center text-sm text-muted-foreground mb-3">
            {isKo
              ? `${displayQuestionNo}/${TOTAL_QUESTIONS}번째 음표의 이름은?`
              : `What is note ${displayQuestionNo}/${TOTAL_QUESTIONS}?`}
            {swipeEnabled && (
              <span className="ml-2 text-xs text-muted-foreground/80">
                {isKo
                  ? "· 위로 스와이프 ♯ / 아래로 ♭"
                  : "· swipe up for ♯ / down for ♭"}
              </span>
            )}
          </p>
          <DailyButtons
            swipeEnabled={swipeEnabled}
            disabled={phase !== "playing" || !currentQuestion}
            onAnswer={handleAnswer}
          />
        </div>
      </div>
    </div>
  );
}

// ── 데일리 헤더: 점수·생명·콤보 ────────────────────────────────
function DailyGameHeader({
  score,
  partial,
  lives,
  maxLives,
  streak,
}: {
  score: number;
  partial: DailyQuestionResult[];
  lives: number;
  maxLives: number;
  streak: number;
}) {
  // 진행 중에도 라이브 점수 미리보기 (생명 보너스 제외) — 사용자에게 즉시 피드백.
  const liveScore =
    score > 0 ? score : computeDailyScore(partial, 0); // 생명 보너스는 종료 시 합산.
  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto px-2 gap-1">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
              Score
            </span>
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {liveScore}
            </span>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground">
            Daily
          </span>
        </div>
        <div className="flex items-center gap-1 relative">
          {Array.from({ length: maxLives }).map((_, i) => (
            <span
              key={i}
              className={`text-xl transition-all duration-300 ${
                i < lives ? "scale-100 opacity-100" : "scale-75 opacity-30 grayscale"
              }`}
            >
              ❤️
            </span>
          ))}
        </div>
      </div>

      <div
        className={`flex items-center gap-1.5 text-xs text-muted-foreground transition-opacity duration-200 ${
          streak > 0 ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden={streak === 0}
      >
        <span>🔥</span>
        <span className="font-semibold">Combo {streak}</span>
      </div>
    </div>
  );
}

// ── admin 테스트 모드 배지 ─────────────────────────────────────
// admin(profile.role === "admin")일 때만 부모에서 렌더됨. 비admin/프로덕션엔 미마운트.
function TestBadge() {
  return (
    <div
      role="status"
      aria-label="daily-test-mode-on"
      className="fixed top-3 right-3 z-50 px-2.5 py-1 rounded-md bg-amber-500 text-white text-[10px] font-bold tracking-widest uppercase shadow-md ring-1 ring-amber-700/40 select-none pointer-events-none"
    >
      TEST
    </div>
  );
}

