import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useT, useLang } from "@/contexts/LanguageContext";
import type { ListReportPeriodsResponse, ReportPeriodEntry } from "@/types/analytics";

export type PeriodType = "day" | "week" | "month";

interface PeriodSelectorProps {
  periodType: PeriodType;
  value: string;
  onChange: (periodStart: string) => void;
  isPro: boolean;
  onProLockHit?: () => void;
}

const MONTHS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
const DOW_EN_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

function addMonths(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toIso(d);
}

function kstTodayIso(): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kst = new Date(Date.now() + KST_OFFSET_MS);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

/** 입력 KST 오늘 → 직전 완료 주 월요일 (ISO 주). */
function latestCompletedWeekStart(today: string): string {
  const d = parseIso(today);
  const isoDow = d.getDay() === 0 ? 7 : d.getDay();
  const mondayThis = addDays(today, -(isoDow - 1));
  return addDays(mondayThis, -7);
}

/** 입력 KST 오늘 → 직전 완료 월 1일. */
function latestCompletedMonthStart(today: string): string {
  const [y, m] = today.split("-").map(Number);
  return `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}-01`;
}

function fmtDayLabel(iso: string, lang: string, today: string): string {
  if (iso === today) return lang === "ko" ? "오늘" : "Today";
  if (iso === addDays(today, -1)) return lang === "ko" ? "어제" : "Yesterday";
  const d = parseIso(iso);
  const dow = lang === "ko" ? DOW_KO[d.getDay()] : DOW_EN_SHORT[d.getDay()];
  if (lang === "ko") return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dow})`;
  return `${MONTHS_EN[d.getMonth()]} ${d.getDate()} (${dow})`;
}

function fmtWeekLabel(iso: string, lang: string): string {
  const start = parseIso(iso);
  const end = parseIso(addDays(iso, 6));
  if (lang === "ko") {
    return `${start.getMonth() + 1}/${start.getDate()} ~ ${end.getMonth() + 1}/${end.getDate()}`;
  }
  return `${MONTHS_EN[start.getMonth()]} ${start.getDate()} – ${MONTHS_EN[end.getMonth()]} ${end.getDate()}`;
}

function fmtMonthLabel(iso: string, lang: string): string {
  const [y, m] = iso.split("-").map(Number);
  if (lang === "ko") return `${y}년 ${m}월`;
  return `${MONTHS_EN[m - 1]} ${y}`;
}

function formatLabel(periodType: PeriodType, iso: string, lang: string, today: string): string {
  if (periodType === "day") return fmtDayLabel(iso, lang, today);
  if (periodType === "week") return fmtWeekLabel(iso, lang);
  return fmtMonthLabel(iso, lang);
}

export default function PeriodSelector({
  periodType,
  value,
  onChange,
  isPro,
  onProLockHit,
}: PeriodSelectorProps) {
  const t = useT();
  const { lang } = useLang();

  const [open, setOpen] = useState(false);
  const [periods, setPeriods] = useState<ReportPeriodEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const today = useMemo(() => kstTodayIso(), []);

  const upperBound = useMemo(() => {
    if (periodType === "day") return today;
    if (periodType === "week") return latestCompletedWeekStart(today);
    return latestCompletedMonthStart(today);
  }, [periodType, today]);

  const canPrev = isPro;
  const canNext = isPro && value < upperBound;

  const handlePrev = useCallback(() => {
    if (!isPro) {
      onProLockHit?.();
      return;
    }
    if (periodType === "day") onChange(addDays(value, -1));
    else if (periodType === "week") onChange(addDays(value, -7));
    else onChange(addMonths(value, -1));
  }, [isPro, onProLockHit, periodType, value, onChange]);

  const handleNext = useCallback(() => {
    if (!isPro) {
      onProLockHit?.();
      return;
    }
    if (value >= upperBound) return;
    if (periodType === "day") onChange(addDays(value, 1));
    else if (periodType === "week") onChange(addDays(value, 7));
    else onChange(addMonths(value, 1));
  }, [isPro, onProLockHit, value, upperBound, periodType, onChange]);

  const fetchPeriods = useCallback(
    async (nextOffset: number, append: boolean) => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("list_report_periods", {
          p_period_type: periodType,
          p_limit: 30,
          p_offset: nextOffset,
        });
        if (error) throw error;
        const res = (data ?? null) as ListReportPeriodsResponse | null;
        if (!res) {
          setPeriods(append ? periods : []);
          setTotal(0);
        } else {
          setTotal(res.total);
          setPeriods((prev) => (append ? [...prev, ...res.periods] : res.periods));
        }
        setOffset(nextOffset);
      } catch {
        if (!append) {
          setPeriods([]);
          setTotal(0);
        }
      } finally {
        setLoading(false);
      }
    },
    [periodType, periods],
  );

  const handleToggleDropdown = useCallback(() => {
    if (!isPro) {
      onProLockHit?.();
      return;
    }
    if (!open) {
      void fetchPeriods(0, false);
    }
    setOpen((prev) => !prev);
  }, [isPro, onProLockHit, open, fetchPeriods]);

  const handleLoadMore = useCallback(() => {
    void fetchPeriods(offset + 30, true);
  }, [offset, fetchPeriods]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const label = formatLabel(periodType, value, lang, today);

  const baseBtn =
    "inline-flex items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors";
  const enabledBtn = "hover:bg-muted";
  const disabledBtn = "opacity-40 cursor-not-allowed";

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={handlePrev}
        disabled={!canPrev && isPro}
        aria-label={t.analytics.selectorPrev}
        className={`${baseBtn} h-8 w-8 ${canPrev ? enabledBtn : disabledBtn}`}
      >
        {isPro ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        )}
      </button>

      <button
        type="button"
        onClick={handleToggleDropdown}
        className={`${baseBtn} flex-1 h-8 px-3 gap-1.5 text-sm font-medium ${enabledBtn}`}
      >
        <span className="truncate">{label}</span>
        {isPro ? (
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        ) : (
          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>

      <button
        type="button"
        onClick={handleNext}
        disabled={!canNext && isPro}
        aria-label={t.analytics.selectorNext}
        className={`${baseBtn} h-8 w-8 ${canNext ? enabledBtn : disabledBtn}`}
      >
        {isPro ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        )}
      </button>

      {open && isPro && (
        <div
          role="listbox"
          className="absolute z-30 top-full mt-1 left-0 right-0 rounded-md border border-border bg-card shadow-lg overflow-hidden"
        >
          <p className="px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground border-b border-border">
            {t.analytics.selectorHistoryTitle}
          </p>
          <div className="max-h-72 overflow-y-auto">
            {loading && periods.length === 0 ? (
              <p className="px-3 py-6 text-xs text-muted-foreground text-center">
                {t.analytics.selectorLoading}
              </p>
            ) : periods.length === 0 ? (
              <p className="px-3 py-6 text-xs text-muted-foreground text-center">
                {t.analytics.selectorHistoryEmpty}
              </p>
            ) : (
              <ul>
                {periods.map((p) => {
                  const isSelected = p.period_start === value;
                  const itemLabel = formatLabel(periodType, p.period_start, lang, today);
                  const accPct = p.overall_accuracy != null ? `${Math.round(p.overall_accuracy * 100)}%` : "—";
                  return (
                    <li key={p.period_start}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(p.period_start);
                          setOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-muted transition-colors ${
                          isSelected ? "bg-primary/10 text-primary" : "text-foreground"
                        }`}
                      >
                        <span className="font-medium truncate">{itemLabel}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                          {accPct} · {p.sessions_count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {periods.length < total && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loading}
              className="w-full px-3 py-2 text-xs text-primary border-t border-border hover:bg-muted disabled:opacity-50"
            >
              {loading ? t.analytics.selectorLoading : t.analytics.selectorLoadMore}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
