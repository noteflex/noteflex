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

describe("DailyLimitModal — Guest 영역", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "ko" });
  });

  it("Guest 헤드라인·body·CTA 표시 (ko)", () => {
    renderModal({ tier: "guest" });
    expect(screen.getByText(/오늘 3회/)).toBeInTheDocument();
    expect(screen.getByText(/가입하면/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "가입하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "닫기" })).toBeInTheDocument();
  });

  it("Guest CTA 클릭 → onSignUpRequest 호출 (있을 때)", async () => {
    const onSignUpRequest = vi.fn();
    const onClose = vi.fn();
    renderModal({ tier: "guest", onSignUpRequest, onClose });

    await userEvent.click(screen.getByRole("button", { name: "가입하기" }));

    expect(onSignUpRequest).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("Guest CTA 클릭 → onSignUpRequest 없을 때 /signup 이동", async () => {
    const onClose = vi.fn();
    renderModal({ tier: "guest", onClose });

    await userEvent.click(screen.getByRole("button", { name: "가입하기" }));

    expect(mockNavigate).toHaveBeenCalledWith("/signup");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("닫기 버튼 → onClose 호출", async () => {
    const onClose = vi.fn();
    renderModal({ tier: "guest", onClose });

    await userEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("DailyLimitModal — Free 영역", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "ko" });
  });

  it("Free 헤드라인·body·CTA 표시 (ko)", () => {
    renderModal({ tier: "free" });
    expect(screen.getByText(/오늘 7회/)).toBeInTheDocument();
    expect(screen.getByText(/Premium은 무제한/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Premium 보기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내일 다시 오기" })).toBeInTheDocument();
  });

  it("Free CTA 클릭 → /pricing 이동", async () => {
    const onClose = vi.fn();
    renderModal({ tier: "free", onClose });

    await userEvent.click(screen.getByRole("button", { name: "Premium 보기" }));

    expect(mockNavigate).toHaveBeenCalledWith("/pricing");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("DailyLimitModal — 카운트다운", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "ko" });
  });

  it("12시간 30분 = '12시간 30분 후 초기화'", () => {
    renderModal({ timeUntilResetMs: 12 * ONE_HOUR + 30 * 60 * 1000 });
    expect(screen.getByText(/12시간 30분/)).toBeInTheDocument();
  });

  it("0ms = '0시간 0분 후 초기화'", () => {
    renderModal({ timeUntilResetMs: 0 });
    expect(screen.getByText(/0시간 0분/)).toBeInTheDocument();
  });

  it("음수 입력 → 0시간 0분 (clamp)", () => {
    renderModal({ timeUntilResetMs: -1000 });
    expect(screen.getByText(/0시간 0분/)).toBeInTheDocument();
  });
});

describe("DailyLimitModal — 영어", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "en" });
  });

  it("Guest 영어 헤드라인·CTA", () => {
    renderModal({ tier: "guest" });
    expect(screen.getByText("Daily limit reached")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maybe later" })).toBeInTheDocument();
  });

  it("Free 영어 헤드라인·CTA", () => {
    renderModal({ tier: "free" });
    expect(screen.getByRole("button", { name: "View Premium" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again tomorrow" })).toBeInTheDocument();
  });

  it("카운트다운 영어 — 'Resets in 5h 0m'", () => {
    renderModal({ timeUntilResetMs: 5 * ONE_HOUR });
    expect(screen.getByText(/Resets in 5h 0m/)).toBeInTheDocument();
  });
});
