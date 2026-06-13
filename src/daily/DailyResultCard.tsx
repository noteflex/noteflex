// Daily Challenge — 결과 카드 (시각 리디자인).
// 데이터·점수·status 분류·공유 텍스트 로직 0 변경 — 레이아웃·타이틀·스탯만.
// 닫기 정책: 버튼만 (backdrop·ESC 닫기 미구현 — 결과 모달 규칙).

import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { useStreak } from "@/hooks/useStreak";
import { NOTES_PER_TURN, TOTAL_TURNS } from "./dailyGenerator";
import {
  type ShareLocale,
  buildResultMatrix,
  buildShareText,
  buildShareTitle,
} from "./dailyShare";
import { renderDailyCard } from "./dailyCardImage";
import type { DailyFinalResult, DailyResultStatus } from "./dailyTypes";

// ── 셀 색 (CELL_BG/CELL_RING) — 기존 그대로, 손대지 않음 ──────
const CELL_BG: Record<DailyResultStatus, string> = {
  correct_fast: "bg-emerald-500",
  correct_slow: "bg-amber-400",
  wrong: "bg-red-500",
  timeout: "bg-red-500",
  unreached: "bg-gray-300 dark:bg-gray-600",
};

const CELL_RING: Record<DailyResultStatus, string> = {
  correct_fast: "ring-emerald-700/30",
  correct_slow: "ring-amber-700/30",
  wrong: "ring-red-700/30",
  timeout: "ring-red-700/30",
  unreached: "ring-gray-500/20",
};

// ── 데일리 일련번호 — 로컬 자정 기준 (UTC 절단 금지) ──────────
const DAILY_EPOCH_Y = 2026;
const DAILY_EPOCH_M = 6; // 1-based
const DAILY_EPOCH_D = 1;

const EN_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * "YYYY-MM-DD" 로컬 날짜 키 → 데일리 일련번호 N.
 * EPOCH = 2026-06-01 로컬 자정. N = floor((TODAY - EPOCH) / 86,400,000) + 1.
 *
 * 반드시 로컬 Y/M/D 컴포넌트로 Date 생성. `new Date(Y, M-1, D)`는 로컬 자정을 반환.
 * `new Date("YYYY-MM-DD")`/`toISOString().slice(...)` 류는 UTC 절단 버그 위험으로 사용 금지.
 */
function dailyNumberFromDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return 1;
  const todayLocalMidnight = new Date(y, m - 1, d).getTime();
  const epochLocalMidnight = new Date(
    DAILY_EPOCH_Y,
    DAILY_EPOCH_M - 1,
    DAILY_EPOCH_D,
  ).getTime();
  const diffDays = Math.floor(
    (todayLocalMidnight - epochLocalMidnight) / 86_400_000,
  );
  return diffDays + 1;
}

function formatDateLine(dateKey: string, isKo: boolean): string {
  const [y, m, d] = dateKey.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return dateKey;
  if (isKo) return `${y}년 ${m}월 ${d}일`;
  return `${EN_MONTHS[m - 1] ?? ""} ${d}, ${y}`;
}

// ════════════════════════════════════════════════════════════
// 메인
// ════════════════════════════════════════════════════════════
interface Props {
  result: DailyFinalResult;
  onExit: () => void;
}

