import { useCallback, useEffect, useRef, useState } from "react";
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="오디오 캘리브레이션"
      >
      <div className="bg-background border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-up">

        {/* ── intro ── */}
        {phase === "intro" && (
          <div className="flex flex-col items-center gap-4">
            <span className="text-5xl">🎧</span>
            <h2 className="text-xl font-bold text-foreground text-center">
              오디오 캘리브레이션
            </h2>
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              블루투스·외장 스피커 환경에서 정확한 반응 속도 측정을 위해
              <br />
              30초 내 보정이 필요합니다.
            </p>
            <div className="w-full mt-2 flex flex-col gap-2">
              <button
                onClick={runSyncMeasure}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-95 transition-transform"
              >
                시작 (약 5초)
              </button>
              {canSkip && (
                <button
                  onClick={onSkip}
                  className="w-full py-2 rounded-xl text-muted-foreground text-sm hover:text-foreground transition-colors"
                >
                  나중에
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
              sync 측정 중
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              화면과 오디오 동기 상태를 자동으로 측정합니다.
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
              반응 측정
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              소리가 들리는 즉시 아래 버튼을 탭하세요.
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
                측정 시작
              </button>
            )}

            {envStep === "ready" && (
              <div className="mt-4 w-full py-3 rounded-xl bg-muted text-muted-foreground font-semibold text-sm text-center select-none">
                준비 중…
              </div>
            )}

            {envStep === "stimulus" && (
              <button
                onClick={handleTap}
                className="mt-4 w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg active:scale-95 transition-transform animate-pulse"
              >
                지금!
              </button>
            )}

            {envStep === "recorded" && (
              <div className="mt-4 w-full py-3 rounded-xl bg-muted text-muted-foreground text-sm text-center">
                기록됨 ({envTrials[envTrials.length - 1]?.toFixed(0)}ms)
              </div>
            )}
          </div>
        )}

        {/* ── complete ── */}
        {phase === "complete" && (
          <div className="flex flex-col items-center gap-4">
            <span className="text-5xl">✅</span>
            <h2 className="text-xl font-bold text-foreground text-center">
              캘리브레이션 완료
            </h2>
            <div className="w-full bg-muted rounded-xl p-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">환경 offset</span>
                <span className="font-semibold tabular-nums">
                  {finalOffset.toFixed(0)} ms
                </span>
              </div>
              {syncResult && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">sync gap</span>
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
                완료
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
                재측정
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
