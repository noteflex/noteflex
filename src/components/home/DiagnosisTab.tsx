import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserNoteLogs, type UserNoteLogRecord } from "@/lib/userNoteLogs";
import BatchAnalysisSection from "@/components/BatchAnalysisSection";
import InfoTooltip from "@/components/ui/info-tooltip";

interface NoteLog extends UserNoteLogRecord {}

interface NoteStat {
  noteKey: string;
  total: number;
  correct: number;
  accuracy: number;
  avgTime: number;
}

type PeriodFilter = "7d" | "30d" | "all";

export default function DiagnosisTab() {
  const { user } = useAuth();
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
    const map = new Map<string, { total: number; correct: number; times: number[] }>();
    for (const log of filteredLogs) {
      const k = log.note_key;
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
        분석 중...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="w-full text-center py-12">
        <span className="text-4xl block mb-3">🎵</span>
        <p className="text-muted-foreground text-sm">아직 기록이 없습니다</p>
        <p className="text-muted-foreground text-xs mt-1">
          게임을 플레이하면 자동으로 기록됩니다!
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Period Filter */}
      <div className="w-full flex gap-2">
        {[
          { id: "7d" as const, label: "최근 7일" },
          { id: "30d" as const, label: "최근 30일" },
          { id: "all" as const, label: "전체" },
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
          <p className="text-[10px] text-muted-foreground">총 문제</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-2xl font-bold text-primary">{overallAccuracy}%</p>
          <p className="text-[10px] text-muted-foreground">정답률</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{totalCorrect}</p>
          <p className="text-[10px] text-muted-foreground">정답 수</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{avgResponseTime}s</p>
          <p className="text-[10px] text-muted-foreground">평균 반응</p>
        </div>
      </div>

      {/* Batch Analysis (official flags) */}
      <BatchAnalysisSection />

      {/* Vulnerability Insight */}
      {mostVulnerable && (
        <div className="w-full rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-xs font-semibold text-destructive mb-1">취약점 분석</p>
          <p className="text-sm text-foreground">
            가장 낮은 정답률:{" "}
            <span className="font-mono font-bold">{mostVulnerable.noteKey}</span> (
            {mostVulnerable.accuracy}%)
          </p>
        </div>
      )}

      {/* Mastery Chart */}
      {dailyAccuracy.length > 0 && (
        <div className="w-full bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">📈 일별 정답률</h3>
          <div className="flex items-end gap-2 h-24">
            {dailyAccuracy.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold text-foreground">{d.accuracy}%</span>
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${Math.max(d.accuracy * 0.8, 4)}px`,
                    background:
                      d.accuracy >= 80
                        ? "hsl(var(--primary))"
                        : d.accuracy >= 50
                          ? "hsl(var(--accent))"
                          : "hsl(var(--destructive))",
                  }}
                />
                <span className="text-[8px] text-muted-foreground">{d.day}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Average Response Time Trend */}
      {dailyAvgResponse.length > 0 && (
        <div className="w-full bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">⏱ 평균 반응 시간 추이</h3>
          <div className="w-full overflow-x-auto">
            <svg viewBox="0 0 260 100" className="w-full h-28">
              <polyline
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={responseLinePoints}
              />
              {dailyAvgResponse.map((d, i) => {
                const maxY = Math.max(...dailyAvgResponse.map((v) => v.avgTime), 1);
                const x =
                  dailyAvgResponse.length === 1
                    ? 130
                    : (i / (dailyAvgResponse.length - 1)) * 260;
                const y = 80 - (d.avgTime / (maxY || 1)) * 80;
                return (
                  <g key={d.day}>
                    <circle cx={x} cy={y} r={3} fill="hsl(var(--primary))" />
                    <text
                      x={x}
                      y={96}
                      textAnchor="middle"
                      fontSize="8"
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
      )}

      {/* Weakest Notes */}
      {weakest.length > 0 && (
        <div className="w-full bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center">
            😰 가장 약한 음표 Top 3
            <InfoTooltip content="최근 200개 답변 기준 · 지금 세션의 경향을 반영합니다" />
          </h3>
          <div className="flex flex-col gap-2">
            {weakest.map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-lg">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                </span>
                <span className="font-mono font-bold text-foreground text-sm w-10">
                  {w.noteKey}
                </span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${w.accuracy}%`,
                      background:
                        w.accuracy >= 80
                          ? "hsl(var(--primary))"
                          : w.accuracy >= 50
                            ? "hsl(var(--accent))"
                            : "hsl(var(--destructive))",
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-12 text-right">
                  {w.accuracy}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slowest Notes */}
      {slowest.length > 0 && (
        <div className="w-full bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center">
            🐢 가장 느린 음표 Top 3
            <InfoTooltip content="최근 200개 답변의 평균 반응 시간 기준" />
          </h3>
          <div className="flex flex-col gap-2">
            {slowest.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-lg">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                </span>
                <span className="font-mono font-bold text-foreground text-sm w-10">
                  {s.noteKey}
                </span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: `${Math.min((s.avgTime / 7) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-12 text-right">
                  {s.avgTime}초
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
