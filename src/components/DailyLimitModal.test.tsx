import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import DailyLimitModal from "./DailyLimitModal";

const { mockNavigate, mockUseLang } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseLang: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/contexts/LanguageContext", () => ({
  useLang: () => mockUseLang(),
}));

const ONE_HOUR = 60 * 60 * 1000;

function renderModal(props: Partial<React.ComponentProps<typeof DailyLimitModal>> = {}) {
  return render(
    <MemoryRouter>
      <DailyLimitModal
        open={true}
        tier="guest"
        timeUntilResetMs={ONE_HOUR * 12 + 30 * 60 * 1000}
        onClose={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );
}

describe("DailyLimitModal — Guest 영역 (ko)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "ko" });
  });

  it("Guest 헤드라인 + 가치 3개 표시", () => {
    renderModal({ tier: "guest" });
    expect(screen.getByRole("heading", { name: "오늘은 여기까지." })).toBeInTheDocument();
    expect(screen.getByText(/매일 7회 무료/)).toBeInTheDocument();
    expect(screen.getByText(/Lv1~Lv5 단계 이용/)).toBeInTheDocument();
    expect(screen.getByText(/AI 분석 보고서/)).toBeInTheDocument();
  });

  it("Guest CTA + 보조 버튼 표시", () => {
    renderModal({ tier: "guest" });
    expect(screen.getByRole("button", { name: "무료로 가입하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "닫기" })).toBeInTheDocument();
  });

  it("Guest CTA 클릭 → onSignUpClick 호출 (있을 때)", async () => {
    const onSignUpClick = vi.fn();
    const onClose = vi.fn();
    renderModal({ tier: "guest", onSignUpClick, onClose });

    await userEvent.click(screen.getByRole("button", { name: "무료로 가입하기" }));

    expect(onSignUpClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("Guest CTA 클릭 → onSignUpClick 미제공 시 /signup 이동", async () => {
    const onClose = vi.fn();
    renderModal({ tier: "guest", onClose });

    await userEvent.click(screen.getByRole("button", { name: "무료로 가입하기" }));

    expect(mockNavigate).toHaveBeenCalledWith("/signup");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("닫기 버튼 → onClose 호출, navigate X", async () => {
    const onClose = vi.fn();
    renderModal({ tier: "guest", onClose });

    await userEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("Guest 영역에 pricing 표시 X", () => {
    renderModal({ tier: "guest" });
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});

describe("DailyLimitModal — Free 영역 (ko)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "ko" });
  });

  it("Free 헤드라인 + 가치 4개 표시", () => {
    renderModal({ tier: "free" });
    expect(screen.getByRole("heading", { name: "오늘 7회를 마치셨어요." })).toBeInTheDocument();
    expect(screen.getByText(/매일 무제한/)).toBeInTheDocument();
    expect(screen.getByText(/21단계 모두 열림/)).toBeInTheDocument();
    expect(screen.getByText(/AI 풀 분석/)).toBeInTheDocument();
    expect(screen.getByText(/광고 없는 집중/)).toBeInTheDocument();
  });

  it("Free 가격 영역 표시 ($4.99·$39.99·33% 절약)", () => {
    renderModal({ tier: "free" });
    expect(screen.getByText(/\$4\.99/)).toBeInTheDocument();
    expect(screen.getByText(/\$39\.99/)).toBeInTheDocument();
    expect(screen.getByText(/33%/)).toBeInTheDocument();
  });

  it("Free CTA + 보조 버튼 표시", () => {
    renderModal({ tier: "free" });
    expect(screen.getByRole("button", { name: "Premium 시작하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내일 다시" })).toBeInTheDocument();
  });

  it("Free CTA 클릭 → onPremiumClick 호출 (있을 때)", async () => {
    const onPremiumClick = vi.fn();
    const onClose = vi.fn();
    renderModal({ tier: "free", onPremiumClick, onClose });

    await userEvent.click(screen.getByRole("button", { name: "Premium 시작하기" }));

    expect(onPremiumClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("Free CTA 클릭 → onPremiumClick 미제공 시 /pricing 이동", async () => {
    const onClose = vi.fn();
    renderModal({ tier: "free", onClose });

    await userEvent.click(screen.getByRole("button", { name: "Premium 시작하기" }));

    expect(mockNavigate).toHaveBeenCalledWith("/pricing");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("DailyLimitModal — 카운트다운 (ko)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "ko" });
  });

  it("12시간 30분 → 'reset까지: 12h 30m'", () => {
    renderModal({ timeUntilResetMs: 12 * ONE_HOUR + 30 * 60 * 1000 });
    expect(screen.getByText(/reset까지: 12h 30m/)).toBeInTheDocument();
  });

  it("0ms → 'reset까지: 0h 0m'", () => {
    renderModal({ timeUntilResetMs: 0 });
    expect(screen.getByText(/reset까지: 0h 0m/)).toBeInTheDocument();
  });

  it("음수 입력 → 0h 0m (clamp)", () => {
    renderModal({ timeUntilResetMs: -1000 });
    expect(screen.getByText(/0h 0m/)).toBeInTheDocument();
  });
});

describe("DailyLimitModal — 영어", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "en" });
  });

  it("Guest 영어 헤드라인·가치 리스트·CTA", () => {
    renderModal({ tier: "guest" });
    expect(screen.getByRole("heading", { name: "That's it for today." })).toBeInTheDocument();
    expect(screen.getByText(/7 free sessions daily/)).toBeInTheDocument();
    expect(screen.getByText(/Lv1 through Lv5/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign up — free" })).toBeInTheDocument();
  });

  it("Free 영어 헤드라인·가치 리스트·CTA·가격", () => {
    renderModal({ tier: "free" });
    expect(screen.getByRole("heading", { name: "You've finished today's seven." })).toBeInTheDocument();
    expect(screen.getByText(/Unlimited daily sessions/)).toBeInTheDocument();
    expect(screen.getByText(/All 21 stages unlocked/)).toBeInTheDocument();
    expect(screen.getByText(/Ad-free focus/)).toBeInTheDocument();
    expect(screen.getByText(/\$4\.99\/mo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Premium" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try tomorrow" })).toBeInTheDocument();
  });

  it("카운트다운 영어 — 'Resets in: 5h 0m'", () => {
    renderModal({ timeUntilResetMs: 5 * ONE_HOUR });
    expect(screen.getByText(/Resets in: 5h 0m/)).toBeInTheDocument();
  });
});

describe("DailyLimitModal — 메모리 #25 스타일 (Quick Mastery 영역 X)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "ko" });
  });

  it("Free 영역에 Quick Mastery 표현 X", () => {
    renderModal({ tier: "free" });
    expect(screen.queryByText(/Quick Mastery|빠른 통과/i)).not.toBeInTheDocument();
  });

  it("'모든 단계 열림'은 21단계 표현으로 정확히 반영됨 (Sub1만이 아닌 전체)", () => {
    renderModal({ tier: "free" });
    expect(screen.getByText(/21단계 모두 열림/)).toBeInTheDocument();
  });

  it("Guest 영역에 'Lv1~Lv5 단계 이용 가능' (모든 단계 X)", () => {
    renderModal({ tier: "guest" });
    expect(screen.getByText(/Lv1~Lv5 단계 이용 가능/)).toBeInTheDocument();
  });
});
