import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { AdBanner } from "./AdBanner";

// ─── useAuth mock ────────────────────────────────────────────
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({ user: null, profile: null })),
}));

// ─── adsense mock ────────────────────────────────────────────
vi.mock("@/lib/adsense", () => ({
  isAdsEnabled: vi.fn(() => false),
  pushAd: vi.fn(),
  getPublisherId: vi.fn(() => "ca-pub-test"),
}));

// ─── subscriptionTier mock ───────────────────────────────────
vi.mock("@/lib/subscriptionTier", () => ({
  getUserTier: vi.fn(() => "free"),
}));

import { isAdsEnabled } from "@/lib/adsense";
import { getUserTier } from "@/lib/subscriptionTier";
import { useAuth } from "@/contexts/AuthContext";

describe("AdBanner", () => {
  it("isAdsEnabled=false + DEV → 플레이스홀더 렌더링 (실제 광고 태그 없음)", () => {
    // 테스트 환경은 DEV=true — ads 비활성화 시 placeholder가 표시됨
    vi.mocked(isAdsEnabled).mockReturnValue(false);
    vi.mocked(getUserTier).mockReturnValue("free");
    const { container } = render(<AdBanner slot="0000000000" />);
    const placeholder = container.querySelector('[data-ad-slot="0000000000"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder?.textContent?.trim()).toBe("광고 영역");
    expect(container.querySelector("ins.adsbygoogle")).toBeNull();
  });

  it("Premium 사용자 (pro) → null 반환", () => {
    vi.mocked(isAdsEnabled).mockReturnValue(true);
    vi.mocked(getUserTier).mockReturnValue("pro");
    const { container } = render(<AdBanner slot="0000000000" />);
    expect(container.firstChild).toBeNull();
  });

  it("isAdsEnabled=true + free → ins 태그 렌더링", () => {
    vi.mocked(isAdsEnabled).mockReturnValue(true);
    vi.mocked(getUserTier).mockReturnValue("free");
    const { container } = render(<AdBanner slot="0000000000" />);
    const ins = container.querySelector("ins.adsbygoogle");
    expect(ins).not.toBeNull();
    expect(ins?.getAttribute("data-ad-slot")).toBe("0000000000");
  });

  it("guest 사용자도 광고 노출 (free와 동일)", () => {
    vi.mocked(isAdsEnabled).mockReturnValue(true);
    vi.mocked(getUserTier).mockReturnValue("guest");
    vi.mocked(useAuth).mockReturnValue({ user: null, profile: null } as any);
    const { container } = render(<AdBanner slot="0000000000" />);
    // guest는 pro가 아니므로 ads 노출
    expect(container.querySelector("ins.adsbygoogle")).not.toBeNull();
  });
});
