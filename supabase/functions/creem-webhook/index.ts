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
// 헬퍼 — Creem 페이로드 방어적 파싱
// ═══════════════════════════════════════════════════════════════
// 실제 Creem 페이로드 검증 결과:
//   subscription.* 의 object:
//     customer: 객체 {id:"cust_...", email, metadata:{user_id}}   ← 문자열 아님!
//     product: 객체 {id:"prod_..."} 또는 items: [{product_id, price_id}]
//     current_period_start_date / current_period_end_date         ← _date 접미사!
//     metadata: {user_id}
//   checkout.completed 의 object:
//     customer: 객체 {id, email, metadata}
//     order: {customer:"cust_..."(문자열), product:"prod_..."(문자열)}
//     subscription: {id, status, current_period_start_date, ...}
//
// 따라서 다음 헬퍼들이 케이스를 모두 흡수하도록 방어적으로 작성.

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** customer 가 객체면 .id, 문자열이면 그대로, 둘 다 없으면 obj.customer_id 폴백. */
function extractCustomerId(obj: Record<string, unknown>): string | null {
  const customer = obj.customer;
  const obj2 = asObject(customer);
  if (obj2) {
    const id = asString(obj2.id);
    if (id) return id;
  }
  const direct = asString(customer);
  if (direct) return direct;
  return asString(obj.customer_id);
}

/** product 가 객체면 .id, items[0].product_id, 또는 obj.product_id 폴백. */
function extractProductId(obj: Record<string, unknown>): string | null {
  const product = obj.product;
  const productObj = asObject(product);
  if (productObj) {
    const id = asString(productObj.id);
    if (id) return id;
  }
  const directProduct = asString(product);
  if (directProduct) return directProduct;

  const items = Array.isArray(obj.items) ? obj.items : null;
  if (items && items.length > 0) {
    const first = asObject(items[0]);
    if (first) {
      const pid = asString(first.product_id) ?? asString(asObject(first.product)?.id);
      if (pid) return pid;
    }
  }
  return asString(obj.product_id);
}

/** items[0].price_id 우선, 없으면 product_id 로 폴백(별도 price 개념 없는 경우). */
function extractPriceId(obj: Record<string, unknown>): string | null {
  const items = Array.isArray(obj.items) ? obj.items : null;
  if (items && items.length > 0) {
    const first = asObject(items[0]);
    if (first) {
      const pid = asString(first.price_id);
      if (pid) return pid;
    }
  }
  return extractProductId(obj);
}

/** Creem 은 current_period_start_date / current_period_end_date (_date 접미사). 폴백으로 _date 없는 형태도 시도. */
function extractPeriod(obj: Record<string, unknown>): {
  start: string | null;
  end: string | null;
} {
  return {
    start:
      asString(obj.current_period_start_date) ??
      asString(obj.current_period_start),
    end:
      asString(obj.current_period_end_date) ??
      asString(obj.current_period_end),
  };
}

/** metadata.user_id 추출. object.metadata 와 object.customer.metadata 둘 다 확인. */
function extractMetadataUserId(obj: Record<string, unknown>): string | null {
  const direct = asObject(obj.metadata);
  const fromDirect = direct ? asString(direct.user_id) : null;
  if (fromDirect) return fromDirect;
  const customerObj = asObject(obj.customer);
  const fromCustomer = customerObj
    ? asString(asObject(customerObj.metadata)?.user_id)
    : null;
  if (fromCustomer) return fromCustomer;
  return null;
}

function planLabelForProduct(productId: string | null | undefined): string {
  if (productId && productId === CREEM_PRODUCT_ID_MONTHLY) return "premium_monthly";
  if (productId && productId === CREEM_PRODUCT_ID_YEARLY) return "premium_yearly";
  return "premium_monthly";
}

/**
 * 유저 식별. metadata.user_id 우선(direct + customer 안 둘 다 시도),
 * 없으면 customer id 로 profiles.paddle_customer_id 매핑.
 */
async function findUserIdForObject(
  obj: Record<string, unknown>,
): Promise<string | null> {
  const metaUid = extractMetadataUserId(obj);
  if (metaUid) return metaUid;
  const customerId = extractCustomerId(obj);
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

interface UpsertOverrides {
  status?: string;
  cancel_at_period_end?: boolean;
  canceled_at?: string | null;
}

async function upsertSubscription(
  eventType: string,
  obj: Record<string, unknown>,
  overrides: UpsertOverrides = {},
): Promise<void> {
  const userId = await findUserIdForObject(obj);
  const subId = asString(obj.id);
  const customerId = extractCustomerId(obj);
  const productId = extractProductId(obj);
  const priceId = extractPriceId(obj);
  const status = asString(obj.status) ?? "unknown";
  const { start, end } = extractPeriod(obj);
  const canceledAt = asString(obj.canceled_at);

  if (!userId) {
    console.error(
      `[creem-webhook] ${eventType} user_id 매핑 실패. sub=${subId} cust=${customerId}`,
    );
    return;
  }
  if (!subId) {
    console.error(`[creem-webhook] ${eventType} subscription id 없음. obj=`, obj);
    return;
  }

  const row = {
    user_id: userId,
    paddle_customer_id: customerId,                   // = Creem customer id
    paddle_subscription_id: subId,                    // = Creem subscription id
    paddle_price_id: priceId,                         // = Creem price id (없으면 product id 폴백)
    status: overrides.status ?? status,
    plan: planLabelForProduct(productId),
    current_period_start: start,                       // 트리거가 premium_until 에 사용
    current_period_end: end,                           // 트리거가 premium_until 에 사용
    cancel_at_period_end: overrides.cancel_at_period_end ?? false,
    canceled_at: overrides.canceled_at ?? canceledAt ?? null,
    updated_at: new Date().toISOString(),
  };

  console.log(`[creem-webhook] ${eventType} UPSERT row:`, row);

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
  if (customerId) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        paddle_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (profileError) {
      console.error(
        "[creem-webhook] profile customer_id 동기화 실패(비치명적):",
        profileError,
      );
    }
  }

  console.log(
    `[creem-webhook] ${eventType} 처리 완료. user=${userId} status=${row.status} period_end=${end}`,
  );
}

