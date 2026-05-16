import { useMasteryDetails, type MasteryDetail } from "@/hooks/useMasteryDetails";
import InfoTooltip from "@/components/ui/info-tooltip";
import { useT } from "@/contexts/LanguageContext";
import { format as formatI18n, type Strings } from "@/i18n/strings";

function clefLabel(clef: "treble" | "bass", t: Strings): string {
  return clef === "treble" ? t.diagnosis.clefTreble : t.diagnosis.clefBass;
}

/**
 * 마지막 분석 시각을 KST 고정 표기로 변환.
 * 글로벌 사용자 배려해서 "(UTC+9)" 명시.
 */
function formatKst(d: Date): string {
  // KST = UTC + 9h
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mi = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} KST (UTC+9)`;
}

function pctText(acc: number | null): string {
  if (acc == null) return "—";
  return `${Math.round(acc * 100)}%`;
}

function reactionText(ms: number | null, secondsSuffix: string): string {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(1)}${secondsSuffix}`;
}

function WeaknessRow({ row, t }: { row: MasteryDetail; t: Strings }) {
  const accPct = row.recent_accuracy != null ? row.recent_accuracy * 100 : null;
  const accLow = accPct != null && accPct < 60;
  const reactionSlow = row.avg_reaction_ms != null && row.avg_reaction_ms > 3000;
  const accLabel = formatI18n(t.diagnosis.statAccuracy, { pct: pctText(row.recent_accuracy) });

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="font-mono font-bold text-foreground w-12">
        {row.note_key}
      </span>
      <span className="text-xs text-muted-foreground w-16">
        {clefLabel(row.clef, t)}
      </span>
      <div className="flex-1 flex items-center justify-end gap-2">
        <span
          className={`tabular-nums text-xs ${
            accLow ? "text-destructive font-bold" : "text-muted-foreground"
          }`}
          aria-label={accLabel}
        >
          {accLabel}
        </span>
        <span className="text-muted-foreground text-xs">·</span>
        <span
          className={`tabular-nums text-xs ${
            reactionSlow ? "text-amber-600 font-bold" : "text-muted-foreground"
          }`}
          aria-label={reactionText(row.avg_reaction_ms, t.diagnosis.secondsSuffix)}
        >
          {reactionText(row.avg_reaction_ms, t.diagnosis.secondsSuffix)}
        </span>
      </div>
    </div>
  );
}

export default function BatchAnalysisSection(): JSX.Element {
  const t = useT();
  const { weaknesses, masters, lastAnalyzedAt, loading, error } =
    useMasteryDetails();

  const subtitle = lastAnalyzedAt
    ? formatI18n(t.diagnosis.batchLastAnalyzedAt, { time: formatKst(lastAnalyzedAt) })
    : t.diagnosis.batchPending;

  return (
    <section
      className="w-full bg-card rounded-xl border border-border p-4 space-y-4"
      aria-labelledby="batch-analysis-heading"
    >
      {/* 제목 + 부제 */}
      <div>
        <h3
          id="batch-analysis-heading"
          className="text-sm font-bold text-foreground flex items-center"
        >
          {t.diagnosis.batchTitle}
          <InfoTooltip content={t.diagnosis.batchTooltip} />
        </h3>
        <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>
      </div>

      {/* 로딩 */}
      {loading && (
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground py-3"
          role="status"
          aria-live="polite"
        >
          <span className="inline-block w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          {t.diagnosis.batchLoading}
        </div>
      )}

      {/* 에러 */}
      {!loading && error && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
          role="alert"
        >
          {formatI18n(t.diagnosis.batchError, { err: error })}
        </div>
      )}

      {/* 빈 상태: 아무 플래그도 없음 */}
      {!loading &&
        !error &&
        weaknesses.length === 0 &&
        masters.length === 0 && (
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
            {t.diagnosis.batchEmpty}
          </div>
        )}

      {/* 약점 카드 */}
      {!loading && !error && (weaknesses.length > 0 || masters.length > 0) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-3">
          <h4 className="text-xs font-bold text-destructive">
            {formatI18n(t.diagnosis.batchWeaknessHeading, { count: String(weaknesses.length) })}
          </h4>
          {weaknesses.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t.diagnosis.batchNoWeakness}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {weaknesses.map((w) => (
                <WeaknessRow key={`${w.clef}:${w.note_key}`} row={w} t={t} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 마스터 카드 */}
      {!loading && !error && (weaknesses.length > 0 || masters.length > 0) && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <h4 className="text-xs font-bold text-primary">
            {formatI18n(t.diagnosis.batchMastersHeading, { count: String(masters.length) })}
          </h4>
          {masters.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t.diagnosis.batchNoMasters}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {masters.map((m) => (
                <span
                  key={`${m.clef}:${m.note_key}`}
                  className="inline-flex items-center gap-1 text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 rounded-md px-2 py-0.5"
                  title={`${clefLabel(m.clef, t)} ${m.note_key} · ${formatI18n(t.diagnosis.statAccuracy, { pct: pctText(m.recent_accuracy) })}`}
                >
                  🎵 {m.note_key}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
