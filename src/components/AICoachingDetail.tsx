import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { format as formatI18n } from "@/i18n/strings";
import { fetchUserNoteLogs } from "@/lib/userNoteLogs";
import {
  computeNoteComparison,
  type NoteComparisonResult,
  type NoteComparison,
} from "@/lib/noteComparison";

interface AICoachingDetailProps {
  /** 게임 결과 다이얼로그 안에 박힌 영역 — 사인인 사용자 한정 박음. */
  enabled?: boolean;
}

const NULL_RESULT: NoteComparisonResult = {
  hasEnough: false,
  faster: [],
  slower: [],
  accUp: [],
  accDown: [],
};

/**
 * 음표별 비교 분석 — 빠른/느린/정확도 ↑↓ Top 2씩 박음.
 * Guest = 박지 말 것 (useAuth 분기).
 * 데이터 부족 영역 = "이전 기록 충분하지 않음" 메시지 박음.
 */
export function AICoachingDetail({ enabled = true }: AICoachingDetailProps) {
  const { user } = useAuth();
  const t = useT();
  const [result, setResult] = useState<NoteComparisonResult>(NULL_RESULT);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !user) return;
    let cancelled = false;
    setLoading(true);
    fetchUserNoteLogs(200).then(({ data }) => {
      if (cancelled) return;
      if (!data) {
        setResult(NULL_RESULT);
      } else {
        setResult(computeNoteComparison(data));
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, user]);

  if (!enabled || !user || loading) return null;

  if (!result.hasEnough) {
    // 신규 사용자 영역 — 비교 X 박음
    return null;
  }

  const anyData =
    result.faster.length > 0 ||
    result.slower.length > 0 ||
    result.accUp.length > 0 ||
    result.accDown.length > 0;

  if (!anyData) return null;

  return (
    <div
      className="my-2 rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-2"
      data-testid="ai-coaching-detail"
    >
      {result.faster.length > 0 && (
        <CategoryRow
          title={t.aiCoachingDetail.fasterNotesTitle}
          items={result.faster.map((c) =>
            formatI18n(t.aiCoachingDetail.noteDeltaSeconds, {
              note: c.noteKey,
              sign: "",
              delta: c.deltaSec.toFixed(1),
            })
          )}
        />
      )}
      {result.slower.length > 0 && (
        <CategoryRow
          title={t.aiCoachingDetail.slowerNotesTitle}
          items={result.slower.map((c) =>
            formatI18n(t.aiCoachingDetail.noteDeltaSeconds, {
              note: c.noteKey,
              sign: "+",
              delta: c.deltaSec.toFixed(1),
            })
          )}
        />
      )}
      {result.accUp.length > 0 && (
        <CategoryRow
          title={t.aiCoachingDetail.accuracyUpTitle}
          items={result.accUp.map((c) =>
            formatI18n(t.aiCoachingDetail.noteDeltaPp, {
              note: c.noteKey,
              sign: "+",
              delta: String(c.deltaAccPp),
            })
          )}
        />
      )}
      {result.accDown.length > 0 && (
        <CategoryRow
          title={t.aiCoachingDetail.accuracyDownTitle}
          items={result.accDown.map((c) =>
            formatI18n(t.aiCoachingDetail.noteDeltaPp, {
              note: c.noteKey,
              sign: "",
              delta: String(c.deltaAccPp),
            })
          )}
        />
      )}
    </div>
  );
}

function CategoryRow({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-semibold text-foreground text-[11px] shrink-0">{title}</span>
      <span className="text-muted-foreground font-mono text-[11px]">
        {items.join(", ")}
      </span>
    </div>
  );
}

// noop import (NoteComparison 타입 외부 노출 X)
void ({} as NoteComparison);
