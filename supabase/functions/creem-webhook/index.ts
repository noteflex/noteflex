// ═══════════════════════════════════════════════════════════════
// Creem Webhook (Supabase Edge Function)
// ═══════════════════════════════════════════════════════════════
// Creem 구독 이벤트 → subscriptions UPSERT → 트리거(sync_premium_status)가
// profiles.is_premium / premium_until 자동 갱신.
//
// 패턴은 supabase/functions/paddle-webhook/index.ts 와 동일 — 서명 검증,
// service role UPSERT, profiles 동기화, chargeback 즉시 회수.
//
// DB 컬럼은 paddle_* 그대로 재사용 (의미만 Creem 으로 — paddle_customer_id =
// Creem cust_*, paddle_subscription_id = Creem sub_*, paddle_price_id =
// Creem product id). 리네임 마이그레이션 X.
//
// 페이로드 공통 구조 (docs.creem.io/llms-full.txt 기준):
//   { id: "evt_...", eventType: "...", object: { ... } }
// subscription.* 의 object: { id, status, customer_id, product_id,
//   current_period_start, current_period_end, canceled_at, expired_at, metadata }
// checkout.completed 의 object: { id, customer: {id, email}, product_id, metadata }
// refund/dispute 의 object: { customer_id, transaction_id, ... }  (subscription_id 없음)
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CREEM_WEBHOOK_SECRET = Deno.env.get("CREEM_WEBHOOK_SECRET") ?? "";
const CREEM_PRODUCT_ID_MONTHLY = Deno.env.get("CREEM_PRODUCT_ID_MONTHLY") ?? "";
const CREEM_PRODUCT_ID_YEARLY = Deno.env.get("CREEM_PRODUCT_ID_YEARLY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ═══════════════════════════════════════════════════════════════
// Creem 서명 검증
// ═══════════════════════════════════════════════════════════════
// 헤더: creem-signature
// 알고리즘: HMAC-SHA256(rawBody, secret).hex
// 타임스탬프 prefix 없음 — body 자체에 서명.

async function verifyCreemSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!secret) return true;
  if (!signatureHeader) {
    console.error("[creem-webhook] creem-signature 헤더 누락");
    return false;
  }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const computed = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // 타이밍 안전 비교
  if (computed.length !== signatureHeader.length) {
    console.error("[creem-webhook] 서명 길이 불일치");
    return false;
  }
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  const valid = diff === 0;
  if (!valid) {
    console.error("[creem-webhook] 서명 불일치");
  }
  return valid;
}

// ═══════════════════════════════════════════════════════════════
// 헬퍼
// ═══════════════════════════════════════════════════════════════

function planLabelForProduct(productId: string | null | undefined): string {
  if (productId && productId === CREEM_PRODUCT_ID_MONTHLY) return "premium_monthly";
  if (productId && productId === CREEM_PRODUCT_ID_YEARLY) return "premium_yearly";
  return "premium_monthly";
}

/**
 * 유저 식별. metadata.user_id 우선, 없으면 customer_id 로 profiles 매핑.
 * (구독 갱신·취소 등 metadata 가 누락된 페이로드 대비)
 */
