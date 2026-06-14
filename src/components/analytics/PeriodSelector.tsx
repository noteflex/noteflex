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

function latestCompletedWeekStart(today: string): string {
  const d = parseIso(today);
  const isoDow = d.getDay() === 0 ? 7 : d.getDay();
  const mondayThis = addDays(today, -(isoDow - 1));
  return addDays(mondayThis, -7);
}

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
  const canOpenDropdown = isPro;

  const handlePrev = useCallback(() => {
    if (!canPrev) return;
    if (periodType === "day") onChange(addDays(value, -1));
    else if (periodType === "week") onChange(addDays(value, -7));
    else onChange(addMonths(value, -1));
  }, [canPrev, periodType, value, onChange]);

  const handleNext = useCallback(() => {
    if (!canNext) return;
    if (periodType === "day") onChange(addDays(value, 1));
    else if (periodType === "week") onChange(addDays(value, 7));
    else onChange(addMonths(value, 1));
  }, [canNext, value, periodType, onChange]);

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
    if (!canOpenDropdown) return;
    if (!open) {
      void fetchPeriods(0, false);
    }
    setOpen((prev) => !prev);
  }, [canOpenDropdown, open, fetchPeriods]);

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

  const arrowBase =
    "inline-flex items-center justify-center h-9 w-9 rounded-full bg-muted text-muted-foreground transition-colors";
  const arrowEnabled = "hover:bg-primary/10 hover:text-primary";
  const arrowDisabled = "opacity-40 cursor-not-allowed";

  const chipBase =
    "inline-flex items-center gap-1.5 h-9 px-5 rounded-full text-sm font-semibold shadow-sm transition-colors";
  const chipEnabled = "bg-primary text-primary-foreground hover:bg-primary/90";
  const chipLocked = "bg-primary/15 text-primary cursor-not-allowed";

  return (
    <div ref={containerRef} className="relative flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={handlePrev}
        disabled={!canPrev}
        aria-label={t.analytics.selectorPrev}
        className={`${arrowBase} ${canPrev ? arrowEnabled : arrowDisabled}`}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={handleToggleDropdown}
        disabled={!canOpenDropdown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${chipBase} ${canOpenDropdown ? chipEnabled : chipLocked}`}
      >
        <span className="whitespace-nowrap">{label}</span>
        {canOpenDropdown ? (
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        ) : (
          <Lock className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>

      <button
        type="button"
        onClick={handleNext}
        disabled={!canNext}
        aria-label={t.analytics.selectorNext}
        className={`${arrowBase} ${canNext ? arrowEnabled : arrowDisabled}`}
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {open && canOpenDropdown && (
        <div
          role="listbox"
          className="absolute z-30 top-full mt-2 left-1/2 -translate-x-1/2 w-72 max-w-[90vw] rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
        >
          <p className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/30">
            {t.analytics.selectorHistoryTitle}
          </p>
          <div className="max-h-72 overflow-y-auto">
            {loading && periods.length === 0 ? (
              <p className="px-4 py-8 text-xs text-muted-foreground text-center">
                {t.analytics.selectorLoading}
              </p>
            ) : periods.length === 0 ? (
              <p className="px-4 py-8 text-xs text-muted-foreground text-center">
                {t.analytics.selectorHistoryEmpty}
              </p>
            ) : (
              <ul className="py-1">
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
                        className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-left text-xs transition-colors ${
                          isSelected
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-foreground hover:bg-muted/60"
                        }`}
                      >
                        <span className="truncate">{itemLabel}</span>
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
              className="w-full px-4 py-2 text-xs font-medium text-primary border-t border-border hover:bg-primary/5 disabled:opacity-50 transition-colors"
            >
              {loading ? t.analytics.selectorLoading : t.analytics.selectorLoadMore}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
