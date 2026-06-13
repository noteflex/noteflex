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
    const creemResponse = await fetch(
      `${creemApiBase()}/customers/billing`,
      {
        method: "POST",
        headers: {
          "x-api-key": CREEM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customer_id: profile.paddle_customer_id }),
      },
    );

    if (!creemResponse.ok) {
      const errText = await creemResponse.text();
      console.error(
        "[creem-portal] Creem API 오류:",
        creemResponse.status,
        errText,
      );
      return json({ error: "Creem API error", details: errText }, 502);
    }

    const data = await creemResponse.json();
    const portalUrl = data?.portal_url;
    if (!portalUrl || typeof portalUrl !== "string") {
      console.error("[creem-portal] portal_url 응답 없음:", data);
      return json({ error: "Invalid Creem response" }, 502);
    }

    console.log(`[creem-portal] portal URL 생성. user=${user.id}`);
    return json({ portalUrl });
  } catch (err) {
    console.error("[creem-portal] 처리 중 오류:", err);
    return json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500,
    );
  }
});
