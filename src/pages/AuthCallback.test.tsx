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

// ─── Helpers ─────────────────────────────────────────────────────────────

function setupProfileQuery(profileCompleted: boolean | null) {
  mockSingle.mockResolvedValue({ data: profileCompleted !== null ? { profile_completed: profileCompleted } : null });
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
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

  it("navigates to /?complete_profile=1 when profile_completed is false", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "uid-1" } } },
      error: null,
    });
    setupProfileQuery(false);
    render(<AuthCallback />);
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/?complete_profile=1", { replace: true })
    );
  });

  it("navigates to / when profile_completed is true", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "uid-1" } } },
      error: null,
    });
    setupProfileQuery(true);
    render(<AuthCallback />);
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true })
    );
  });

  it("navigates to /?complete_profile=1 when profile row is null", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "uid-1" } } },
      error: null,
    });
    setupProfileQuery(null);
    render(<AuthCallback />);
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/?complete_profile=1", { replace: true })
    );
  });
});
