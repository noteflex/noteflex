import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AuthCallback from "./AuthCallback";

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockGetSession    = vi.fn();
const mockNavigate      = vi.fn();
const mockFrom          = vi.fn();
const mockSelect        = vi.fn();
const mockEq            = vi.fn();
const mockSingle        = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...args: any[]) => mockGetSession(...args),
    },
    from: (...args: any[]) => mockFrom(...args),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// BroadcastChannel mock
const mockBcPostMessage = vi.fn();
const mockBcClose       = vi.fn();
class MockBroadcastChannel {
  constructor(_: string) {}
  postMessage = mockBcPostMessage;
  close       = mockBcClose;
}
vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);

// window.close mock
const mockWindowClose = vi.spyOn(window, "close").mockImplementation(() => {});

// ─── Helpers ─────────────────────────────────────────────────────────────

function setupProfileQuery(profileCompleted: boolean | null) {
  mockSingle.mockResolvedValue({ data: profileCompleted !== null ? { profile_completed: profileCompleted } : null });
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

function withSession(profileCompleted: boolean | null) {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: "uid-1" } } },
    error: null,
  });
  setupProfileQuery(profileCompleted);
}

// ─────────────────────────────────────────────────────────────────────────
// AuthCallback
// ─────────────────────────────────────────────────────────────────────────

describe("AuthCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 인증 처리 중 loading text", () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthCallback />);
    expect(screen.getByText("인증 처리 중...")).toBeInTheDocument();
  });

  it("navigates to /?auth_error=session when no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthCallback />);
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/?auth_error=session", { replace: true })
    );
  });

  it("navigates to /?auth_error=session on getSession error", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: new Error("network") });
    render(<AuthCallback />);
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/?auth_error=session", { replace: true })
    );
  });

  it("BroadcastChannel.postMessage 호출 — profile_completed=false", async () => {
    withSession(false);
    render(<AuthCallback />);
    await waitFor(() =>
      expect(mockBcPostMessage).toHaveBeenCalledWith({
        type: "AUTH_COMPLETE",
        profile_completed: false,
      })
    );
  });

  it("BroadcastChannel.postMessage 호출 — profile_completed=true", async () => {
    withSession(true);
    render(<AuthCallback />);
    await waitFor(() =>
      expect(mockBcPostMessage).toHaveBeenCalledWith({
        type: "AUTH_COMPLETE",
        profile_completed: true,
      })
    );
  });

  it("profile row null 이면 profile_completed=false 로 전송", async () => {
    withSession(null);
    render(<AuthCallback />);
    await waitFor(() =>
      expect(mockBcPostMessage).toHaveBeenCalledWith({
        type: "AUTH_COMPLETE",
        profile_completed: false,
      })
    );
  });

  it("window.close() 호출", async () => {
    withSession(true);
    render(<AuthCallback />);
    await waitFor(() => expect(mockWindowClose).toHaveBeenCalled());
  });

  it("BroadcastChannel NOT called when no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthCallback />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockBcPostMessage).not.toHaveBeenCalled();
  });
});
