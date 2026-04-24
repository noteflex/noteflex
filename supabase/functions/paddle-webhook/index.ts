// ═══════════════════════════════════════════════════════════════
// Paddle Webhook Handler (Supabase Edge Function)
// ═══════════════════════════════════════════════════════════════
// Paddle이 구독 이벤트를 POST 요청으로 보내면, 이 함수가:
//   1. Paddle 서명 검증 (보안)
//   2. 이벤트 종류 확인
//   3. subscriptions 테이블 업데이트
//   4. 트리거가 profiles.is_premium 자동 동기화
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PADDLE_WEBHOOK_SECRET = Deno.env.get("PADDLE_WEBHOOK_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ═══════════════════════════════════════════════════════════════
// Paddle 서명 검증
// ═══════════════════════════════════════════════════════════════
// Paddle-Signature 헤더 형식: "ts=TIMESTAMP;h1=HASH"
// 검증 공식: HMAC-SHA256(timestamp:rawBody, webhookSecret) === h1
// ═══════════════════════════════════════════════════════════════

async function verifyPaddleSignature(
    rawBody: string,
    signatureHeader: string | null,
    secret: string,
  ): Promise<boolean> {
    if (!secret) return true;
    if (!signatureHeader) {
      console.error("[Webhook] Paddle-Signature 헤더 누락");
      return false;
    }
  
    // 서명 헤더 파싱 (ts=..., h1=...)
    const parts: Record<string, string> = {};
    for (const part of signatureHeader.split(";")) {
      const [k, v] = part.split("=");
      if (k && v) parts[k.trim()] = v.trim();
    }
  
    const ts = parts.ts;
    const h1 = parts.h1;
    if (!ts || !h1) {
      console.error("[Webhook] 서명 형식 이상:", signatureHeader);
      return false;
    }
  
    // HMAC-SHA256(ts:rawBody, secret)
    const payload = `${ts}:${rawBody}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
    const computed = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  
    const valid = computed === h1;
    if (!valid) {
      console.error("[Webhook] 서명 불일치", {
        ts,
        secretPrefix: secret.slice(0, 10),
        expected: h1,
        computed,
      });
    }
    return valid;
  }

// ═══════════════════════════════════════════════════════════════
// Paddle 이벤트 → subscriptions 테이블 반영
// ═══════════════════════════════════════════════════════════════

type PaddleEventType =
  | "subscription.created"
  | "subscription.updated"
  | "subscription.canceled"
  | "subscription.activated"
  | "subscription.paused"
  | "subscription.resumed"
  | "transaction.completed"
  | string;

interface PaddleSubscriptionData {
  id: string;
  customer_id: string;
  status: string;
  items?: Array<{ price: { id: string } }>;
  current_billing_period?: { starts_at: string; ends_at: string };
  scheduled_change?: { action: string; effective_at: string } | null;
  canceled_at?: string | null;
  custom_data?: { userId?: string } | null;
}

async function handleSubscriptionEvent(
  eventType: PaddleEventType,
  data: PaddleSubscriptionData,
): Promise<void> {
  const userId = data.custom_data?.userId;
  if (!userId) {
    console.error("[Webhook] custom_data.userId 누락. 건너뜀.", { subscription: data.id });
    return;
  }

  const priceId = data.items?.[0]?.price?.id ?? null;
  const planLabel =
    priceId === Deno.env.get("VITE_PADDLE_PRICE_MONTHLY")
      ? "premium_monthly"
      : priceId === Deno.env.get("VITE_PADDLE_PRICE_YEARLY")
      ? "premium_yearly"
      : "premium_monthly"; // fallback

  const row = {
    user_id: userId,
    stripe_customer_id: data.customer_id,      // 컬럼명 재활용 (paddle_customer_id 역할)
    stripe_subscription_id: data.id,
    stripe_price_id: priceId,
    status: data.status,
    plan: planLabel,
    current_period_start: data.current_billing_period?.starts_at ?? null,
    current_period_end: data.current_billing_period?.ends_at ?? null,
    cancel_at_period_end: !!data.scheduled_change && data.scheduled_change.action === "cancel",
    canceled_at: data.canceled_at ?? null,
  };

  // UPSERT by stripe_subscription_id
  const { error } = await supabase
    .from("subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" });

  if (error) {
    console.error("[Webhook] subscriptions UPSERT 실패:", error);
    throw error;
  }

  console.log(`[Webhook] ${eventType} 처리 완료. user=${userId}, status=${data.status}`);
}

// ═══════════════════════════════════════════════════════════════
// 메인 핸들러
// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
  // CORS (실제 결제 서버 요청은 CORS 체크 없지만 안전)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("paddle-signature");

    // 1. 서명 검증
    const isValid = await verifyPaddleSignature(rawBody, signature, PADDLE_WEBHOOK_SECRET);
    if (!isValid) {
      console.error("[Webhook] 서명 검증 실패");
      return new Response("Invalid signature", { status: 401 });
    }

    // 2. 페이로드 파싱
    const event = JSON.parse(rawBody);
    const eventType: PaddleEventType = event.event_type;
    const eventData = event.data;

    console.log(`[Webhook] 이벤트 수신: ${eventType}, subscription_id=${eventData?.id}`);

    // 3. 이벤트 라우팅
    switch (eventType) {
      case "subscription.created":
      case "subscription.updated":
      case "subscription.activated":
      case "subscription.resumed":
      case "subscription.paused":
      case "subscription.canceled":
        await handleSubscriptionEvent(eventType, eventData as PaddleSubscriptionData);
        break;

      case "transaction.completed":
        // 일회성 결제 or 구독 갱신 시 발생. 기본은 구독 이벤트로 처리됨.
        console.log(`[Webhook] transaction.completed 로깅만. (구독은 별도 이벤트로 처리)`);
        break;

      default:
        console.log(`[Webhook] 처리하지 않는 이벤트: ${eventType}`);
    }

    // Paddle에 200 반환 (안 주면 재시도함)
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Webhook] 처리 중 오류:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});