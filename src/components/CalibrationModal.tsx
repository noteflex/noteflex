import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/contexts/LanguageContext";
import { measureSyncGap, measureSyncGapAverage } from "@/lib/audioVisualSync";
import {
  calculateTrimmedMean,
  clampOffset,
  ENV_TRIAL_COUNT,
  SYNC_TRIAL_COUNT,
} from "@/lib/calibrationMeasurement";
import { ensureAudioReady } from "@/lib/sound";
import { playPracticePianoKey } from "@/lib/sound";

type Phase = "intro" | "sync-measure" | "env-measure" | "complete";
type EnvStep = "waiting" | "ready" | "stimulus" | "recorded";

interface CalibrationModalProps {
  isOpen: boolean;
  canSkip: boolean;
  onComplete: (offsetMs: number, syncOutliers: number) => void;
  onSkip: () => void;
}

export default function CalibrationModal({
  isOpen,
  canSkip,
  onComplete,
  onSkip,
}: CalibrationModalProps) {
  const [phase, setPhase] = useState<Phase>("intro");

  // sync 측정 상태
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncResult, setSyncResult] = useState<{
    averageMs: number;
    outlierCount: number;
  } | null>(null);

  // env 측정 상태
  const [envTrials, setEnvTrials] = useState<number[]>([]);
  const [envStep, setEnvStep] = useState<EnvStep>("waiting");
  const stimulusTimeRef = useRef<number | null>(null);
  const stimulusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 완료 결과
  const [finalOffset, setFinalOffset] = useState<number>(0);

  // phase 리셋 (모달 닫힐 때)
  useEffect(() => {
    if (!isOpen) {
      setPhase("intro");
      setSyncProgress(0);
      setSyncResult(null);
      setEnvTrials([]);
      setEnvStep("waiting");
      stimulusTimeRef.current = null;
    }
  }, [isOpen]);

  // ── sync 측정 (자동) ──────────────────────────────────────

  const runSyncMeasure = useCallback(async () => {
    setPhase("sync-measure");
    setSyncProgress(0);

    const results = await measureSyncGapAverage(SYNC_TRIAL_COUNT, async () => {
      const gap = await measureSyncGap();
      setSyncProgress((p) => p + 1);
      return gap;
    });

    setSyncResult({
      averageMs: results.averageMs,
      outlierCount: results.outlierCount,
    });
    setPhase("env-measure");
    setEnvStep("waiting");
  }, []);

  // ── env 측정 (사용자 탭) ──────────────────────────────────

  const scheduleStimulus = useCallback(() => {
    setEnvStep("ready");
    const delay = 200 + Math.random() * 300; // 200~500ms 랜덤 딜레이
    stimulusTimerRef.current = setTimeout(() => {
      setEnvStep("stimulus");
      stimulusTimeRef.current = performance.now();
      ensureAudioReady().then(() => playPracticePianoKey("C"));
    }, delay);
  }, []);

  const handleTap = useCallback(() => {
    if (envStep !== "stimulus" || stimulusTimeRef.current === null) return;
    const tapTime = performance.now();
    const delta = tapTime - stimulusTimeRef.current;
    stimulusTimeRef.current = null;

    setEnvTrials((prev) => {
      const next = [...prev, delta];
      if (next.length >= ENV_TRIAL_COUNT) {
        const mean = calculateTrimmedMean(next);
        const clamped = clampOffset(mean);
        setFinalOffset(clamped);
        setEnvStep("recorded");
        setPhase("complete");
      } else {
        setEnvStep("recorded");
      }
      return next;
    });
  }, [envStep]);

  // recorded → 다음 자극 준비
  useEffect(() => {
    if (envStep === "recorded" && phase === "env-measure") {
      const t = setTimeout(() => scheduleStimulus(), 100);
      return () => clearTimeout(t);
    }
  }, [envStep, phase, scheduleStimulus]);

  // 타이머 클린업
  useEffect(() => {
    return () => {
      if (stimulusTimerRef.current) clearTimeout(stimulusTimerRef.current);
    };
  }, []);

  const t = useT();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={t.calibration.ariaLabel}
      >
      <div className="bg-background border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-up">

        {/* ── intro ── */}
        {phase === "intro" && (
          <div className="flex flex-col items-center gap-4">
            <span className="text-5xl">🎧</span>
            <h2 className="text-xl font-bold text-foreground text-center">
              {t.calibration.title}
            </h2>
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              {t.calibration.description.split("\n").map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </p>
            <div className="w-full mt-2 flex flex-col gap-2">
              <button
                onClick={runSyncMeasure}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-95 transition-transform"
              >
                {t.calibration.startButton}
              </button>
              {canSkip && (
                <button
                  onClick={onSkip}
                  className="w-full py-2 rounded-xl text-muted-foreground text-sm hover:text-foreground transition-colors"
                >
                  {t.calibration.skipButton}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── sync-measure ── */}
        {phase === "sync-measure" && (
          <div className="flex flex-col items-center gap-4">
            <span className="text-5xl">📡</span>
            <h2 className="text-xl font-bold text-foreground text-center">
              {t.calibration.syncMeasuringTitle}
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              {t.calibration.syncDesc}
            </p>
            <div className="w-full flex gap-2 mt-2">
              {Array.from({ length: SYNC_TRIAL_COUNT }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-full ${
                    i < syncProgress ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {syncProgress} / {SYNC_TRIAL_COUNT}
            </p>
          </div>
        )}

        {/* ── env-measure ── */}
        {phase === "env-measure" && (
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-xl font-bold text-foreground text-center">
              {t.calibration.envMeasuringTitle}
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              {t.calibration.envDesc}
            </p>

            <div className="w-full flex gap-1.5 mt-1">
              {Array.from({ length: ENV_TRIAL_COUNT }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-full ${
                    i < envTrials.length ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {envTrials.length} / {ENV_TRIAL_COUNT}
            </p>

            {envStep === "waiting" && (
              <button
                onClick={scheduleStimulus}
                className="mt-4 w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-95 transition-transform"
              >
                {t.calibration.startMeasureButton}
              </button>
            )}

            {envStep === "ready" && (
              <div className="mt-4 w-full py-3 rounded-xl bg-muted text-muted-foreground font-semibold text-sm text-center select-none">
                {t.calibration.ready}
              </div>
            )}

            {envStep === "stimulus" && (
              <button
                onClick={handleTap}
                className="mt-4 w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg active:scale-95 transition-transform animate-pulse"
              >
                {t.calibration.nowButton}
              </button>
            )}

            {envStep === "recorded" && (
              <div className="mt-4 w-full py-3 rounded-xl bg-muted text-muted-foreground text-sm text-center">
                {t.calibration.recordedLabel.replace("{ms}", String(envTrials[envTrials.length - 1]?.toFixed(0) ?? ""))}
              </div>
            )}
          </div>
        )}

        {/* ── complete ── */}
        {phase === "complete" && (
          <div className="flex flex-col items-center gap-4">
            <span className="text-5xl">✅</span>
            <h2 className="text-xl font-bold text-foreground text-center">
              {t.calibration.completeTitle}
            </h2>
            <div className="w-full bg-muted rounded-xl p-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.calibration.envOffsetLabel}</span>
                <span className="font-semibold tabular-nums">
                  {finalOffset.toFixed(0)} ms
                </span>
              </div>
              {syncResult && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.calibration.syncGapLabel}</span>
                  <span className="font-semibold tabular-nums">
                    {syncResult.averageMs.toFixed(1)} ms
                    {syncResult.outlierCount > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({syncResult.outlierCount} outlier)
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
            <div className="w-full flex flex-col gap-2 mt-2">
              <button
                onClick={() =>
                  onComplete(finalOffset, syncResult?.outlierCount ?? 0)
                }
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-95 transition-transform"
              >
                {t.calibration.confirmButton}
              </button>
              <button
                onClick={() => {
                  setPhase("intro");
                  setSyncProgress(0);
                  setSyncResult(null);
                  setEnvTrials([]);
                  setEnvStep("waiting");
                  stimulusTimeRef.current = null;
                }}
                className="w-full py-2 text-muted-foreground text-sm hover:text-foreground transition-colors"
              >
                {t.calibration.remeasureButton}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
