import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserEnvOffset,
  setUserEnvOffset,
  clearUserEnvOffset,
  hasStoredOffset,
  syncOffsetToProfile,
  loadOffsetFromProfile,
  getCalibrationSkippedOnce,
  setCalibrationSkippedOnce,
  onDeviceChange,
  logDeviceChangeEvent,
  updateDeviceChangeEvent,
} from "@/lib/userEnvironmentOffset";

export interface UseUserEnvOffsetReturn {
  /** 현재 offset (ms). null = calibration 미수행 */
  offsetMs: number | null;
  /** calibration 완료 여부 */
  isCalibrated: boolean;
  /** calibration이 필요한가 (미완료 시 항상 true) */
  needsCalibration: boolean;
  /** skip 버튼 노출 여부 (Q-E: 1회만 허용) */
  canSkip: boolean;
  /** 오디오 장치 변경 감지 (Q-F) */
  deviceChanged: boolean;
  /** calibration 완료 — offset 저장 + DB sync */
  setOffset: (ms: number) => Promise<void>;
  /** calibration 초기화 */
  clearOffset: () => Promise<void>;
  /** 1회 skip 처리 (canSkip → false) */
  skipCalibration: () => void;
  /** deviceChanged 플래그 리셋 */
  resetDeviceChanged: () => void;
}

export function useUserEnvOffset(): UseUserEnvOffsetReturn {
  const { user } = useAuth();
  const [offsetMs, setOffsetMs] = useState<number | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [canSkip, setCanSkip] = useState(!getCalibrationSkippedOnce());
  const [deviceChanged, setDeviceChanged] = useState(false);

  const userRef = useRef(user);
  const pendingDeviceEventRef = useRef<string | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);

  // 초기 로드: localStorage → DB (로그인 시 DB 우선)
  useEffect(() => {
    setCanSkip(!getCalibrationSkippedOnce());

    if (!user) {
      if (hasStoredOffset()) {
        setOffsetMs(getUserEnvOffset());
        setIsCalibrated(true);
      } else {
        setOffsetMs(null);
        setIsCalibrated(false);
      }
      return;
    }

    (async () => {
      const dbOffset = await loadOffsetFromProfile(user.id);
      if (dbOffset !== null) {
        setUserEnvOffset(dbOffset);
        setOffsetMs(dbOffset);
        setIsCalibrated(true);
      } else if (hasStoredOffset()) {
        setOffsetMs(getUserEnvOffset());
        setIsCalibrated(true);
      } else {
        setOffsetMs(null);
        setIsCalibrated(false);
      }
    })();
  }, [user]);

  // Q-F: device 변경 감지 → 자동 재측정 (메모리 #19) + A2 이벤트 로깅
  useEffect(() => {
    return onDeviceChange((event) => {
      setDeviceChanged(true);
      setIsCalibrated(false); // needsCalibration → true → 다음 게임 진입 시 자동 모달
      if (userRef.current) {
        void logDeviceChangeEvent({
          userId: userRef.current.id,
          deviceKinds: event.kinds,
          previousOffsetMs: hasStoredOffset() ? getUserEnvOffset() : null,
          triggeredRecalibration: true,
        }).then((id) => {
          if (id) pendingDeviceEventRef.current = id;
        });
      }
    });
  }, []);

  const setOffset = useCallback(
    async (ms: number) => {
      setUserEnvOffset(ms);
      setOffsetMs(ms);
      setIsCalibrated(true);
      if (user) {
        await syncOffsetToProfile(user.id, ms);
      }
      if (pendingDeviceEventRef.current) {
        await updateDeviceChangeEvent(pendingDeviceEventRef.current, ms);
        pendingDeviceEventRef.current = null;
      }
    },
    [user]
  );

  const clearOffset = useCallback(
    async () => {
      clearUserEnvOffset();
      setOffsetMs(null);
      setIsCalibrated(false);
      setCanSkip(true);
      if (user) {
        await syncOffsetToProfile(user.id, 0);
      }
    },
    [user]
  );

  const skipCalibration = useCallback(() => {
    setCalibrationSkippedOnce();
    setCanSkip(false);
  }, []);

  const resetDeviceChanged = useCallback(() => {
    setDeviceChanged(false);
  }, []);

  return {
    offsetMs,
    isCalibrated,
    needsCalibration: !isCalibrated,
    canSkip,
    deviceChanged,
    setOffset,
    clearOffset,
    skipCalibration,
    resetDeviceChanged,
  };
}
