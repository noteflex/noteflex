import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useT } from "@/contexts/LanguageContext";

export function UpdateBanner() {
  const [updateFn, setUpdateFn] = useState<(() => void) | null>(null);
  const location = useLocation();
  const t = useT();

  // /play 경로에서 배너·reload 전부 억제 (게임 카운트다운·sync 보호)
  const isGameRoute = location.pathname === "/play";

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ update: () => void }>).detail;
      setUpdateFn(() => detail.update);
    };
    window.addEventListener("pwa-update-ready", handler);
    return () => window.removeEventListener("pwa-update-ready", handler);
  }, []);

  if (!updateFn || isGameRoute) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="flex items-center gap-3 px-4 py-3 bg-foreground text-background rounded-xl shadow-lg pointer-events-auto">
        <span className="text-sm">{t.updateBanner.message}</span>
        <button
          onClick={updateFn}
          className="text-sm font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          {t.updateBanner.action}
        </button>
      </div>
    </div>
  );
}
