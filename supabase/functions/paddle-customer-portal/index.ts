import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PADDLE_API_KEY = Deno.env.get("PADDLE_API_KEY")!;
const PADDLE_ENVIRONMENT = Deno.env.get("PADDLE_ENVIRONMENT") ?? "sandbox";

const PADDLE_API_BASE =
  PADDLE_ENVIRONMENT === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";

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
    // 1. 사용자 인증 확인
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
      console.error("[customer-portal] 인증 실패:", authError);
      return json({ error: "Invalid token" }, 401);
    }

    // 2. paddle_customer_id 조회
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("paddle_customer_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.paddle_customer_id) {
      console.error("[customer-portal] paddle_customer_id 누락:", profileError);
      return json({ error: "Paddle customer not found" }, 404);
    }

    // 3. Paddle API 호출 — portal session 생성
    const paddleResponse = await fetch(
      `${PADDLE_API_BASE}/customers/${profile.paddle_customer_id}/portal-sessions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PADDLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    if (!paddleResponse.ok) {
      const errText = await paddleResponse.text();
      console.error("[customer-portal] Paddle API 오류:", paddleResponse.status, errText);
      return json({ error: "Paddle API error", details: errText }, 502);
    }

    const paddleData = await paddleResponse.json();
    const portalUrl = paddleData?.data?.urls?.general?.overview;

    if (!portalUrl) {
      console.error("[customer-portal] portal URL 응답 형식 이상:", paddleData);
      return json({ error: "Invalid Paddle response" }, 502);
    }

    console.log(`[customer-portal] portal URL 생성. user=${user.id}`);
    return json({ portalUrl });
  } catch (err) {
    console.error("[customer-portal] 처리 중 오류:", err);
    return json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500
    );
  }
});
