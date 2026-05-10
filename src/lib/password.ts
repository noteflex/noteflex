export interface PasswordChecks {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  digit: boolean;
  special: boolean;
}

export function analyzePassword(pw: string): { score: number; checks: PasswordChecks } {
  const checks: PasswordChecks = {
    length:    pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    digit:     /[0-9]/.test(pw),
    special:   /[^A-Za-z0-9]/.test(pw),
  };
  return { score: Object.values(checks).filter(Boolean).length, checks };
}

export const STRENGTH_LABEL  = ["", "약함", "보통", "강함", "강함", "매우 강함"] as const;
export const STRENGTH_BAR_CL = ["", "bg-red-500", "bg-yellow-400", "bg-blue-400", "bg-blue-500", "bg-green-500"] as const;
export const STRENGTH_TXT_CL = ["", "text-red-500", "text-yellow-500", "text-blue-400", "text-blue-500", "text-green-500"] as const;
