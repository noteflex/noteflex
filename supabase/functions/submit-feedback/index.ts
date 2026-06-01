// supabase/functions/submit-feedback/index.ts
//
// 사용자 피드백 수집 Edge Function.
// 클라이언트(FeedbackDialog)에서 message·email·page_url·locale·user_id 전달.
// 서버에서 request headers로 ip_address·country·user_agent 자동 수집 후 INSERT.
// (클라이언트 spoofing 방지 목적으로 IP·country는 서버 헤더에서만 추출.)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ReqBody {
  message?: unknown;
  email?: unknown;
  user_id?: unknown;
  page_url?: unknown;
  locale?: unknown;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractIp(req: Request): string | null {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf && cf.trim()) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff && xff.trim()) return xff.split(",")[0]!.trim();
  const xri = req.headers.get("x-real-ip");
  if (xri && xri.trim()) return xri.trim();
  return null;
}

function extractCountry(req: Request): string | null {
  const cf = req.headers.get("cf-ipcountry");
  if (cf && cf.trim() && cf !== "XX") return cf.trim().toUpperCase();
  const vercel = req.headers.get("x-vercel-ip-country");
  if (vercel && vercel.trim()) return vercel.trim().toUpperCase();
  return null;
}

function asTrimmedString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0) return null;
  return t.slice(0, max);
}

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Server not configured" });
  }

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const message =
    typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < 5) {
    return json(400, { error: "message too short" });
  }
  if (message.length > 500) {
    return json(400, { error: "message too long" });
  }

  const email = asTrimmedString(body.email, 320);
  if (email && !isEmail(email)) {
    return json(400, { error: "invalid email format" });
  }

  const user_id = isUuid(body.user_id) ? body.user_id : null;
  const page_url = asTrimmedString(body.page_url, 2048);
  const locale = asTrimmedString(body.locale, 16);

  const ip_address = extractIp(req);
  const country = extractCountry(req);
  const user_agent = asTrimmedString(req.headers.get("user-agent"), 1024);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin
    .from("feedback")
    .insert({
      message,
      email,
      user_id,
      ip_address,
      country,
      user_agent,
      page_url,
      locale,
    })
    .select("id")
    .single();

  if (error) {
    return json(500, { error: `Insert failed: ${error.message}` });
  }
  return json(200, { success: true, id: data?.id });
});
