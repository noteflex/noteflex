// ═══════════════════════════════════════════════════════════════
// Creem Customer Portal (Supabase Edge Function)
// ═══════════════════════════════════════════════════════════════
// Bearer 인증 → profiles.paddle_customer_id (= Creem customer id) 조회 →
// Creem API 로 billing portal URL 발급 → 클라이언트에 반환.
//
// 패턴은 supabase/functions/paddle-customer-portal/index.ts 와 동일.
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CREEM_API_KEY = Deno.env.get("CREEM_API_KEY")!;

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
      console.error("[creem-portal] 인증 실패:", authError);
      return json({ error: "Invalid token" }, 401);
    }

    // 2. customer id 조회 (paddle_customer_id 컬럼에 Creem cust_* 저장)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("paddle_customer_id")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.paddle_customer_id) {
      console.error("[creem-portal] customer id 누락:", profileError);
      return json({ error: "Creem customer not found" }, 404);
    }

    // 3. Creem billing portal 발급
    // 공식 문서가 응답 필드명을 명시하지 않아 응답 전체를 로깅하고 가능한 필드를 순회 시도.
    // 알려진 후보 경로: portal_url / url / customer_portal_link / data.portal_url / data.url.
    const customerId = profile.paddle_customer_id;
    const reqBody = { customer_id: customerId };
    console.log(
      `[creem-portal] Creem 요청. user=${user.id} cust=${customerId} body=`,
      reqBody,
    );

    const creemResponse = await fetch(
      `${creemApiBase()}/customers/billing`,
      {
        method: "POST",
        headers: {
          "x-api-key": CREEM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reqBody),
      },
    );

    const rawText = await creemResponse.text();
    console.log(
      `[creem-portal] Creem 응답. status=${creemResponse.status} body=`,
      rawText,
    );

    if (!creemResponse.ok) {
      console.error(
        "[creem-portal] Creem API 오류:",
        creemResponse.status,
        rawText,
      );
      return json({ error: "Creem API error", details: rawText }, 502);
    }

    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch (parseErr) {
      console.error("[creem-portal] 응답 JSON 파싱 실패:", parseErr, rawText);
      return json({ error: "Invalid Creem JSON" }, 502);
    }

    // 후보 필드 순회 — 첫 매칭 사용.
    const dataNested = (data.data ?? null) as Record<string, unknown> | null;
    const candidates: unknown[] = [
      data.portal_url,
      data.url,
      data.customer_portal_link,
      data.billing_portal_url,
      dataNested?.portal_url,
      dataNested?.url,
      dataNested?.customer_portal_link,
    ];
    const portalUrl = candidates.find(
      (v): v is string => typeof v === "string" && v.length > 0,
    );

    if (!portalUrl) {
      console.error(
        "[creem-portal] portal URL 후보 모두 누락. 응답 키:",
        Object.keys(data),
        " 전체:",
        data,
      );
      return json({ error: "Invalid Creem response", details: data }, 502);
    }

    console.log(`[creem-portal] portal URL 생성. user=${user.id} url=${portalUrl}`);
    return json({ portalUrl });
  } catch (err) {
    console.error("[creem-portal] 처리 중 오류:", err);
    return json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500,
    );
  }
});
