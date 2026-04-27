import type { SubscriptionTier } from "./levelSystem";

/**
 * 사용자의 구독 등급(tier) 추론.
 *
 * - 로그인 안 한 사용자(user=null) → 'guest'
 * - profile.role === 'admin' → 'pro' (admin은 모든 레벨 접근)
 * - profile.subscription_tier === 'pro' → 'pro'
 * - profile.is_premium === true → 'pro' (Paddle webhook이 채우는 컬럼)
 * - 그 외 로그인된 사용자 → 'free'
 */
export function getUserTier(
  user: { id: string } | null,
  profile: {
    role?: string | null;
    subscription_tier?: string | null;
    is_premium?: boolean | null;
  } | null
): SubscriptionTier {
  if (!user) return "guest";
  if (!profile) return "free";

  if (profile.role === "admin") return "pro";
  if (profile.subscription_tier === "pro") return "pro";
  if (profile.is_premium === true) return "pro";

  return "free";
}
