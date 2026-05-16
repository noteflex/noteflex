import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import PremiumBlurCard from "./PremiumBlurCard";

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

function renderCard(
  tier: "guest" | "free" | "premium" | "admin",
  extra: Partial<React.ComponentProps<typeof PremiumBlurCard>> = {}
) {
  return render(
    <MemoryRouter>
      <PremiumBlurCard tier={tier} {...extra}>
        <span data-testid="child-content">Protected Content</span>
      </PremiumBlurCard>
    </MemoryRouter>
  );
}

describe("PremiumBlurCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "ko" });
  });

  it("premium — children 그대로 노출, blur 없음", () => {
    renderCard("premium");
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.queryByTestId("blur-layer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("upgrade-overlay")).not.toBeInTheDocument();
  });

  it("admin — children 그대로 노출, blur 없음", () => {
    renderCard("admin");
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.queryByTestId("blur-layer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("upgrade-overlay")).not.toBeInTheDocument();
  });

  it("free — blur-layer + upgrade-overlay 표시", () => {
    renderCard("free");
    expect(screen.getByTestId("blur-layer")).toBeInTheDocument();
    expect(screen.getByTestId("upgrade-overlay")).toBeInTheDocument();
  });

  it("guest — blur-layer + upgrade-overlay 표시", () => {
    renderCard("guest");
    expect(screen.getByTestId("blur-layer")).toBeInTheDocument();
    expect(screen.getByTestId("upgrade-overlay")).toBeInTheDocument();
  });

  it("free ko — 기본 CTA 텍스트 '프리미엄 혜택 보기 →'", () => {
    renderCard("free");
    expect(screen.getByTestId("upgrade-cta")).toHaveTextContent("프리미엄 혜택 보기 →");
  });

  it("ctaText prop 제공 시 기본 텍스트 덮어쓰기", () => {
    renderCard("free", { ctaText: "지금 업그레이드" });
    expect(screen.getByTestId("upgrade-cta")).toHaveTextContent("지금 업그레이드");
  });

  it("onUpgrade 미제공 시 클릭 → /pricing 이동", async () => {
    renderCard("free");
    await userEvent.click(screen.getByTestId("upgrade-cta"));
    expect(mockNavigate).toHaveBeenCalledWith("/pricing");
  });

  it("onUpgrade 제공 시 클릭 → onUpgrade 호출, navigate X", async () => {
    const onUpgrade = vi.fn();
    renderCard("free", { onUpgrade });
    await userEvent.click(screen.getByTestId("upgrade-cta"));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("blurAmount prop → blur-layer style에 반영", () => {
    renderCard("free", { blurAmount: 12 });
    const blurLayer = screen.getByTestId("blur-layer");
    expect(blurLayer).toHaveStyle({ filter: "blur(12px)" });
  });
});
