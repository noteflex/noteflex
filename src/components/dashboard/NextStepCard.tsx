import { useEffect, useMemo, useState } from "react";
import { Crown, Target } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLang, useT } from "@/contexts/LanguageContext";
import { format as formatI18n } from "@/i18n/strings";
import { supabase } from "@/integrations/supabase/client";
import { fetchUserNoteLogs, type UserNoteLogRecord } from "@/lib/userNoteLogs";
import { WEAK_NOTE_GREEN_THRESHOLD, WEAK_NOTE_MIN_SAMPLES } from "@/types/analytics";
import InfoTooltip from "@/components/ui/info-tooltip";

interface NoteStatusRow {
  note_key: string;
  octave: number;
  clef: "treble" | "bass";
  status: "learning" | "weakness" | "graduated" | "regressed";
  recent_20_attempts: number;
  recent_20_correct: number;
  ever_weakness: boolean;
  graduated_at: string | null;
  updated_at: string;
}

interface LiveNote {
  note_key: string;
  octave: number;
  clef: "treble" | "bass";
  live_correct: number;
  live_attempts: number;
}

const GRAD_TARGET = 19;
const GRAD_SUB_HIGH = 16;
const GRAD_SUB_MID = 10;
const NEEDS_TOP_N = 4;
const MASTERED_SLOTS = 3;

/** 한국어 계이름 매핑 — 표준 솔페즈. 영어권은 음이름(C, D, ...) 그대로 사용. */
const SOLFEGE_KO: Record<string, string> = {
  C: "도",
  D: "레",
  E: "미",
  F: "파",
  G: "솔",
  A: "라",
  B: "시",
};

function solfegeOf(noteKey: string): string | null {
  const letter = noteKey[0]?.toUpperCase();
  return letter ? (SOLFEGE_KO[letter] ?? null) : null;
}

function computeRecent20(
  logs: UserNoteLogRecord[],
): Map<string, { attempts: number; correct: number }> {
  const byNote = new Map<string, UserNoteLogRecord[]>();
  for (const log of logs) {
    const k = `${log.note_key}|${log.octave}|${log.clef}`;
    const arr = byNote.get(k);
    if (arr) arr.push(log);
    else byNote.set(k, [log]);
  }
  const result = new Map<string, { attempts: number; correct: number }>();
  for (const [k, arr] of byNote) {
    const recent = arr.slice(0, 20);
    const correct = recent.filter((l) => l.is_correct).length;
    result.set(k, { attempts: recent.length, correct });
  }
  return result;
}

function noteKey(r: { note_key: string; octave: number; clef: string }): string {
  return `${r.note_key}|${r.octave}|${r.clef}`;
}

function noteLabel(r: { note_key: string; octave: number }): string {
  return `${r.note_key}${r.octave}`;
}

function formatBatchUpdated(
  latestMs: number | null,
  t: ReturnType<typeof useT>,
): string {
  if (latestMs == null) return "";
  const deltaMs = Date.now() - latestMs;
  if (deltaMs < 60 * 60 * 1000) return t.dashboard.nextStepBatchUpdatedJustNow;
  const hours = Math.floor(deltaMs / (60 * 60 * 1000));
  if (hours < 24) {
    return formatI18n(t.dashboard.nextStepBatchUpdatedHoursAgo, {
      n: String(hours),
    });
  }
  const days = Math.floor(hours / 24);
  return formatI18n(t.dashboard.nextStepBatchUpdatedDaysAgo, { n: String(days) });
}

