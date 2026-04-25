import { useState, useCallback } from "react";
import type { SolfegeSystem } from "@/lib/solfege";
import { detectSolfegeFromLocale } from "@/lib/solfege";

const STORAGE_KEY = "noteflex.solfege_system";

export function useSolfegeSystem() {
  const [system, setSystemState] = useState<SolfegeSystem>(() => {
    if (typeof window === "undefined") return "en";
    const saved = localStorage.getItem(STORAGE_KEY) as SolfegeSystem | null;
    if (saved === "ko" || saved === "en" || saved === "latin") return saved;
    return detectSolfegeFromLocale();
  });

  const setSystem = useCallback((next: SolfegeSystem) => {
    setSystemState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage 실패 시 상태만 유지 (사파리 private mode 등)
    }
  }, []);

  return { system, setSystem };
}
