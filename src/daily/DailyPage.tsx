// Daily Challenge — 라우트 페이지.
// 확인 모달(버튼만, backdrop/ESC 닫기 금지) → DailyChallenge.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { GameErrorBoundary } from "@/components/GameErrorBoundary";
import Seo from "@/components/Seo";
import { useLang, useT } from "@/contexts/LanguageContext";
import { DailyChallenge } from "./DailyChallenge";

type Stage = "confirm" | "play";

function getTodayParts(now: Date = new Date()): {
  day: number;
  month: number;
  weekdayKo: string;
  weekdayEn: string;
} {
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const koWk = ["일", "월", "화", "수", "목", "금", "토"];
  const enWk = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    day,
    month,
    weekdayKo: koWk[now.getDay()],
    weekdayEn: enWk[now.getDay()],
  };
}

export default function DailyPage() {
  const navigate = useNavigate();
  const t = useT();
  const { lang } = useLang();
  const [stage, setStage] = useState<Stage>("confirm");
  const today = useMemo(() => getTodayParts(), []);

  const goLevelSelect = () => navigate("/play");

  const seoBlock = (
    <Seo
      title={t.pageMeta.play.title}
      description={t.pageMeta.play.description}
      canonical="https://noteflex.app/daily"
      lang={lang === "ko" ? "ko" : "en"}
      noindex
    />
  );

  if (stage === "confirm") {
    const isKo = lang === "ko";
    const monthLabel = isKo ? `${today.month}월` : monthEnShort(today.month);
    const weekdayLabel = isKo ? today.weekdayKo : today.weekdayEn;
    const titleLine = isKo ? "데일리 챌린지" : "Daily Challenge";
    const bodyLine = isKo
      ? "오늘은 단 한 번만 도전할 수 있어요."
      : "You can play only once today.";
    const swipeText = isKo
      ? "조표 문제에선 음을 고른 뒤, 위로 밀면 ♯ · 아래로 밀면 ♭이에요."
      : "On key-signature notes, pick the note then swipe up for ♯, down for ♭.";
    const swipeTitle = isKo ? "조표 입력" : "Key-signature input";
    const cancelLabel = isKo ? "취소" : "Cancel";
    const startLabel = isKo ? "시작하기" : "Start";

    return (
      <div className="flex flex-col min-h-screen">
        {seoBlock}
        <Header />
        <div className="safe-area-page flex-1 flex items-center justify-center px-4">
          {/* backdrop·ESC 닫기 미구현 — 결과·확인 모달 규칙 */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="daily-confirm"
            className="bg-card rounded-3xl border border-border shadow-xl p-8 sm:p-10 w-full max-w-md mx-4 flex flex-col items-center gap-6"
          >
            {/* 오늘 날짜 — 캘린더 페이지 모티브 */}
            <div className="flex flex-col items-center">
              <div className="rounded-2xl border border-amber-300 bg-white dark:bg-amber-950/30 dark:border-amber-700 shadow-sm overflow-hidden w-28">
                <div className="bg-gradient-to-b from-red-500 to-red-600 text-white text-center text-xs font-bold uppercase tracking-wider py-1">
                  {monthLabel}
                </div>
                <div className="flex flex-col items-center py-2">
                  <span className="text-5xl font-extrabold text-foreground tabular-nums leading-none">
                    {today.day}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground mt-1">
                    {weekdayLabel}
                  </span>
                </div>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground text-center">
              {titleLine}
            </h1>

            <p className="text-lg sm:text-xl font-bold text-foreground text-center leading-snug">
              {bodyLine}
            </p>

            {/* 스와이프 입력 안내 — 일반 게임 AccidentalSwipeTutorial 패턴 인라인 복제. */}
            <div
              className="w-full rounded-xl border border-border bg-muted/40 p-3 flex flex-col gap-2"
              aria-label="daily-swipe-guide"
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {swipeTitle}
              </div>
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-1 shrink-0">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 font-bold text-sm">
                    ↑
                  </span>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-bold text-sm">
                    ↓
                  </span>
                </div>
                <p className="flex-1 text-sm text-foreground leading-relaxed">
                  {swipeText}
                </p>
              </div>
            </div>

            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={goLevelSelect}
                className="flex-1 px-5 py-3 rounded-xl border border-border bg-card text-foreground font-semibold text-base hover:bg-muted active:scale-95 transition-all"
              >
                {cancelLabel}
              </button>
              <button
                onClick={() => setStage("play")}
                className="flex-1 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-base shadow-lg hover:shadow-xl active:scale-95 transition-all"
              >
                {startLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GameErrorBoundary>
      {seoBlock}
      <div
        className="safe-area-page min-h-[100dvh] overflow-y-auto flex flex-col items-center justify-center py-4 px-4"
        style={{
          background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)",
        }}
      >
        <DailyChallenge onExit={goLevelSelect} />
      </div>
    </GameErrorBoundary>
  );
}

function monthEnShort(m: number): string {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] ?? "";
}