export function DailyResultCard({ result, onExit }: Props) {
  const { user } = useAuth();
  const { lang } = useLang();
  const streak = useStreak();
  const locale: ShareLocale = lang === "ko" ? "ko" : "en";
  const isKo = locale === "ko";

  const matrix = useMemo(() => buildResultMatrix(result.results), [result.results]);
  const dailyNo = useMemo(() => dailyNumberFromDateKey(result.dateKey), [result.dateKey]);
  const dateLine = useMemo(() => formatDateLine(result.dateKey, isKo), [result.dateKey, isKo]);

  const total = TOTAL_TURNS * NOTES_PER_TURN;
  const turnsPlayed = Math.min(TOTAL_TURNS, Math.ceil(result.reached / NOTES_PER_TURN));

  // ── 토스트 (인라인, 자가 폐기) ─────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  }, []);

  // ── 공유 중 상태 (버튼 중복 클릭 방지) ─────────────────────────
  const [isSharing, setIsSharing] = useState(false);

  // ── 공유 핸들러 ────────────────────────────────────────────────
  // 우선순위:
  //   1) canvas로 카드 PNG 생성 → navigator.share({ files })
  //   2) navigator.share({ text }) — 기존 텍스트 경로
  //   3) clipboard.writeText / execCommand("copy") 폴백
  // AbortError(사용자 취소)는 어느 단계든 조용히 종료. 그 외 실패는 다음 단계로 폴백.
  const handleShare = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const title = buildShareTitle(result, locale);

      // 1) 이미지 공유 시도
      try {
        const blob = await renderDailyCard(result, locale);
        const file = new File(
          [blob],
          `noteflex-daily-${dailyNo}.png`,
          { type: "image/png" },
        );
        if (
          typeof navigator !== "undefined" &&
          typeof navigator.share === "function" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] })
        ) {
          try {
            await navigator.share({ files: [file], title });
            return;
          } catch (err) {
            if ((err as Error)?.name === "AbortError") return;
            // share 실패 → 텍스트 경로로 폴백
          }
        }
      } catch {
        // 이미지 생성 실패 → 텍스트 경로로 폴백
      }

      // 2) 텍스트 공유 (기존 경로)
      const text = buildShareText(result, locale);
      const canShareText =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function";

      if (canShareText) {
        try {
          await navigator.share({ title, text });
          return;
        } catch (err) {
          if ((err as Error)?.name === "AbortError") return;
        }
      }

      // 3) 클립보드 폴백
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          showToast(isKo ? "복사됐어요" : "Copied to clipboard");
          return;
        }
      } catch {
        /* fallthrough */
      }

      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast(isKo ? "복사됐어요" : "Copied to clipboard");
      } catch {
        showToast(isKo ? "공유 실패" : "Share failed");
      }
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, isKo, locale, result, dailyNo, showToast]);

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-xs mx-auto animate-fade-up py-6 px-4">
      {/* ── 타이틀 + 날짜 강조 (📅 prefix, FG 색, 키움) — 공유 이미지와 정합 ── */}
      <div className="flex flex-col items-center gap-1.5">
        <h2 className="text-[16px] font-medium text-foreground text-center leading-tight">
          🎼 {isKo ? "데일리 챌린지" : "Daily challenge"}
        </h2>
        <span className="text-[14px] font-semibold text-foreground">
          📅 {dateLine}
        </span>
      </div>

      {/* ── 점수 + 정답 ── */}
      <div className="flex flex-col items-center gap-1">
        <div className="text-6xl font-extrabold text-primary tabular-nums leading-none">
          {result.score.toLocaleString()}
          <span className="ml-1 text-base font-medium text-muted-foreground align-baseline">
            {isKo ? "점" : "pts"}
          </span>
        </div>
        <span className="text-[13px] text-muted-foreground tabular-nums">
          {isKo ? "정답" : "Correct"} {result.correct}/{total}
        </span>
      </div>

      {/* ── 스트릭 배지 (Step 2) — 로그인 + currentStreak > 0 일 때만 ── */}
      {user && !streak.loading && streak.currentStreak > 0 && (
        <div
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[13px] font-semibold"
          aria-label={
            isKo
              ? `스트릭 ${streak.currentStreak}일 연속`
              : `${streak.currentStreak}-day streak`
          }
        >
          <span
            aria-hidden="true"
            style={streak.todayDone ? { color: "#BA7517" } : undefined}
            className={streak.todayDone ? "" : "text-muted-foreground opacity-60"}
          >
            🔥
          </span>
          <span className={streak.todayDone ? "text-foreground" : "text-muted-foreground"}>
            {isKo
              ? `${streak.currentStreak}일 연속`
              : `${streak.currentStreak}-day streak`}
          </span>
        </div>
      )}

      {/* ── 5×5 그리드 — T1~T5 라벨만, 우측 카테고리 라벨 제거 ── */}
      <div className="w-full flex flex-col gap-1.5">
        {matrix.map((row, turnIdx) => (
          <div key={turnIdx} className="flex items-center gap-2">
            <span className="w-7 text-[11px] font-semibold text-muted-foreground text-right tabular-nums">
              T{turnIdx + 1}
            </span>
            <div className="flex-1 grid grid-cols-5 gap-1.5">
              {row.map((status, i) => (
                <div
                  key={i}
                  className={`h-8 rounded-md ring-1 ${CELL_BG[status]} ${CELL_RING[status]}`}
                  aria-label={`turn-${turnIdx + 1}-q${i + 1}-${status}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── 3-스탯 (이모지 + 숫자 + 라벨) ── */}
      <div className="grid grid-cols-3 gap-2 w-full text-center">
        <EmojiStat
          emoji="🔥"
          value={String(result.bestStreak)}
          label={isKo ? "최고 콤보" : "Best combo"}
        />
        <EmojiStat
          emoji="🎯"
          value={`${turnsPlayed}/${TOTAL_TURNS}`}
          label={isKo ? "진행 턴" : "Turns"}
        />
        <EmojiStat
          emoji="❤️"
          value={String(result.livesRemaining)}
          label={isKo ? "남은 생명" : "Lives"}
        />
      </div>

      {!result.completed && (
        <p className="text-xs text-muted-foreground text-center">
          {isKo
            ? `생명 소진으로 중간 종료. ${total - result.reached}문제는 도달하지 못했습니다.`
            : `Ended early. ${total - result.reached} questions were not reached.`}
        </p>
      )}

      {/* ── 색 범례 — 그리드 셀 색 의미. 공유 이미지(canvas) 범례와 라벨·색 1:1 ── */}
      <ColorLegend isKo={isKo} />

      {/* ── 액션 버튼 ── */}
      <div className="flex gap-3 w-full mt-1">
        <button
          onClick={handleShare}
          disabled={isSharing}
          className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
          aria-label="share-daily-result"
        >
          <ShareIcon />
          {isSharing
            ? isKo ? "준비 중..." : "Preparing..."
            : isKo ? "공유하기" : "Share"}
        </button>
        <button
          onClick={onExit}
          className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-card text-foreground font-semibold text-sm hover:bg-muted active:scale-95 transition-all"
          aria-label="back-to-level-select"
        >
          {isKo ? "레벨 선택" : "Level Select"}
        </button>
      </div>

      {/* ── 토스트 (인라인) ── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-foreground text-background text-sm font-medium shadow-lg animate-fade-up"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

// ── 색 범례 — 셀 색 의미 ───────────────────────────────────────
// status 의미는 dailyTypes.ts 기준:
//   correct_fast(emerald) = 빠른 정답
//   correct_slow(amber)   = 느린 정답
//   wrong+timeout(red)    = 오답·시간초과
//   unreached(gray)       = 생명 소진 미도달
// 라벨은 공유 이미지(dailyCardImage) 범례와 1:1.
function ColorLegend({ isKo }: { isKo: boolean }) {
  const items: Array<{ chip: string; label: string }> = isKo
    ? [
        { chip: "bg-emerald-500", label: "빠름" },
        { chip: "bg-amber-400", label: "느림" },
        { chip: "bg-red-500", label: "오답" },
        { chip: "bg-gray-300 dark:bg-gray-600", label: "미도달" },
      ]
    : [
        { chip: "bg-emerald-500", label: "Quick" },
        { chip: "bg-amber-400", label: "Slow" },
        { chip: "bg-red-500", label: "Miss" },
        { chip: "bg-gray-300 dark:bg-gray-600", label: "Skip" },
      ];
  return (
    <div className="grid grid-cols-4 gap-2 w-full">
      {items.map((it, i) => (
        <div
          key={i}
          className="flex items-center justify-center gap-1.5"
        >
          <span
            aria-hidden="true"
            className={`inline-block w-3.5 h-3.5 rounded ${it.chip}`}
          />
          <span className="text-[12px] font-semibold text-foreground">
            {it.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── 이모지 스탯 셀 ─────────────────────────────────────────────
function EmojiStat({
  emoji,
  value,
  label,
}: {
  emoji: string;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center justify-center gap-1 leading-none">
        <span className="text-base" aria-hidden="true">{emoji}</span>
        <span className="text-[17px] font-bold text-foreground tabular-nums">
          {value}
        </span>
      </div>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
