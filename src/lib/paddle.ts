import { initializePaddle, Paddle } from "@paddle/paddle-js";

// ═════════════════════════════════════════════════════════════
// Paddle 초기화 (Singleton)
// ═════════════════════════════════════════════════════════════

let paddleInstance: Paddle | undefined;

/**
 * Paddle.js 초기화. 앱 시작 시 한 번만 호출.
 * 이후 paddleInstance를 전역에서 사용.
 */
export async function initPaddle(): Promise<Paddle | undefined> {
  if (paddleInstance) return paddleInstance;

  const environment = import.meta.env.VITE_PADDLE_ENVIRONMENT as
    | "sandbox"
    | "production";
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;

  if (!token) {
    console.error("[Paddle] Client token이 설정되지 않았습니다.");
    return undefined;
  }

  try {
    paddleInstance = await initializePaddle({
      environment: environment || "sandbox",
      token,
    });
    return paddleInstance;
  } catch (err) {
    console.error("[Paddle] 초기화 실패:", err);
    return undefined;
  }
}

export function getPaddle(): Paddle | undefined {
  return paddleInstance;
}

// ═════════════════════════════════════════════════════════════
// Price ID 상수 (환경 변수에서 불러옴)
// ═════════════════════════════════════════════════════════════

export const PADDLE_PRICES = {
  monthly: import.meta.env.VITE_PADDLE_PRICE_MONTHLY as string,
  yearly: import.meta.env.VITE_PADDLE_PRICE_YEARLY as string,
} as const;

export type PlanType = keyof typeof PADDLE_PRICES;

// ═════════════════════════════════════════════════════════════
// Checkout 실행
// ═════════════════════════════════════════════════════════════

export interface OpenCheckoutOptions {
  plan: PlanType;            // "monthly" | "yearly"
  userEmail?: string;        // 로그인한 사용자 이메일 (자동 입력)
  userId?: string;           // profiles.id (Paddle에 customData로 전달)
  onSuccess?: () => void;    // 결제 성공 콜백
  onClose?: () => void;      // 사용자가 닫았을 때
}

/**
 * Paddle Checkout 오버레이 열기.
 * 결제 완료/실패 이벤트는 Paddle이 자체 처리하고,
 * 실제 구독 상태는 Webhook으로 서버에서 반영.
 */
export async function openCheckout(options: OpenCheckoutOptions): Promise<void> {
  const paddle = await initPaddle();
  if (!paddle) {
    console.error("[Paddle] 초기화 안 됨. Checkout 불가");
    return;
  }

  const priceId = PADDLE_PRICES[options.plan];
  if (!priceId) {
    console.error("[Paddle] Price ID 누락:", options.plan);
    return;
  }

  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: options.userEmail ? { email: options.userEmail } : undefined,
    customData: options.userId ? { userId: options.userId } : undefined,
    settings: {
        displayMode: "overlay",
        theme: "light",
        locale: "ko",
        successUrl: `${window.location.origin}/checkout/success`,
        // Paddle은 failureUrl 옵션이 없음 — 결제 실패는 오버레이 내에서 처리됨
        // 사용자가 닫으면 페이지 그대로 유지됨 (리다이렉트 없음)
      },
  });
}