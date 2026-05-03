import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "noteflex.userEnvOffset";
const SKIP_KEY = "noteflex.calibrationSkippedOnce";

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
    console.error("[userEnvOffset] syncToProfile error:", error);
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
    console.warn("[userEnvOffset] logDeviceChangeEvent error:", error);
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
    console.warn("[userEnvOffset] updateDeviceChangeEvent error:", error);
  }
}
