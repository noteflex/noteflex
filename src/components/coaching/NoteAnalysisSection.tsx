import { useEffect, useState } from "react";
import { Zap, Snail, Target, TrendingDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { format as formatI18n } from "@/i18n/strings";
import { fetchUserNoteLogs } from "@/lib/userNoteLogs";
import {
  computeNoteComparison,
  type NoteComparisonResult,
  type NoteComparison,
} from "@/lib/noteComparison";
import { GuestNoteBreakdownTeaser } from "./GuestNoteBreakdownTeaser";

/**
 * 5/31 코칭 다이얼로그 — 음표별 분석 섹션.
 * 데이터 fetch는 fetchUserNoteLogs(200) 사용.
 * 표시 컴포넌트 새로:
 *   - 헤더: "음표별 분석 · 최근 30회"
 *   - 4 카테고리(빨라진/정확도↑/느려진/정확도↓) 중 데이터 있는 것만 카드로 표시
 *   - signed-in + 데이터 충분 시 카드 그리드, 아니면 empty state 메시지
 *   - 로그인 안 한 경우 = 섹션 자체 미렌더 (Guest는 비교 데이터 X)
 */

const NULL_RESULT: NoteComparisonResult = {
  hasEnough: false,
  faster: [],
  slower: [],
  accUp: [],
  accDown: [],
};

export function NoteAnalysisSection() {
  const { user } = useAuth();
  const t = useT();
  const [result, setResult] = useState<NoteComparisonResult>(NULL_RESULT);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    fetchUserNoteLogs(200).then(({ data }) => {
      if (cancelled) return;
      setResult(data ? computeNoteComparison(data) : NULL_RESULT);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // 6/01 게스트 = 블러된 더미 카드 + 잠금 오버레이 + 가입 CTA (전환 후킹)
  if (!user) return <GuestNoteBreakdownTeaser />;
  if (loading) return null;

  // 데이터 부족 → friendly empty state
  if (!result.hasEnough) {
    return (
      <div data-testid="note-analysis-empty">
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
          {t.gameDialogs.noteAnalysisTitle}
        </h3>
        <div className="rounded-lg border border-blue-200/60 bg-blue-50/50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900/40">
          {t.gameDialogs.noteAnalysisEmpty}
        </div>
      </div>
    );
  }

  // 4 카테고리 모두 비어있는 case (이론상 hasEnough인데 항목 0개)
  const anyData =
    result.faster.length > 0 ||
    result.slower.length > 0 ||
    result.accUp.length > 0 ||
    result.accDown.length > 0;
  if (!anyData) return null;

  return (
    <div data-testid="note-analysis-grid">
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
        {t.gameDialogs.noteAnalysisTitle}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {result.faster.length > 0 && (
          <AnalysisCard
            tone="success"
            icon={<Zap className="h-3.5 w-3.5" aria-hidden="true" />}
            title={t.aiCoachingDetail.fasterNotesTitle}
            items={result.faster.map((c) => ({
              note: c.noteKey,
              delta: formatI18n(t.aiCoachingDetail.noteDeltaSeconds, {
                note: "",
                sign: "",
                delta: c.deltaSec.toFixed(1),
              }).trim(),
            }))}
          />
        )}
        {result.accUp.length > 0 && (
          <AnalysisCard
            tone="success"
            icon={<Target className="h-3.5 w-3.5" aria-hidden="true" />}
            title={t.aiCoachingDetail.accuracyUpTitle}
            items={result.accUp.map((c) => ({
              note: c.noteKey,
              delta: formatI18n(t.aiCoachingDetail.noteDeltaPp, {
                note: "",
                sign: "+",
                delta: String(c.deltaAccPp),
              }).trim(),
            }))}
          />
        )}
        {result.slower.length > 0 && (
          <AnalysisCard
            tone="danger"
            icon={<Snail className="h-3.5 w-3.5" aria-hidden="true" />}
            title={t.aiCoachingDetail.slowerNotesTitle}
            items={result.slower.map((c) => ({
              note: c.noteKey,
              delta: formatI18n(t.aiCoachingDetail.noteDeltaSeconds, {
                note: "",
                sign: "+",
                delta: c.deltaSec.toFixed(1),
              }).trim(),
            }))}
          />
        )}
        {result.accDown.length > 0 && (
          <AnalysisCard
            tone="danger"
            icon={<TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />}
            title={t.aiCoachingDetail.accuracyDownTitle}
            items={result.accDown.map((c) => ({
              note: c.noteKey,
              delta: formatI18n(t.aiCoachingDetail.noteDeltaPp, {
                note: "",
                sign: "",
                delta: String(c.deltaAccPp),
              }).trim(),
            }))}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 카드 — 카테고리별 음표 목록
// ─────────────────────────────────────────────────────────

interface AnalysisCardItem {
  note: string;
  delta: string;
}

function AnalysisCard({
  tone,
  icon,
  title,
  items,
}: {
  tone: "success" | "danger";
  icon: React.ReactNode;
  title: string;
  items: AnalysisCardItem[];
}) {
  const cls =
    tone === "success"
      ? "border-emerald-200/70 bg-emerald-50/40 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200 dark:border-emerald-900/40"
      : "border-red-200/70 bg-red-50/40 text-red-900 dark:bg-red-950/20 dark:text-red-200 dark:border-red-900/40";
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${cls}`}>
      <div className="flex items-center gap-1.5 text-[13px] font-semibold">
        {icon}
        <span>{title}</span>
      </div>
      <div className="mt-1.5 space-y-1">
        {items.map((it, i) => (
          <div key={i} className="flex items-baseline justify-between">
            <span className="text-[17px] font-semibold tabular-nums">{it.note}</span>
            <span className="font-mono text-[14px] opacity-80">{it.delta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 타입 외부 노출 회피 (no-op import)
void ({} as NoteComparison);
