import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserNoteLogs, type UserNoteLogRecord } from "@/lib/userNoteLogs";
import BatchAnalysisSection from "@/components/BatchAnalysisSection";
import InfoTooltip from "@/components/ui/info-tooltip";
import { useT } from "@/contexts/LanguageContext";

interface NoteLog extends UserNoteLogRecord {}

interface NoteStat {
  /** 표시용 — "C4", "F#3" 영역 박힘 (note_key + octave 통합) */
  noteKey: string;
  total: number;
  correct: number;
  accuracy: number;
  avgTime: number;
}

type PeriodFilter = "7d" | "30d" | "all";

export default function DiagnosisTab() {
  const { user } = useAuth();
  const t = useT();
  const [logs, setLogs] = useState<NoteLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>("7d");

  useEffect(() => {
    if (!user) return;
    fetchLogs();
  }, [user]);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await fetchUserNoteLogs(200);

    if (error) {
      console.error("[DiagnosisTab] Fetch error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        status: error.status,
      });
      setLogs([]);
      setLoading(false);
      return;
    }

    setLogs(data ?? []);
    setLoading(false);
  };

  const filteredLogs = (() => {
    if (period === "all") return logs;
    const now = Date.now();
    const days = period === "7d" ? 7 : 30;
    const rangeMs = days * 24 * 60 * 60 * 1000;
    return logs.filter((log) => {
      const created = new Date(log.created_at).getTime();
      if (!Number.isFinite(created)) return false;
      return now - created <= rangeMs;
    });
  })();

  const stats: NoteStat[] = (() => {
    // 옥타브 박음 — note_key + octave 영역 통합 박음 (예: "C4", "F#3")
    const map = new Map<string, { total: number; correct: number; times: number[] }>();
    for (const log of filteredLogs) {
      const k = `${log.note_key}${log.octave}`;
      const entry = map.get(k) || { total: 0, correct: 0, times: [] };
      entry.total++;
      if (log.is_correct) entry.correct++;
      if (log.response_time != null) entry.times.push(log.response_time);
      map.set(k, entry);
    }
    return Array.from(map.entries()).map(([noteKey, v]) => ({
      noteKey,
      total: v.total,
      correct: v.correct,
      accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
      avgTime: v.times.length > 0 ? +(v.times.reduce((a, b) => a + b, 0) / v.times.length).toFixed(1) : 0,
    }));
  })();

  const weakest = [...stats].filter((s) => s.total >= 2).sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);
  const slowest = [...stats].filter((s) => s.avgTime > 0 && s.total >= 2).sort((a, b) => b.avgTime - a.avgTime).slice(0, 3);

  const totalAnswered = filteredLogs.length;
  const totalCorrect = filteredLogs.filter((l) => l.is_correct).length;
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const avgResponseTime = (() => {
    const valid = filteredLogs.filter((l) => l.response_time != null);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, cur) => acc + (cur.response_time ?? 0), 0);
    return +(sum / valid.length).toFixed(2);
  })();

  // Daily accuracy (last 7 days within filtered range)
  const dailyAccuracy = (() => {
    const dayMap = new Map<string, { correct: number; total: number }>();
    for (const log of filteredLogs) {
      const day = log.created_at.slice(0, 10);
      const e = dayMap.get(day) || { correct: 0, total: 0 };
      e.total++;
      if (log.is_correct) e.correct++;
      dayMap.set(day, e);
    }
    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([day, v]) => ({
        day: day.slice(5),
        accuracy: Math.round((v.correct / v.total) * 100),
        total: v.total,
      }));
  })();

  const dailyAvgResponse = (() => {
    const dayMap = new Map<string, { total: number; count: number }>();
    for (const log of filteredLogs) {
      if (log.response_time == null) continue;
      const day = log.created_at.slice(0, 10);
      const e = dayMap.get(day) || { total: 0, count: 0 };
      e.total += log.response_time;
      e.count += 1;
      dayMap.set(day, e);
    }
    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([day, v]) => ({
        day: day.slice(5),
        avgTime: +(v.total / v.count).toFixed(2),
      }));
  })();

  const responseLinePoints = (() => {
    if (dailyAvgResponse.length === 0) return "";
    const width = 260;
    const height = 80;
    const minY = 0;
    const maxY = Math.max(...dailyAvgResponse.map((d) => d.avgTime), 1);
    return dailyAvgResponse
      .map((d, i) => {
        const x = dailyAvgResponse.length === 1 ? width / 2 : (i / (dailyAvgResponse.length - 1)) * width;
        const y = height - ((d.avgTime - minY) / (maxY - minY || 1)) * height;
        return `${x},${y}`;
      })
      .join(" ");
  })();

  const mostVulnerable = weakest.length > 0 ? weakest[0] : null;

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <span className="inline-block w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        {t.diagnosis.analyzing}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="w-full text-center py-12">
        <span className="text-4xl block mb-3">🎵</span>
        <p className="text-muted-foreground text-sm">{t.diagnosis.noRecordsTitle}</p>
        <p className="text-muted-foreground text-xs mt-1">
          {t.diagnosis.noRecordsHint}
        </p>
      </div>
    );
  }

  // ── 차트 X축 고정 영역 (작업 3) ──────────────────────────────
  // 기간 영역만큼 X축 슬롯 박음 (7d=7, 30d=30, all=실제 데이터 길이 max 30).
  // 데이터 박힌 날만 표시, 빈 날은 X축에만 박힘.
  const slotCount = period === "7d" ? 7 : period === "30d" ? 30 : Math.max(dailyAccuracy.length, 7);

  // 핵심 숫자 강조 (작업 3) — 평균·최고·최근
  const accAvg = dailyAccuracy.length > 0
    ? Math.round(dailyAccuracy.reduce((a, b) => a + b.accuracy, 0) / dailyAccuracy.length)
    : 0;
  const accMax = dailyAccuracy.length > 0
    ? Math.max(...dailyAccuracy.map((d) => d.accuracy))
    : 0;
  const accLatest = dailyAccuracy.length > 0 ? dailyAccuracy[dailyAccuracy.length - 1].accuracy : 0;

  const reactAvg = dailyAvgResponse.length > 0
    ? +(dailyAvgResponse.reduce((a, b) => a + b.avgTime, 0) / dailyAvgResponse.length).toFixed(2)
    : 0;
  const reactLatest = dailyAvgResponse.length > 0 ? dailyAvgResponse[dailyAvgResponse.length - 1].avgTime : 0;

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Period Filter */}
      <div className="w-full flex gap-2">
        {[
          { id: "7d" as const, label: t.diagnosis.period7d },
          { id: "30d" as const, label: t.diagnosis.period30d },
          { id: "all" as const, label: t.diagnosis.periodAll },
        ].map((option) => (
          <button
            key={option.id}
            onClick={() => setPeriod(option.id)}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              period === option.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{totalAnswered}</p>
          <p className="text-[10px] text-muted-foreground">{t.diagnosis.kpiTotalQuestions}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-2xl font-bold text-primary">{overallAccuracy}%</p>
          <p className="text-[10px] text-muted-foreground">{t.diagnosis.kpiAccuracy}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{totalCorrect}</p>
          <p className="text-[10px] text-muted-foreground">{t.diagnosis.kpiCorrectCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{avgResponseTime}s</p>
          <p className="text-[10px] text-muted-foreground">{t.diagnosis.kpiAvgReaction}</p>
        </div>
      </div>

      {/* Weakest Notes — Top 1 빨강, Top 2·3 노랑 (작업 3) */}
      {weakest.length > 0 && (
        <div className="w-full bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center">
            {t.diagnosis.weakestNotesTitle}
            <InfoTooltip content={t.diagnosis.weakestNotesTooltip} />
          </h3>
          <div className="flex flex-col gap-2">
            {weakest.map((w, i) => {
              const isTop1 = i === 0;
              const colorClass = isTop1
                ? "text-red-600 dark:text-red-400"
                : "text-yellow-600 dark:text-yellow-500";
              const barClass = isTop1
                ? "bg-red-500 dark:bg-red-600"
                : "bg-yellow-400 dark:bg-yellow-500";
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                  </span>
                  <span className={`font-mono font-bold text-sm w-12 ${colorClass}`}>
                    {w.noteKey}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barClass}`}
                      style={{ width: `${w.accuracy}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {w.accuracy}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Slowest Notes — Top 1 빨강, Top 2·3 노랑 (작업 3) */}
      {slowest.length > 0 && (
        <div className="w-full bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center">
            {t.diagnosis.slowestNotesTitle}
            <InfoTooltip content={t.diagnosis.slowestNotesTooltip} />
          </h3>
          <div className="flex flex-col gap-2">
            {slowest.map((s, i) => {
              const isTop1 = i === 0;
              const colorClass = isTop1
                ? "text-red-600 dark:text-red-400"
                : "text-yellow-600 dark:text-yellow-500";
              const barClass = isTop1
                ? "bg-red-500 dark:bg-red-600"
                : "bg-yellow-400 dark:bg-yellow-500";
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                  </span>
                  <span className={`font-mono font-bold text-sm w-12 ${colorClass}`}>
                    {s.noteKey}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barClass}`}
                      style={{ width: `${Math.min((s.avgTime / 7) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {s.avgTime}{t.diagnosis.secondsSuffix}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vulnerability Insight */}
      {mostVulnerable && (
        <div className="w-full rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-xs font-semibold text-destructive mb-1">{t.diagnosis.vulnerabilityTitle}</p>
          <p className="text-sm text-foreground">
            {t.diagnosis.vulnerabilityLowest}{" "}
            <span className="font-mono font-bold">{mostVulnerable.noteKey}</span> (
            {mostVulnerable.accuracy}%)
          </p>
        </div>
      )}

      {/* Daily Accuracy Chart — X축 고정 + 핵심 숫자 강조 (작업 3) */}
      {dailyAccuracy.length > 0 ? (
        <div className="w-full bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">{t.diagnosis.dailyAccuracyTitle}</h3>
          {/* 핵심 숫자 강조 — 평균·최고·최근 */}
          <div className="flex items-baseline justify-around mb-4 gap-2">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{accLatest}%</p>
              <p className="text-[10px] text-muted-foreground">{t.diagnosis.chartLatestLabel}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{accAvg}%</p>
              <p className="text-[10px] text-muted-foreground">{t.diagnosis.chartAvgLabel}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{accMax}%</p>
              <p className="text-[10px] text-muted-foreground">{t.diagnosis.chartMaxLabel}</p>
            </div>
          </div>
          {/* X축 영역 슬롯 박음 — 데이터 박힌 영역만 막대 박힘 */}
          <div className="flex items-end gap-1 h-24" style={{ minWidth: `${slotCount * 8}px` }}>
            {Array.from({ length: slotCount }, (_, i) => {
              const dataIdx = dailyAccuracy.length - slotCount + i;
              const d = dataIdx >= 0 ? dailyAccuracy[dataIdx] : null;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  {d ? (
                    <>
                      <span className="text-[8px] font-bold text-foreground">{d.accuracy}%</span>
                      <div
                        className="w-full rounded-t-md transition-all"
                        style={{
                          height: `${Math.max(d.accuracy * 0.7, 4)}px`,
                          background:
                            d.accuracy >= 80
                              ? "hsl(var(--primary))"
                              : d.accuracy >= 50
                                ? "hsl(var(--accent))"
                                : "hsl(var(--destructive))",
                        }}
                      />
                    </>
                  ) : (
                    <div className="w-full h-1 bg-muted/30 rounded-t-md mt-auto" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Avg Reaction Time Chart — X축 고정 + 핵심 숫자 강조 (작업 3) */}
      {dailyAvgResponse.length > 0 ? (
        <div className="w-full bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">{t.diagnosis.reactionTrendTitle}</h3>
          {/* 핵심 숫자 — 최근·평균 */}
          <div className="flex items-baseline justify-around mb-4 gap-2">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{reactLatest}{t.diagnosis.secondsSuffix}</p>
              <p className="text-[10px] text-muted-foreground">{t.diagnosis.chartLatestLabel}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{reactAvg}{t.diagnosis.secondsSuffix}</p>
              <p className="text-[10px] text-muted-foreground">{t.diagnosis.chartAvgLabel}</p>
            </div>
          </div>
          {/* X축 슬롯 박음 — 데이터 박힌 점만 표시 */}
          <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${slotCount * 16} 100`} className="w-full h-28">
              <polyline
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={(() => {
                  const maxY = Math.max(...dailyAvgResponse.map((d) => d.avgTime), 1);
                  return dailyAvgResponse
                    .map((d) => {
                      const dataDay = d.day;
                      const idx = dailyAccuracy.findIndex((a) => a.day === dataDay);
                      // dataIdx → slotIdx: 데이터 박힌 영역의 오프셋 박음
                      const slotIdx = idx >= 0 ? slotCount - dailyAvgResponse.length + dailyAvgResponse.indexOf(d) : 0;
                      const x = slotIdx * 16 + 8;
                      const y = 80 - (d.avgTime / (maxY || 1)) * 70;
                      return `${x},${y}`;
                    })
                    .join(" ");
                })()}
              />
              {dailyAvgResponse.map((d, i) => {
                const maxY = Math.max(...dailyAvgResponse.map((v) => v.avgTime), 1);
                const slotIdx = slotCount - dailyAvgResponse.length + i;
                const x = slotIdx * 16 + 8;
                const y = 80 - (d.avgTime / (maxY || 1)) * 70;
                return (
                  <g key={d.day}>
                    <circle cx={x} cy={y} r={3} fill="hsl(var(--primary))" />
                    <text
                      x={x}
                      y={96}
                      textAnchor="middle"
                      fontSize="7"
                      fill="hsl(var(--muted-foreground))"
                    >
                      {d.day}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      ) : null}

      {/* Formal Learning Analysis — 최하단 박음 (작업 4) — 무거운 분석 영역 마지막 위치 */}
      <BatchAnalysisSection />
    </div>
  );
}
