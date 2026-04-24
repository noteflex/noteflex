// supabase/functions/admin-action/index.ts
//
// 관리자 액션 처리용 Edge Function
// - 호출자 role 검증 (admin만 허용)
// - service_role로 DB 수정
// - admin_actions 테이블에 자동 로깅
//
// 지원 action_type:
//   update_role       { role: 'user' | 'admin', reason }
//   grant_premium     { until: ISO date string, reason }
//   revoke_premium    { reason }
//   adjust_xp         { delta: number, reason }
//   adjust_streak     { current_streak: number, reason }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ActionType =
  | "update_role"
  | "grant_premium"
  | "revoke_premium"
  | "adjust_xp"
  | "adjust_streak";

interface ReqBody {
  action_type: ActionType;
  target_user_id: string;
  reason: string;
  // 액션별 추가 파라미터
  role?: "user" | "admin";
  until?: string;
  delta?: number;
  current_streak?: number;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json(500, { error: "Server not configured" });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json(401, { error: "Missing Authorization header" });
    }

    // 1) 호출자 식별: service_role 클라이언트로 토큰을 직접 검증
    //    (ES256 JWT 환경에서 global headers 방식이 실패하는 이슈 회피)
    const adminClient = createClient(supabaseUrl, serviceKey);

    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    const {
      data: { user: caller },
      error: userErr,
    } = await adminClient.auth.getUser(accessToken);

    if (userErr || !caller) {
      return json(401, {
        error: `Invalid token${userErr ? `: ${userErr.message}` : ""}`,
      });
    }

    // 2) 호출자가 admin인지 확인
    const { data: callerProfile, error: profErr } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    if (profErr) {
      return json(500, { error: `Profile lookup failed: ${profErr.message}` });
    }
    if (!callerProfile || callerProfile.role !== "admin") {
      return json(403, { error: "Admin only" });
    }

    // 3) 요청 본문 파싱
    let body: ReqBody;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const { action_type, target_user_id, reason } = body;

    if (!action_type || !target_user_id || !reason) {
      return json(400, {
        error: "action_type, target_user_id, reason are required",
      });
    }
    if (!reason.trim() || reason.trim().length < 3) {
      return json(400, { error: "reason must be at least 3 characters" });
    }

    // 자기 자신에게 role 변경 방지 (관리자가 스스로 강등하거나 승격하는 걸 막음)
    if (action_type === "update_role" && target_user_id === caller.id) {
      return json(400, { error: "Cannot change your own role" });
    }

    // 대상 프로필 미리 로드 (변경 전 값 로깅용)
    const { data: targetProfile, error: targetErr } = await adminClient
      .from("profiles")
      .select("role, is_premium, premium_until, total_xp, current_streak, email")
      .eq("id", target_user_id)
      .maybeSingle();

    if (targetErr) {
      return json(500, { error: `Target lookup failed: ${targetErr.message}` });
    }
    if (!targetProfile) {
      return json(404, { error: "Target user not found" });
    }

    let updatePayload: Record<string, unknown> = {};
    const logDetails: Record<string, unknown> = {
      reason,
      before: {},
      after: {},
    };

    // 4) action_type별 처리
    switch (action_type) {
      case "update_role": {
        if (body.role !== "user" && body.role !== "admin") {
          return json(400, { error: "role must be 'user' or 'admin'" });
        }
        updatePayload = { role: body.role };
        (logDetails.before as any).role = targetProfile.role;
        (logDetails.after as any).role = body.role;
        break;
      }

      case "grant_premium": {
        if (!body.until) {
          return json(400, { error: "until (ISO date) is required" });
        }
        const untilDate = new Date(body.until);
        if (isNaN(untilDate.getTime())) {
          return json(400, { error: "until is not a valid date" });
        }
        if (untilDate.getTime() <= Date.now()) {
          return json(400, { error: "until must be in the future" });
        }
        updatePayload = {
          is_premium: true,
          premium_until: untilDate.toISOString(),
        };
        (logDetails.before as any).is_premium = targetProfile.is_premium;
        (logDetails.before as any).premium_until = targetProfile.premium_until;
        (logDetails.after as any).is_premium = true;
        (logDetails.after as any).premium_until = untilDate.toISOString();
        break;
      }

      case "revoke_premium": {
        updatePayload = { is_premium: false, premium_until: null };
        (logDetails.before as any).is_premium = targetProfile.is_premium;
        (logDetails.before as any).premium_until = targetProfile.premium_until;
        (logDetails.after as any).is_premium = false;
        (logDetails.after as any).premium_until = null;
        break;
      }

      case "adjust_xp": {
        if (typeof body.delta !== "number" || !Number.isFinite(body.delta)) {
          return json(400, { error: "delta (number) is required" });
        }
        const currentXp = Number(targetProfile.total_xp ?? 0);
        const newXp = Math.max(0, currentXp + body.delta);
        updatePayload = { total_xp: newXp };
        (logDetails.before as any).total_xp = currentXp;
        (logDetails.after as any).total_xp = newXp;
        (logDetails as any).delta = body.delta;
        break;
      }

      case "adjust_streak": {
        if (
          typeof body.current_streak !== "number" ||
          body.current_streak < 0 ||
          !Number.isInteger(body.current_streak)
        ) {
          return json(400, {
            error: "current_streak must be a non-negative integer",
          });
        }
        updatePayload = { current_streak: body.current_streak };
        (logDetails.before as any).current_streak = targetProfile.current_streak;
        (logDetails.after as any).current_streak = body.current_streak;
        // user_streaks 테이블도 동기화
        await adminClient
          .from("user_streaks")
          .update({ current_streak: body.current_streak })
          .eq("user_id", target_user_id);
        break;
      }

      default:
        return json(400, { error: "Unknown action_type" });
    }

    // 5) profiles 업데이트
    const { error: updateErr } = await adminClient
      .from("profiles")
      .update(updatePayload)
      .eq("id", target_user_id);

    if (updateErr) {
      return json(500, { error: `Update failed: ${updateErr.message}` });
    }

    // 6) admin_actions 로깅
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
    const userAgent = req.headers.get("user-agent") ?? null;

    // DB CHECK 제약에 맞게 action_type 매핑
    //   update_role   -> update_profile
    //   adjust_xp     -> grant_xp
    //   adjust_streak -> reset_streak
    //   나머지(grant_premium, revoke_premium)는 동일
    const logActionType: Record<ActionType, string> = {
      update_role: "update_profile",
      grant_premium: "grant_premium",
      revoke_premium: "revoke_premium",
      adjust_xp: "grant_xp",
      adjust_streak: "reset_streak",
    };

    // 원래 요청한 action_type도 details에 함께 남겨서 추적 용이하게
    (logDetails as any).requested_action = action_type;

    const { error: logErr } = await adminClient.from("admin_actions").insert({
      admin_id: caller.id,
      action_type: logActionType[action_type],
      target_user_id,
      details: logDetails,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (logErr) {
      // 로깅 실패해도 이미 DB 변경은 반영됨 — 경고 포함해 반환
      return json(200, {
        success: true,
        warning: `Action applied but logging failed: ${logErr.message}`,
      });
    }

    return json(200, { success: true, details: logDetails });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json(500, { error: `Unexpected error: ${msg}` });
  }
});