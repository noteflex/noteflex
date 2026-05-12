import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AuthCallback from "./AuthCallback";

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockGetSession = vi.fn();
const mockNavigate   = vi.fn();
const mockFrom       = vi.fn();
const mockUpdate     = vi.fn();
const mockEq         = vi.fn();

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
