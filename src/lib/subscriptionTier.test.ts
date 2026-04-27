import { describe, it, expect } from "vitest";
import { getUserTier } from "./subscriptionTier";

describe("getUserTier", () => {
  it("user가 null이면 guest", () => {
    expect(getUserTier(null, null)).toBe("guest");
    expect(getUserTier(null, { is_premium: true })).toBe("guest"); // user 없으면 무조건 guest
  });

  it("profile이 null이면 free (drift 상태)", () => {
    expect(getUserTier({ id: "u1" }, null)).toBe("free");
  });

  it("subscription_tier='pro' → pro", () => {
    expect(getUserTier({ id: "u1" }, { subscription_tier: "pro" })).toBe("pro");
  });

  it("is_premium=true → pro (Paddle webhook 흔적)", () => {
    expect(getUserTier({ id: "u1" }, { is_premium: true })).toBe("pro");
  });

  it("둘 다 활성이면 pro", () => {
    expect(
      getUserTier({ id: "u1" }, { subscription_tier: "pro", is_premium: true })
    ).toBe("pro");
  });

  it("로그인됐고 둘 다 비활성이면 free", () => {
    expect(
      getUserTier({ id: "u1" }, { subscription_tier: null, is_premium: false })
    ).toBe("free");
    expect(getUserTier({ id: "u1" }, {})).toBe("free");
  });

  it("subscription_tier='free' 명시여도 is_premium=true면 pro", () => {
    // Paddle webhook 으로 결제 활성화는 됐는데 tier 컬럼은 아직 동기화 안 된 케이스
    expect(
      getUserTier({ id: "u1" }, { subscription_tier: "free", is_premium: true })
    ).toBe("pro");
  });

  it("role='admin' → pro (구독 컬럼이 비어 있어도 모든 레벨 접근)", () => {
    expect(getUserTier({ id: "u1" }, { role: "admin" })).toBe("pro");
    expect(
      getUserTier({ id: "u1" }, { role: "admin", subscription_tier: "free", is_premium: false })
    ).toBe("pro");
  });

  it("role='admin' 우선순위: user 없으면 guest 그대로", () => {
    expect(getUserTier(null, { role: "admin" })).toBe("guest");
  });
});