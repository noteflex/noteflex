// src/components/CookieBanner.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "noteflex-cookie-consent";

type ConsentState = "accepted" | "rejected" | null;

export default function CookieBanner() {
  const [consent, setConsent] = useState<ConsentState>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ConsentState;
      setConsent(stored ?? null);
    } catch {
      setConsent(null);
    }
    setHydrated(true);
  }, []);

  const handleChoice = (choice: "accepted" | "rejected") => {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* ignore */
    }
    setConsent(choice);
  };

  if (!hydrated || consent !== null) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t border-border shadow-lg">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <p className="text-sm text-foreground/90 leading-relaxed">
          Noteflex는 서비스 개선과 분석을 위해 쿠키를 사용합니다. 자세한 내용은{" "}
          <Link to="/cookies" className="underline text-primary hover:text-primary/80">
            쿠키 정책
          </Link>
          을 확인해 주세요.
        </p>
        <div className="flex gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => handleChoice("rejected")}
            className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            거부
          </button>
          <button
            onClick={() => handleChoice("accepted")}
            className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            동의
          </button>
        </div>
      </div>
    </div>
  );
}