// ═══════════════════════════════════════════════════════════════
// Creem Checkout (Supabase Edge Function)
// ═══════════════════════════════════════════════════════════════
// 클라이언트(Pricing.tsx)가 plan만 보내면 Edge Function이 product_id 매핑·
// Creem Checkout 세션 생성 후 redirect URL 반환.
//
// 보안:
//   - Bearer 토큰으로 본인 인증 → auth.uid 확보.
//   - product_id 는 env 매핑으로만 결정. 클라가 product_id 를 직접 보내지 못해
//     임의 상품 결제 차단.
//   - metadata.user_id 로 webhook 시 유저 식별.
//
// 패턴은 supabase/functions/paddle-customer-portal/index.ts 와 일치
// (Bearer 인증·service role·CORS·에러 처리).
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CREEM_API_KEY = Deno.env.get("CREEM_API_KEY")!;
const CREEM_PRODUCT_ID_MONTHLY = Deno.env.get("CREEM_PRODUCT_ID_MONTHLY") ?? "";
const CREEM_PRODUCT_ID_YEARLY = Deno.env.get("CREEM_PRODUCT_ID_YEARLY") ?? "";

// 단일 운영 도메인. preview 환경에서 결제 진입 안 함.
const SUCCESS_URL = "https://noteflex.app/checkout/success";

/** CREEM_API_KEY 접두로 sandbox/production 자동 판별. */
function creemApiBase(): string {
  return CREEM_API_KEY.startsWith("creem_test_")
    ? "https://test-api.creem.io/v1"
    : "https://api.creem.io/v1";
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // 1. 사용자 인증
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("[creem-checkout] 인증 실패:", authError);
      return json({ error: "Invalid token" }, 401);
    }

    // 2. plan → product_id (env 매핑만, 클라이언트 신뢰 X)
    let body: { plan?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const plan = body.plan;
    let productId: string | null = null;
    if (plan === "monthly") productId = CREEM_PRODUCT_ID_MONTHLY;
    else if (plan === "yearly") productId = CREEM_PRODUCT_ID_YEARLY;
    else return json({ error: "Invalid plan" }, 400);

    if (!productId) {
      console.error(
        `[creem-checkout] Product ID 미설정. plan=${plan}. env 확인 필요.`,
      );
      return json({ error: "Product not configured" }, 500);
    }

    // 3. user email 확보 (Creem checkout customer.email 에 사용)
    const userEmail = user.email;
    if (!userEmail) {
      console.error("[creem-checkout] user.email 없음. user_id=", user.id);
      return json({ error: "User has no email" }, 400);
    }

    // 4. request_id — 1분 윈도우 멱등성 (동일 클릭·더블 클릭 시 동일 세션 재사용 유도)
    const minuteWindow = Math.floor(Date.now() / 60_000);
    const requestId = `${user.id}-${plan}-${minuteWindow}`;

    // 5. Creem checkout 생성
    const creemResponse = await fetch(`${creemApiBase()}/checkouts`, {
      method: "POST",
      headers: {
        "x-api-key": CREEM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: productId,
        success_url: SUCCESS_URL,
        customer: { email: userEmail },
        metadata: { user_id: user.id },
        request_id: requestId,
      }),
    });

    if (!creemResponse.ok) {
      const errText = await creemResponse.text();
      console.error(
        "[creem-checkout] Creem API 오류:",
        creemResponse.status,
        errText,
      );
      return json({ error: "Creem API error", details: errText }, 502);
    }

    const creemData = await creemResponse.json();
    const url = creemData?.checkout_url;
    if (!url || typeof url !== "string") {
      console.error("[creem-checkout] checkout_url 응답 없음:", creemData);
      return json({ error: "Invalid Creem response" }, 502);
    }

    console.log(
      `[creem-checkout] checkout 생성 완료. user=${user.id} plan=${plan}`,
    );
    return json({ url });
  } catch (err) {
    console.error("[creem-checkout] 처리 중 오류:", err);
    return json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500,
    );
  }
});
