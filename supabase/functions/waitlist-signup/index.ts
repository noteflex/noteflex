// supabase/functions/waitlist-signup/index.ts
//
// premium_waitlist 등록 Edge Function.
// 클라이언트(Pricing.tsx)에서 email·locale·source 전달.
// service_role로 INSERT ON CONFLICT DO NOTHING — 중복 이메일은 에러 아닌 성공.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ReqBody {
  email?: unknown;
  locale?: unknown;
  source?: unknown;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function asTrimmedString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0) return null;
  return t.slice(0, max);
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

  const emailRaw = asTrimmedString(body.email, 320);
  if (!emailRaw || !isEmail(emailRaw)) {
    return json(400, { error: "invalid email" });
  }
  const email = emailRaw.toLowerCase();
  const locale = asTrimmedString(body.locale, 16) ?? "en";
  const source = asTrimmedString(body.source, 64) ?? "pricing";

  const admin = createClient(supabaseUrl, serviceKey);
  const { error } = await admin
    .from("premium_waitlist")
    .upsert({ email, locale, source }, { onConflict: "email", ignoreDuplicates: true });

  if (error) {
    return json(500, { error: `Insert failed: ${error.message}` });
  }
  return json(200, { success: true });
});
