import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useUserEnvOffset } from "./useUserEnvOffset";

// Mock all lib functions
const mockGetUserEnvOffset = vi.fn(() => 0);
const mockSetUserEnvOffset = vi.fn();
const mockClearUserEnvOffset = vi.fn();
const mockHasStoredOffset = vi.fn(() => false);
const mockSyncOffsetToProfile = vi.fn(() => Promise.resolve());
const mockLoadOffsetFromProfile = vi.fn(() => Promise.resolve(null));
const mockGetCalibrationSkippedOnce = vi.fn(() => false);
const mockSetCalibrationSkippedOnce = vi.fn();
const mockOnDeviceChange = vi.fn(() => () => {});
const mockLogDeviceChangeEvent = vi.fn(() => Promise.resolve(null));
const mockUpdateDeviceChangeEvent = vi.fn(() => Promise.resolve());

vi.mock("@/lib/userEnvironmentOffset", () => ({
  getUserEnvOffset: (...args: unknown[]) => mockGetUserEnvOffset(...args),
  setUserEnvOffset: (...args: unknown[]) => mockSetUserEnvOffset(...args),
  clearUserEnvOffset: (...args: unknown[]) => mockClearUserEnvOffset(...args),
  hasStoredOffset: (...args: unknown[]) => mockHasStoredOffset(...args),
  syncOffsetToProfile: (...args: unknown[]) => mockSyncOffsetToProfile(...args),
  loadOffsetFromProfile: (...args: unknown[]) => mockLoadOffsetFromProfile(...args),
  getCalibrationSkippedOnce: (...args: unknown[]) => mockGetCalibrationSkippedOnce(...args),
  setCalibrationSkippedOnce: (...args: unknown[]) => mockSetCalibrationSkippedOnce(...args),
  onDeviceChange: (...args: unknown[]) => mockOnDeviceChange(...args),
  logDeviceChangeEvent: (...args: unknown[]) => mockLogDeviceChangeEvent(...args),
  updateDeviceChangeEvent: (...args: unknown[]) => mockUpdateDeviceChangeEvent(...args),
}));

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useUserEnvOffset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null });
    mockHasStoredOffset.mockReturnValue(false);
    mockGetCalibrationSkippedOnce.mockReturnValue(false);
    mockLoadOffsetFromProfile.mockResolvedValue(null);
    mockOnDeviceChange.mockReturnValue(() => {});
  });

  describe("isLoading state", () => {
    it("초기 마운트: isLoading = true, isCalibrated = false", () => {
      // loadOffsetFromProfile never resolves during this check
      mockLoadOffsetFromProfile.mockReturnValue(new Promise(() => {}));
      mockUseAuth.mockReturnValue({ user: { id: "user-1" } });

      const { result } = renderHook(() => useUserEnvOffset());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isCalibrated).toBe(false);
      expect(result.current.needsCalibration).toBe(false); // !isLoading && !isCalibrated → false while loading
    });

    it("비로그인 + localStorage 없음 → isLoading = false, isCalibrated = false", async () => {
      mockHasStoredOffset.mockReturnValue(false);

      const { result } = renderHook(() => useUserEnvOffset());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isCalibrated).toBe(false);
      expect(result.current.needsCalibration).toBe(true);
    });

    it("비로그인 + localStorage 있음 → isLoading = false, isCalibrated = true", async () => {
      mockHasStoredOffset.mockReturnValue(true);
      mockGetUserEnvOffset.mockReturnValue(120);

      const { result } = renderHook(() => useUserEnvOffset());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isCalibrated).toBe(true);
      expect(result.current.offsetMs).toBe(120);
      expect(result.current.needsCalibration).toBe(false);
    });

    it("로그인 + DB offset 있음 → isLoading = false, isCalibrated = true", async () => {
      mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
      mockLoadOffsetFromProfile.mockResolvedValue(200);
      mockHasStoredOffset.mockReturnValue(false);

      const { result } = renderHook(() => useUserEnvOffset());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isCalibrated).toBe(true);
      expect(result.current.offsetMs).toBe(200);
      expect(result.current.needsCalibration).toBe(false);
    });

    it("로그인 + DB offset 없음 + localStorage 없음 → isLoading = false, isCalibrated = false", async () => {
      mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
      mockLoadOffsetFromProfile.mockResolvedValue(null);
      mockHasStoredOffset.mockReturnValue(false);

      const { result } = renderHook(() => useUserEnvOffset());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isCalibrated).toBe(false);
      expect(result.current.needsCalibration).toBe(true);
    });

    it("로그인 + DB offset 없음 + localStorage 있음 → isLoading = false, isCalibrated = true", async () => {
      mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
      mockLoadOffsetFromProfile.mockResolvedValue(null);
      mockHasStoredOffset.mockReturnValue(true);
      mockGetUserEnvOffset.mockReturnValue(80);

      const { result } = renderHook(() => useUserEnvOffset());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isCalibrated).toBe(true);
      expect(result.current.offsetMs).toBe(80);
      expect(result.current.needsCalibration).toBe(false);
    });
  });

  describe("needsCalibration guard", () => {
    it("로딩 중에는 needsCalibration = false (플래시 방지)", async () => {
      mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
      // Hold the promise so isLoading stays true
      let resolveDb!: (v: null) => void;
      mockLoadOffsetFromProfile.mockReturnValue(
        new Promise<null>((res) => { resolveDb = res; })
      );

      const { result } = renderHook(() => useUserEnvOffset());

      // While loading: needsCalibration must be false
      expect(result.current.isLoading).toBe(true);
      expect(result.current.needsCalibration).toBe(false);

      // Resolve DB (no offset)
      resolveDb(null);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.needsCalibration).toBe(true);
    });
  });

  describe("setOffset", () => {
    it("offset 저장 후 isCalibrated = true, syncOffsetToProfile 호출", async () => {
      mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
      mockLoadOffsetFromProfile.mockResolvedValue(null);
      mockHasStoredOffset.mockReturnValue(false);

      const { result } = renderHook(() => useUserEnvOffset());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.setOffset(150);
      });

      expect(mockSetUserEnvOffset).toHaveBeenCalledWith(150);
      expect(result.current.offsetMs).toBe(150);
      expect(result.current.isCalibrated).toBe(true);
      expect(mockSyncOffsetToProfile).toHaveBeenCalledWith("user-1", 150);
    });
  });

  describe("clearOffset", () => {
    it("offset 초기화 후 isCalibrated = false", async () => {
      mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
      mockLoadOffsetFromProfile.mockResolvedValue(100);

      const { result } = renderHook(() => useUserEnvOffset());

      await waitFor(() => expect(result.current.isCalibrated).toBe(true));

      await act(async () => {
        await result.current.clearOffset();
      });

      expect(mockClearUserEnvOffset).toHaveBeenCalled();
      expect(result.current.offsetMs).toBeNull();
      expect(result.current.isCalibrated).toBe(false);
      expect(mockSyncOffsetToProfile).toHaveBeenCalledWith("user-1", 0);
    });
  });
});
