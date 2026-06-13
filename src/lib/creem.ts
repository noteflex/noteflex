// Creem 결제 클라이언트 헬퍼.
// Supabase Edge Function 3개(creem-checkout / creem-customer-portal)를 호출해
// Creem hosted checkout / billing portal로 redirect 한다.
//
// 백엔드 패턴은 supabase/functions/creem-* 와 짝. 인증은 supabase access token Bearer.

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/sentry";

export type CreemPlan = "monthly" | "yearly";

const SUPABASE_BASE = import.meta.env.VITE_SUPABASE_URL as string;

/** Bearer access token 확보. 세션 없으면 null. */
async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Creem Checkout 세션 생성 후 redirect.
 * 호출처(Pricing.tsx)는 plan 만 전달. product_id 매핑은 서버 env 가 진실.
 */
export async function startCreemCheckout(plan: CreemPlan): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    logger.warn("Creem checkout — 세션 토큰 누락");
    return;
  }

  const url = `${SUPABASE_BASE}/functions/v1/creem-checkout`;
  logger.info("Creem checkout 요청 시작", {
    description: `creem-checkout 호출 (${plan})`,
    plan,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plan }),
    });
  } catch (err) {
    logger.error("Creem checkout fetch 실패", err, {
      description: "creem-checkout 호출 중 네트워크 예외",
      cause: err instanceof Error ? err.message : String(err),
      metadata: { plan },
    });
    return;
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    logger.error("Creem checkout 생성 실패", new Error(errBody.error ?? "unknown"), {
      description: "creem-checkout Edge Function 비정상 응답",
      cause: errBody.error ?? String(response.status),
      impact: "사용자가 결제 진행 불가",
      metadata: { plan, status: response.status, details: errBody.details ?? null },
    });
    return;
  }

  const { url: checkoutUrl } = (await response.json()) as { url?: string };
  if (!checkoutUrl) {
    logger.error("Creem checkout — url 응답 누락", new Error("missing url"), {
      description: "creem-checkout 응답 본문에 url 없음",
      impact: "redirect 불가",
      metadata: { plan },
    });
    return;
  }
  window.location.href = checkoutUrl;
}

/**
 * Creem Customer Billing Portal 발급 후 redirect.
 * 호출처(ProfilePage.tsx)는 구독 관리 버튼 핸들러.
 */
export async function openCreemPortal(): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    logger.warn("Creem portal — 세션 토큰 누락");
    return;
  }

  const url = `${SUPABASE_BASE}/functions/v1/creem-customer-portal`;
  logger.info("Creem portal 요청 시작", {
    description: "creem-customer-portal 호출",
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    logger.error("Creem portal fetch 실패", err, {
      description: "creem-customer-portal 호출 중 네트워크 예외",
      cause: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    logger.error("Creem portal 발급 실패", new Error(errBody.error ?? "unknown"), {
      description: "creem-customer-portal Edge Function 비정상 응답",
      cause: errBody.error ?? String(response.status),
      impact: "사용자가 구독 관리 페이지 접근 불가",
      metadata: { status: response.status, details: errBody.details ?? null },
    });
    return;
  }

  const { portalUrl } = (await response.json()) as { portalUrl?: string };
  if (!portalUrl) {
    logger.error("Creem portal — portalUrl 응답 누락", new Error("missing portalUrl"), {
      description: "creem-customer-portal 응답 본문에 portalUrl 없음",
    });
    return;
  }
  window.location.href = portalUrl;
}
