import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import AuthCallback from "./AuthCallback";

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockGetSession = vi.fn();
const mockSignOut    = vi.fn().mockResolvedValue({ error: null });
const mockNavigate   = vi.fn();
const mockFrom       = vi.fn();
const mockUpdate     = vi.fn();
const mockEq         = vi.fn();
const mockRpc        = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...args: any[]) => mockGetSession(...args),
      signOut:    (...args: any[]) => mockSignOut(...args),
    },
    from: (...args: any[]) => mockFrom(...args),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockBcPostMessage = vi.fn();
const mockBcClose       = vi.fn();
class MockBroadcastChannel {
  constructor(_: string) {}
  postMessage = mockBcPostMessage;
  close       = mockBcClose;
}
vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);

const mockWindowClose = vi.spyOn(window, "close").mockImplementation(() => {});

// ─── Helpers ─────────────────────────────────────────────────────────────

function withSession() {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: "uid-1" } } },
    error: null,
  });
  mockEq.mockResolvedValue({ error: null });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ update: mockUpdate });
}

// ─────────────────────────────────────────────────────────────────────────
// AuthCallback
// ─────────────────────────────────────────────────────────────────────────

describe("AuthCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders 인증 처리 중 loading text", () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthCallback />);
    expect(screen.getByText("인증 처리 중...")).toBeInTheDocument();
  });

  it("세션 없으면 /?auth_error=session으로 navigate", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthCallback />);
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/?auth_error=session", { replace: true })
    );
  });

  it("getSession 오류 시 /?auth_error=session으로 navigate", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: new Error("network") });
    render(<AuthCallback />);
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/?auth_error=session", { replace: true })
    );
  });

  it("세션 있으면 BroadcastChannel.postMessage 호출 (type: AUTH_COMPLETE)", async () => {
    withSession();
    render(<AuthCallback />);
    await waitFor(() =>
      expect(mockBcPostMessage).toHaveBeenCalledWith({ type: "AUTH_COMPLETE" })
    );
  });

  it("window.close() 호출", async () => {
    withSession();
    render(<AuthCallback />);
    await waitFor(() => expect(mockWindowClose).toHaveBeenCalled());
  });

  it("세션 없으면 BroadcastChannel 미호출", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthCallback />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockBcPostMessage).not.toHaveBeenCalled();
  });

  it("localStorage에 noteflex_consent 있으면 profiles.update 호출", async () => {
    withSession();
    const consent = { tos_agreed_at: "2026-05-12T00:00:00Z", privacy_agreed_at: "2026-05-12T00:00:00Z", marketing_agreed_at: null };
    localStorage.setItem("noteflex_consent", JSON.stringify(consent));
    render(<AuthCallback />);
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(consent));
    expect(localStorage.getItem("noteflex_consent")).toBeNull();
  });

  it("localStorage에 noteflex_consent 없으면 profiles.update 미호출", async () => {
    withSession();
    render(<AuthCallback />);
    await waitFor(() => expect(mockBcPostMessage).toHaveBeenCalled());
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 복구 링크 콜백 (?action=restore)
// ─────────────────────────────────────────────────────────────────────────

describe("복구 링크 콜백 (?action=restore)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockRpc.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
    localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("?action=restore → restore_account() RPC 호출", async () => {
    withSession();
    window.history.pushState({}, "", "?action=restore");
    render(<AuthCallback />);
    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith("restore_account")
    );
  });

  it("restore_account 성공 시 BroadcastChannel AUTH_COMPLETE 전송", async () => {
    withSession();
    window.history.pushState({}, "", "?action=restore");
    render(<AuthCallback />);
    await waitFor(() =>
      expect(mockBcPostMessage).toHaveBeenCalledWith({ type: "AUTH_COMPLETE" })
    );
  });

  it("restore_account 실패 시 /?auth_error=restore_failed로 navigate", async () => {
    withSession();
    mockRpc.mockResolvedValue({ error: { message: "recovery window expired" } });
    window.history.pushState({}, "", "?action=restore");
    render(<AuthCallback />);
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/?auth_error=restore_failed", { replace: true })
    );
  });

  it("action 파라미터 없으면 restore_account() 미호출", async () => {
    withSession();
    render(<AuthCallback />);
    await waitFor(() => expect(mockBcPostMessage).toHaveBeenCalled());
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("restore 성공 시 restore-complete-screen 표시", async () => {
    withSession();
    window.history.pushState({}, "", "?action=restore");
    render(<AuthCallback />);
    await waitFor(() =>
      expect(screen.getByTestId("restore-complete-screen")).toBeInTheDocument()
    );
  });

  it("restore 성공 시 localStorage noteflex_auth_complete 설정", async () => {
    withSession();
    window.history.pushState({}, "", "?action=restore");
    render(<AuthCallback />);
    await waitFor(() =>
      expect(localStorage.getItem("noteflex_auth_complete")).not.toBeNull()
    );
  });

  it("restore 성공 시 3000ms 후 window.close() 호출", async () => {
    vi.useFakeTimers();
    withSession();
    window.history.pushState({}, "", "?action=restore");
    render(<AuthCallback />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    vi.advanceTimersByTime(3000);
    await act(async () => { await Promise.resolve(); });
    expect(mockWindowClose).toHaveBeenCalled();
  });

  it("restore 성공 시 window.close 후 500ms에 navigate('/') 호출", async () => {
    vi.useFakeTimers();
    withSession();
    window.history.pushState({}, "", "?action=restore");
    render(<AuthCallback />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    vi.advanceTimersByTime(3500);
    await act(async () => { await Promise.resolve(); });
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 탈퇴 확인 콜백 (?action=confirm_deletion)
// ─────────────────────────────────────────────────────────────────────────

describe("탈퇴 확인 콜백 (?action=confirm_deletion)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockRpc.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("?action=confirm_deletion → request_account_deletion RPC 호출 (reason 포함)", async () => {
    withSession();
    window.history.pushState({}, "", "?action=confirm_deletion&reason=%EA%B8%B0%ED%83%80");
    render(<AuthCallback />);
    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith("request_account_deletion", { reason: "기타" })
    );
  });

  it("?action=confirm_deletion → signOut 호출", async () => {
    withSession();
    window.history.pushState({}, "", "?action=confirm_deletion");
    render(<AuthCallback />);
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });

  it("request_account_deletion 실패 시 /?auth_error=deletion_failed로 navigate", async () => {
    withSession();
    mockRpc.mockResolvedValue({ error: { message: "deletion failed" } });
    window.history.pushState({}, "", "?action=confirm_deletion");
    render(<AuthCallback />);
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/?auth_error=deletion_failed", { replace: true })
    );
  });
});