async function findUserIdByMetadataOrCustomer(
  metadata: Record<string, unknown> | undefined,
  customerId: string | null | undefined,
): Promise<string | null> {
  const metaUid =
    typeof metadata?.user_id === "string" ? (metadata.user_id as string) : null;
  if (metaUid) return metaUid;
  if (!customerId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("paddle_customer_id", customerId)
    .maybeSingle();
  if (error) {
    console.error("[creem-webhook] profiles 조회 실패:", error);
    return null;
  }
  return data?.id ?? null;
}

// ═══════════════════════════════════════════════════════════════
// subscription.* 공통 UPSERT
// ═══════════════════════════════════════════════════════════════

interface SubscriptionObject {
  id: string;
  status: string;
  customer_id: string;
  product_id: string;
  current_period_start?: string;
  current_period_end?: string;
  canceled_at?: string | null;
  expired_at?: string | null;
  metadata?: Record<string, unknown>;
}

interface UpsertOverrides {
  status?: string;
  cancel_at_period_end?: boolean;
  canceled_at?: string | null;
}

async function upsertSubscription(
  eventType: string,
  obj: SubscriptionObject,
  overrides: UpsertOverrides = {},
): Promise<void> {
  const userId = await findUserIdByMetadataOrCustomer(
    obj.metadata,
    obj.customer_id,
  );
  if (!userId) {
    console.error(
      `[creem-webhook] ${eventType} user_id 매핑 실패. sub=${obj.id} cust=${obj.customer_id}`,
    );
    return;
  }

  const row = {
    user_id: userId,
    paddle_customer_id: obj.customer_id,            // = Creem customer id
    paddle_subscription_id: obj.id,                 // = Creem subscription id
    paddle_price_id: obj.product_id,                // = Creem product id
    status: overrides.status ?? obj.status,
    plan: planLabelForProduct(obj.product_id),
    current_period_start: obj.current_period_start ?? null,
    current_period_end: obj.current_period_end ?? null,
    cancel_at_period_end: overrides.cancel_at_period_end ?? false,
    canceled_at: overrides.canceled_at ?? obj.canceled_at ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("subscriptions")
    .upsert(row, { onConflict: "paddle_subscription_id" });
  if (error) {
    console.error(
      `[creem-webhook] subscriptions UPSERT 실패 (${eventType}):`,
      error,
    );
    return;
  }

  // profiles.paddle_customer_id 동기화 (customer portal 호출에 필요)
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      paddle_customer_id: obj.customer_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (profileError) {
    console.error(
      "[creem-webhook] profile customer_id 동기화 실패(비치명적):",
      profileError,
    );
  }

  console.log(
    `[creem-webhook] ${eventType} 처리 완료. user=${userId} status=${row.status}`,
  );
}

// ═══════════════════════════════════════════════════════════════
// checkout.completed — 최초 결제 시 customer id 연결
// ═══════════════════════════════════════════════════════════════
// subscription.active 이 함께 와서 UPSERT 처리하므로 여기선 profiles 동기화만.

interface CheckoutObject {
  id?: string;
  customer?: { id?: string; email?: string };
  product_id?: string;
  metadata?: Record<string, unknown>;
}

async function handleCheckoutCompleted(obj: CheckoutObject): Promise<void> {
  const customerId = obj.customer?.id ?? null;
  const userId = await findUserIdByMetadataOrCustomer(obj.metadata, customerId);
  if (!userId || !customerId) {
    console.error("[creem-webhook] checkout.completed 매핑 실패", {
      checkout: obj.id,
      cust: customerId,
    });
    return;
  }
  const { error } = await supabase
    .from("profiles")
    .update({
      paddle_customer_id: customerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) {
    console.error("[creem-webhook] checkout.completed profile 업데이트 실패:", error);
    return;
  }
  console.log(
    `[creem-webhook] checkout.completed 처리. user=${userId} cust=${customerId}`,
  );
}

// ═══════════════════════════════════════════════════════════════
// refund.created / dispute.created — 즉시 premium 회수
// ═══════════════════════════════════════════════════════════════
// 페이로드에 subscription_id 없음 → customer_id 로 매핑.
// 트리거 우회로 profiles 직접 UPDATE (paddle-webhook chargeback 패턴 동일).

interface RefundDisputeObject {
  id?: string;
  customer_id?: string;
  transaction_id?: string;
}

async function handleRefundOrDispute(
  eventType: string,
  obj: RefundDisputeObject,
): Promise<void> {
  const customerId = obj.customer_id;
  if (!customerId) {
    console.error(`[creem-webhook] ${eventType} customer_id 없음`, {
      event: obj.id,
    });
    return;
  }

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("paddle_customer_id", customerId)
    .maybeSingle();
  if (pErr || !profile) {
    console.error(
      `[creem-webhook] ${eventType} customer 조회 실패:`,
      pErr,
      { cust: customerId },
    );
    return;
  }

  const { error: upErr } = await supabase
    .from("profiles")
    .update({
      is_premium: false,
      premium_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);
  if (upErr) {
    console.error(`[creem-webhook] ${eventType} premium 회수 실패:`, upErr);
    return;
  }

  console.log(
    `[creem-webhook] ${eventType} 처리 완료. user=${profile.id} premium 즉시 회수`,
  );
}

// ═══════════════════════════════════════════════════════════════
// 메인 핸들러
// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
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

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    console.error("[creem-webhook] body 읽기 실패:", err);
    return new Response("Invalid body", { status: 400 });
  }

  const signature = req.headers.get("creem-signature");
  const valid = await verifyCreemSignature(
    rawBody,
    signature,
    CREEM_WEBHOOK_SECRET,
  );
  if (!valid) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: {
    id?: string;
    eventType?: string;
    object?: Record<string, unknown>;
  };
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error("[creem-webhook] JSON 파싱 실패:", err);
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType = event.eventType ?? "";
  const obj = (event.object ?? {}) as Record<string, unknown>;
  console.log(`[creem-webhook] 수신: ${eventType} evt=${event.id}`);

  try {
    switch (eventType) {
      case "checkout.completed":
        await handleCheckoutCompleted(obj as CheckoutObject);
        break;

      case "subscription.active":
      case "subscription.paid":
      case "subscription.trialing":
      case "subscription.update":
        await upsertSubscription(eventType, obj as unknown as SubscriptionObject);
        break;

      case "subscription.scheduled_cancel":
        // 기간 내 접근 유지 — status='active' + cancel_at_period_end=true.
        // 트리거는 status in (active, trialing) 일 때 is_premium 유지.
        await upsertSubscription(eventType, obj as unknown as SubscriptionObject, {
          status: "active",
          cancel_at_period_end: true,
        });
        break;

      case "subscription.canceled":
        await upsertSubscription(eventType, obj as unknown as SubscriptionObject, {
          status: "canceled",
          canceled_at:
            (obj as { canceled_at?: string }).canceled_at ??
            new Date().toISOString(),
        });
        break;

      case "subscription.past_due":
        await upsertSubscription(eventType, obj as unknown as SubscriptionObject, {
          status: "past_due",
        });
        break;

      case "subscription.expired":
        await upsertSubscription(eventType, obj as unknown as SubscriptionObject, {
          status: "expired",
        });
        break;

      case "refund.created":
      case "dispute.created":
        await handleRefundOrDispute(eventType, obj as RefundDisputeObject);
        break;

      default:
        console.log(`[creem-webhook] 처리하지 않는 이벤트: ${eventType}`);
    }
  } catch (err) {
    // 서명 검증 후 처리 실패는 200 반환 — Creem 재시도 폭주 방지.
    // 실패한 이벤트는 로그로 추적, 트리거·cron 안전망에 의존.
    console.error(`[creem-webhook] ${eventType} 처리 중 예외:`, err);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
