import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/sentry";

const STORAGE_KEY = "noteflex.userEnvOffsetV2";
const SKIP_KEY = "noteflex.calibrationSkippedOnceV2";

export const DEFAULT_OFFSET_MS = 0;

// ─── localStorage ────────────────────────────────────────────

export function getUserEnvOffset(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return DEFAULT_OFFSET_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_OFFSET_MS;
}

export function setUserEnvOffset(offsetMs: number): void {
  localStorage.setItem(STORAGE_KEY, String(offsetMs));
}

export function clearUserEnvOffset(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SKIP_KEY);
  // V1 cleanup (calibration 시스템 재설계 — 옛 사용자 반응시간 측정값 폐기)
  localStorage.removeItem("noteflex.userEnvOffset");
  localStorage.removeItem("noteflex.calibrationSkippedOnce");
}

export function hasStoredOffset(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

// ─── calibration skip (Q-E: 1회 허용) ───────────────────────

export function getCalibrationSkippedOnce(): boolean {
  return localStorage.getItem(SKIP_KEY) === "true";
}

export function setCalibrationSkippedOnce(): void {
  localStorage.setItem(SKIP_KEY, "true");
}

// ─── AudioContext 기반 시스템 지연 자동 측정 ────────────────

export async function measureSystemLatency(): Promise<number> {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return 0;
    const ctx = new AudioContextClass();
    const latencySeconds = (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
    const baseLatencySeconds = ctx.baseLatency ?? 0;
    const totalLatencyMs = Math.round((latencySeconds + baseLatencySeconds) * 1000);
    ctx.close();
    return Math.min(Math.max(totalLatencyMs, 0), 1000);
  } catch (err) {
    console.warn("[calibration] outputLatency 측정 실패:", err);
    return 0;
  }
}

// ─── reactionMs 보정 (Q-K: clamp 0) ────────────────────────

export function clampReactionMs(rawMs: number, offsetMs: number): number {
  return Math.max(0, rawMs - offsetMs);
}

// ─── DB sync (Q-D: profiles.user_env_offset_ms) ─────────────

export async function syncOffsetToProfile(
  userId: string,
  offsetMs: number
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ user_env_offset_ms: offsetMs })
    .eq("id", userId);
  if (error) {
    logger.error("Offset 영역 동기화 박지 X", error, {
      description: "profiles.user_env_offset_ms UPDATE 박지 X 박힘",
      cause: error.message,
      impact: "사용자 영역 환경 보정값 영역 박지 X — 반응시간 부정확",
      action: "userEnvironmentOffset.ts:54 영역 확인",
      metadata: { offset_ms: offsetMs },
    });
  }
}

export async function loadOffsetFromProfile(
  userId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_env_offset_ms")
    .eq("id", userId)
    .single();
  if (error) {
    console.error("[userEnvOffset] loadFromProfile error:", error);
    return null;
  }
  const val = (data as { user_env_offset_ms?: unknown })?.user_env_offset_ms;
  return typeof val === "number" ? val : null;
}

// ─── device change listener (Q-F) ────────────────────────────

export function onDeviceChange(
  callback: (event: { kinds: string[] }) => void
): () => void {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    return () => {};
  }
  const handler = () => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const kinds = [...new Set(devices.map((d) => d.kind))];
        callback({ kinds });
      })
      .catch(() => {
        callback({ kinds: [] });
      });
  };
  navigator.mediaDevices.addEventListener("devicechange", handler);
  return () => {
    navigator.mediaDevices.removeEventListener("devicechange", handler);
  };
}

// ─── device_change_events 로깅 (A2) ──────────────────────────

export async function logDeviceChangeEvent(params: {
  userId: string;
  deviceKinds: string[];
  previousOffsetMs: number | null;
  triggeredRecalibration: boolean;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from("device_change_events")
    .insert({
      user_id: params.userId,
      device_kinds: params.deviceKinds,
      triggered_recalibration: params.triggeredRecalibration,
      previous_offset_ms: params.previousOffsetMs,
      user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent : null,
    })
    .select("id")
    .single();
  if (error) {
    logger.error("Device 영역 이벤트 INSERT 실패", error, {
      description: "오디오 장치 변경 박은 영역 → device_change_events INSERT 박지 X",
      cause: error.message,
      impact: "장치 변경 영역 박지 X — 재캘리브레이션 추적 X",
      action: "userEnvironmentOffset.ts:112 영역 확인",
      metadata: { device_kinds: params.deviceKinds },
    });
    return null;
  }
  return (data as { id: string }).id;
}

export async function updateDeviceChangeEvent(
  eventId: string,
  newOffsetMs: number
): Promise<void> {
  const { error } = await supabase
    .from("device_change_events")
    .update({ new_offset_ms: newOffsetMs })
    .eq("id", eventId);
  if (error) {
    logger.error("device_change_events UPDATE 실패", error, {
      description: "환경 보정값 박은 영역 → DB UPDATE 실패",
      cause: error.message,
      impact: "재캘리브레이션 박힌 영역 박지 X — 사용자 반응시간 보정값 영구 잠재 불일치",
      action: "RLS UPDATE 정책 박힌지 확인 (Phase 3 Step 2-A에서 박은 영역)",
      metadata: {
        event_id: eventId,
        new_offset_ms: newOffsetMs,
      },
    });
  }
}
