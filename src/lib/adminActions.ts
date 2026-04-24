import { supabase } from "@/integrations/supabase/client";

export type AdminActionType =
  | "update_role"
  | "grant_premium"
  | "revoke_premium"
  | "adjust_xp"
  | "adjust_streak";

export interface AdminActionBase {
  target_user_id: string;
  reason: string;
}

export interface UpdateRoleParams extends AdminActionBase {
  action_type: "update_role";
  role: "user" | "admin";
}

export interface GrantPremiumParams extends AdminActionBase {
  action_type: "grant_premium";
  until: string;
}

export interface RevokePremiumParams extends AdminActionBase {
  action_type: "revoke_premium";
}

export interface AdjustXpParams extends AdminActionBase {
  action_type: "adjust_xp";
  delta: number;
}

export interface AdjustStreakParams extends AdminActionBase {
  action_type: "adjust_streak";
  current_streak: number;
}

export type AdminActionParams =
  | UpdateRoleParams
  | GrantPremiumParams
  | RevokePremiumParams
  | AdjustXpParams
  | AdjustStreakParams;

export interface AdminActionResult {
  success: boolean;
  details?: Record<string, unknown>;
  warning?: string;
  error?: string;
}

export async function callAdminAction(
  params: AdminActionParams
): Promise<AdminActionResult> {
  const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr || !sessionData.session?.access_token) {
    return {
      success: false,
      error: "세션이 만료되었어요. 다시 로그인 해주세요.",
    };
  }

  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL ||
    (supabase as any).supabaseUrl ||
    "https://rcwydfzkuhfcnnbqjmpp.supabase.co";
  const url = `${supabaseUrl}/functions/v1/admin-action`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
  } catch (err) {
    return {
      success: false,
      error: `네트워크 오류: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let body: any = {};
  try {
    body = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    return {
      success: false,
      error: body?.error ?? `요청 실패 (${res.status})`,
    };
  }

  return {
    success: true,
    details: body?.details,
    warning: body?.warning,
  };
}