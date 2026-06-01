import { useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";
import FeedbackDialog from "./FeedbackDialog";

/**
 * 사용자 피드백 FAB — 우하단 fixed.
 * 메모리 #20(광고 정책)·#17(게임 동기화)·#25(디자인) 정합.
 *
 * 제외 라우트(noise·UX 보호):
 *   /play             게임 활성 화면 — 카운트다운·동기화 방해 회피
 *   /pricing          결제 시작점
 *   /checkout/*       결제 진행
 *   /reset-password   인증 핵심 흐름
 *   /auth/*           OAuth 콜백
 *   /reviewer-login   심사관 액세스
 *   /terms · /privacy · /refund · /cookies · /business-info  약관 정독
 */
const EXCLUDED_PREFIXES = [
  "/play",
  "/pricing",
  "/checkout",
  "/reset-password",
  "/auth",
  "/reviewer-login",
  "/terms",
  "/privacy",
  "/refund",
  "/cookies",
  "/business-info",
] as const;

function isExcluded(pathname: string): boolean {
  return EXCLUDED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export default function FeedbackFab() {
  const { pathname } = useLocation();
  const t = useT();
  const [open, setOpen] = useState(false);

  if (isExcluded(pathname)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.feedback.fabAriaLabel}
        className="fixed right-4 z-40 flex items-center gap-1.5 rounded-full bg-[#D3224E] px-5 py-3 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105 active:scale-95 sm:right-6"
        style={{
          // safe-area-inset-bottom (iPhone 홈 인디케이터·Android nav bar 회피)
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        }}
        data-testid="feedback-fab"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{t.feedback.fabLabel}</span>
      </button>

      <FeedbackDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