// ═══════════════════════════════════════════════════════════════
// checkout.completed — 최초 결제 시 customer id 연결
// ═══════════════════════════════════════════════════════════════
// 페이로드의 nested subscription 객체가 있으면 그것도 UPSERT 처리하여 첫 이벤트에
// subscriptions row 가 정확히 생성되도록 한다(subscription.active 이벤트와 멱등).

async function handleCheckoutCompleted(
  obj: Record<string, unknown>,
): Promise<void> {
  const userId = await findUserIdForObject(obj);
  const customerId = extractCustomerId(obj);
  if (!userId || !customerId) {
    console.error("[creem-webhook] checkout.completed 매핑 실패", {
      checkout: asString(obj.id),
      cust: customerId,
      obj,
    });
    return;
  }

  // profiles.paddle_customer_id 연결
  const { error } = await supabase
    .from("profiles")
    .update({
      paddle_customer_id: customerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) {
    console.error("[creem-webhook] checkout.completed profile 업데이트 실패:", error);
  } else {
    console.log(
      `[creem-webhook] checkout.completed profile 연결. user=${userId} cust=${customerId}`,
    );
  }

  // nested subscription 객체가 있으면 함께 UPSERT — 첫 이벤트로 subscriptions row 확정.
  const subObj = asObject(obj.subscription);
  if (subObj) {
    // checkout.completed 의 nested subscription 에 customer 객체가 빠져 있을 수 있어
    // top-level customer 와 metadata 를 보강 후 위임.
    const merged: Record<string, unknown> = { ...subObj };
    if (!merged.customer && obj.customer) merged.customer = obj.customer;
    if (!merged.metadata && obj.metadata) merged.metadata = obj.metadata;
    // order 에서 product 문자열 보강 (subscription 내 product 누락 케이스)
    const order = asObject(obj.order);
    if (!merged.product && order) {
      const orderProduct = asString(order.product);
      if (orderProduct) merged.product = orderProduct;
    }
    await upsertSubscription("checkout.completed", merged);
  }
}

// ═══════════════════════════════════════════════════════════════
// refund.created / dispute.created — 즉시 premium 회수
// ═══════════════════════════════════════════════════════════════
// 페이로드에 subscription_id 없음 → customer_id 로 매핑.
// 트리거 우회로 profiles 직접 UPDATE (paddle-webhook chargeback 패턴 동일).

async function handleRefundOrDispute(
  eventType: string,
  obj: Record<string, unknown>,
): Promise<void> {
  const customerId = extractCustomerId(obj);
  if (!customerId) {
    console.error(`[creem-webhook] ${eventType} customer 매핑 실패`, {
      event: asString(obj.id),
      obj,
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
        await handleCheckoutCompleted(obj);
        break;

      case "subscription.active":
      case "subscription.paid":
      case "subscription.trialing":
      case "subscription.update":
        await upsertSubscription(eventType, obj);
        break;

      case "subscription.scheduled_cancel":
      case "subscription.canceled": {
        // 사용자 보호 — 결제한 기간 유지:
        //   current_period_end 가 미래(now 이후) → 기간말 취소로 간주.
        //     status='active' 유지 + cancel_at_period_end=true + canceled_at 기록.
        //     트리거가 active 라 is_premium=true 유지, premium_until=current_period_end.
        //     기간 만료는 별도 subscription.expired 또는 cron(expire_premium_users)이 회수.
        //   그 외 (현재/과거 종료, period 누락) → 즉시 취소.
        //     status='canceled' → 트리거가 is_premium=false.
        //
        // 사유:
        //   SKILL.md 상 canceled='Subscription terminated', scheduled_cancel='Cancellation queued
        //   for period end' 로 의미가 분리되어 있으나, 실측에서 기간말 취소도 canceled 로
        //   발화되는 케이스 확인됨. current_period_end 페이로드를 진실로 삼아 둘 다 안전 처리.
        const { end } = extractPeriod(obj);
        const endsInFuture = end
          ? new Date(end).getTime() > Date.now()
          : false;
        const canceledAt = asString(obj.canceled_at) ?? new Date().toISOString();

        if (endsInFuture) {
          console.log(
            `[creem-webhook] ${eventType} 기간말 취소로 간주(end=${end}). is_premium 유지.`,
          );
          await upsertSubscription(eventType, obj, {
            status: "active",
            cancel_at_period_end: true,
            canceled_at: canceledAt,
          });
        } else {
          console.log(
            `[creem-webhook] ${eventType} 즉시 취소로 간주(end=${end}). premium 회수.`,
          );
          await upsertSubscription(eventType, obj, {
            status: "canceled",
            cancel_at_period_end: false,
            canceled_at: canceledAt,
          });
        }
        break;
      }

      case "subscription.past_due":
        await upsertSubscription(eventType, obj, { status: "past_due" });
        break;

      case "subscription.expired":
        await upsertSubscription(eventType, obj, { status: "expired" });
        break;

      case "refund.created":
      case "dispute.created":
        await handleRefundOrDispute(eventType, obj);
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