export function NextStepCard() {
  const { user } = useAuth();
  const t = useT();
  const { lang } = useLang();
  const [statusRows, setStatusRows] = useState<NoteStatusRow[]>([]);
  const [logs, setLogs] = useState<UserNoteLogRecord[]>([]);
  const [loadedStatus, setLoadedStatus] = useState(false);
  const [loadedLogs, setLoadedLogs] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_note_status")
        .select(
          "note_key, octave, clef, status, recent_20_attempts, recent_20_correct, ever_weakness, graduated_at, updated_at",
        )
        .eq("user_id", user.id);
      if (cancelled) return;
      setStatusRows((data ?? []) as NoteStatusRow[]);
      setLoadedStatus(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await fetchUserNoteLogs(500);
      if (cancelled) return;
      setLogs(data ?? []);
      setLoadedLogs(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const recent20 = useMemo(() => computeRecent20(logs), [logs]);

  const liveCandidates: LiveNote[] = useMemo(() => {
    return statusRows
      .filter((r) => r.ever_weakness && r.status !== "graduated")
      .map((r) => {
        const live = recent20.get(noteKey(r));
        return {
          note_key: r.note_key,
          octave: r.octave,
          clef: r.clef,
          live_correct: live ? live.correct : r.recent_20_correct,
          live_attempts: live ? live.attempts : r.recent_20_attempts,
        };
      })
      .sort((a, b) => b.live_correct - a.live_correct);
  }, [statusRows, recent20]);

  // 라이브 로그 전체 집계 — WeakSlowNotesCards와 동일 임계값·최소 표본 기준.
  // "No weak notes ✓"는 이 값이 false일 때만 표시 (D5 사건 원칙: 임계값 미만 음표가 Top5에
  // 보이는 동안 약점 없음이 동시에 노출되는 일 방지).
  const hasLiveWeakNote = useMemo(() => {
    if (!loadedLogs) return false;
    const totals = new Map<string, { total: number; correct: number }>();
    for (const log of logs) {
      const k = `${log.note_key}|${log.octave}|${log.clef}`;
      const e = totals.get(k) ?? { total: 0, correct: 0 };
      e.total++;
      if (log.is_correct) e.correct++;
      totals.set(k, e);
    }
    for (const v of totals.values()) {
      if (v.total >= WEAK_NOTE_MIN_SAMPLES && v.correct / v.total < WEAK_NOTE_GREEN_THRESHOLD) {
        return true;
      }
    }
    return false;
  }, [logs, loadedLogs]);

  const focusCandidate: LiveNote | null = liveCandidates[0] ?? null;
  const needsPractice: LiveNote[] = liveCandidates.slice(1, 1 + NEEDS_TOP_N);

  const mastered = useMemo(
    () =>
      statusRows
        .filter((r) => r.status === "graduated" && r.graduated_at)
        .sort((a, b) => b.graduated_at!.localeCompare(a.graduated_at!))
        .slice(0, MASTERED_SLOTS),
    [statusRows],
  );

  const batchUpdatedAtMs = useMemo(() => {
    let latest: number | null = null;
    for (const r of statusRows) {
      const t = new Date(r.updated_at).getTime();
      if (!Number.isNaN(t) && (latest == null || t > latest)) latest = t;
    }
    return latest;
  }, [statusRows]);

  if (!user) return null;

  // 좌 박스 톤
  let aTone: "high" | "mid" | "low" = "low";
  let aSubLabel: string = t.dashboard.nextStepASubLow;
  if (focusCandidate) {
    if (focusCandidate.live_correct >= GRAD_SUB_HIGH) {
      aTone = "high";
      aSubLabel = t.dashboard.nextStepASubHigh;
    } else if (focusCandidate.live_correct >= GRAD_SUB_MID) {
      aTone = "mid";
      aSubLabel = t.dashboard.nextStepASubMid;
    }
  }
  const aBarFill =
    aTone === "high"
      ? "bg-primary"
      : aTone === "mid"
        ? "bg-amber-500 dark:bg-amber-400"
        : "bg-muted-foreground/60";
  const aSubColor =
    aTone === "high"
      ? "text-primary"
      : aTone === "mid"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";
  const aNoteColor =
    aTone === "high"
      ? "text-primary"
      : aTone === "mid"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";

  const clefLabel = (clef: "treble" | "bass") =>
    clef === "bass" ? t.analytics.clefBass : t.analytics.clefTreble;

  const focusReady = loadedStatus && loadedLogs;
  const hasNoWeaknessYet =
    focusReady && !focusCandidate && statusRows.length > 0;

  // 좌 박스 큰 텍스트 (계이름 + 음이름)
  const focusSolfege = focusCandidate ? solfegeOf(focusCandidate.note_key) : null;
  const showSolfege = lang === "ko" && focusSolfege;

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      {/* === 두 박스 그리드 (좌 1.2 : 우 1 = 6 : 5) — 카드 하단선 정렬: items-stretch === */}
      <div className="grid grid-cols-1 lg:grid-cols-11 gap-3 lg:items-stretch">
        {/* === [2] 좌 박스 "이 음에 집중" (졸업 임박) === */}
        <div className="lg:col-span-6 rounded-lg p-5 text-center bg-amber-100/60 dark:bg-amber-950/20 border border-amber-300/70 dark:border-amber-900/50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-bold text-amber-700 dark:text-amber-400">
              {t.dashboard.nextStepFocusBoxTitle}
            </p>
            {focusCandidate && (
              <span className={`text-[13px] font-bold ${aSubColor}`}>
                {aSubLabel}
              </span>
            )}
          </div>

          {!focusReady ? (
            <div className="py-6">
              <p className="text-3xl mb-2" aria-hidden>📊</p>
              <p className="text-sm font-medium text-foreground">
                {t.dashboard.nextStepLearningTitle}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.dashboard.nextStepLearningSubtitle}
              </p>
            </div>
          ) : !focusCandidate ? (
            <div className="py-6">
              <p className="text-3xl mb-2" aria-hidden>🚀</p>
              <p className="text-sm font-medium text-foreground">
                {hasNoWeaknessYet
                  ? t.dashboard.nextStepNoneTitle
                  : t.dashboard.nextStepLearningTitle}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasNoWeaknessYet
                  ? t.dashboard.nextStepNoneSubtitle
                  : t.dashboard.nextStepLearningSubtitle}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {/* 큰 음표: ko 계이름 56px + 음이름 24px, en 음이름 56px */}
              <div className="flex items-baseline gap-3">
                {showSolfege && (
                  <span
                    className={`font-bold leading-none tracking-tight ${aNoteColor}`}
                    style={{ fontSize: "56px" }}
                  >
                    {focusSolfege}
                  </span>
                )}
                <span
                  className={`font-mono font-bold leading-none tracking-tight ${
                    showSolfege
                      ? "text-2xl text-muted-foreground"
                      : aNoteColor
                  }`}
                  style={showSolfege ? undefined : { fontSize: "56px" }}
                >
                  {noteLabel(focusCandidate)}
                </span>
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground">
                {clefLabel(focusCandidate.clef)}
              </p>

              {/* 진행 바 max 280px, h-2.5, 채움 amber-500 */}
              <div className="w-full max-w-[280px] mt-4">
                <div className="h-2.5 bg-amber-200/60 dark:bg-amber-900/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${aBarFill}`}
                    style={{
                      width: `${(focusCandidate.live_correct / GRAD_TARGET) * 100}%`,
                    }}
                  />
                </div>
                {/* "14 / 19" + "번 정답" + ⓘ */}
                <div className="flex items-baseline justify-center gap-1.5 mt-2">
                  <span className={`text-base font-bold tabular-nums ${aNoteColor}`}>
                    {focusCandidate.live_correct} / {GRAD_TARGET}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.dashboard.nextStepGradCorrectSuffix}
                  </span>
                  <InfoTooltip
                    content={formatI18n(t.dashboard.nextStepTooltipBody, {
                      current: String(focusCandidate.live_correct),
                    })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* === 우 박스: 상하 분할 (h-full로 좌 박스 높이 따라감) === */}
        <div className="lg:col-span-5 flex flex-col gap-3 lg:h-full">
          {/* === [3] 우상 "연습이 필요한 음" — 세이지 그린 톤, 칩 키움, flex-1로 빈 공간 흡수 === */}
          <div className="rounded-md bg-[#DCE5D5] dark:bg-[#2A3328] border border-[#BDCCB0]/70 dark:border-[#3A4737]/60 px-3.5 py-3 lg:flex-1">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Target
                className="h-3.5 w-3.5 text-emerald-800 dark:text-emerald-300 shrink-0"
                aria-hidden
                strokeWidth={2.5}
              />
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                {t.dashboard.nextStepNeedsBoxTitle}
              </p>
            </div>
            {!focusReady || (needsPractice.length === 0 && hasLiveWeakNote) ? (
              <p className="text-xs text-muted-foreground">
                {t.dashboard.nextStepFootEmpty}
              </p>
            ) : needsPractice.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t.dashboard.nextStepNoNeedsPractice}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {needsPractice.map((n) => {
                  const sf = lang === "ko" ? solfegeOf(n.note_key) : null;
                  return (
                    <span
                      key={noteKey(n)}
                      className="inline-flex items-center gap-2 rounded-full bg-background border border-[#BDCCB0]/80 dark:border-[#4A5A45]/60 px-3.5 py-2"
                    >
                      {sf && (
                        <span className="text-base font-bold text-emerald-900 dark:text-emerald-200 leading-none">
                          {sf}
                        </span>
                      )}
                      <span className="font-mono text-sm font-semibold text-emerald-700/90 dark:text-emerald-400/90 tabular-nums leading-none">
                        {noteLabel(n)}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* === [4] 우하 "마스터한 음" — 블루그레이 톤 === */}
          <div className="rounded-md bg-[#C9D3DD] dark:bg-[#1F2B35] border border-[#A6B5C4]/70 dark:border-[#37475A]/60 px-3.5 py-3">
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-1.5">
                <Crown
                  className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300 shrink-0"
                  aria-hidden
                />
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t.dashboard.nextStepMasteredBoxTitle}
                </p>
              </div>
              {batchUpdatedAtMs != null && (
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {formatBatchUpdated(batchUpdatedAtMs, t)}
                </span>
              )}
            </div>
            {!loadedStatus ? (
              <p className="text-xs text-muted-foreground">
                {t.dashboard.nextStepFootEmpty}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: MASTERED_SLOTS }, (_, i) => {
                  const m = mastered[i];
                  if (!m) {
                    return (
                      <span
                        key={`empty-${i}`}
                        className="inline-flex items-center rounded-full border border-dashed border-border/60 px-3 py-1.5"
                        aria-hidden
                      >
                        <span className="text-xs text-muted-foreground/40">—</span>
                      </span>
                    );
                  }
                  const sf = lang === "ko" ? solfegeOf(m.note_key) : null;
                  return (
                    <span
                      key={noteKey(m)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-green-50 dark:bg-green-950/30 border border-green-200/70 dark:border-green-900/50 px-3 py-1.5"
                    >
                      <Crown
                        className="h-3 w-3 text-amber-500 dark:text-amber-400 shrink-0"
                        aria-hidden
                      />
                      {sf && (
                        <span className="text-sm font-bold text-green-700 dark:text-green-300 leading-none">
                          {sf}
                        </span>
                      )}
                      <span className="font-mono text-xs font-bold text-green-700 dark:text-green-300 tabular-nums leading-none">
                        {noteLabel(m)}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
            {loadedStatus && mastered.length === 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t.dashboard.nextStepNoMastered}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
