import { useState } from "react";
import { Lock } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";
import AuthModal from "@/components/AuthModal";

/**
 * 6/01 비가입자 teaser — NoteAnalysisSection이 user 없을 때 노출.
 * 4개 더미 카드(C·D·E·F)를 2x2로 깔고 blur + 잠금 오버레이 + 가입 CTA.
 * CTA 클릭 → 로컬 AuthModal 마운트 (Radix Portal로 결과 다이얼로그 위에 stack).
 *
 * 메모리 정합:
 *   #25 (스티브잡스 디자인) — compact·세련 톤 유지
 *   #27 (전환 자연스러움) — DOM 트리 변화 없음, AuthModal portal stacking
 */

const DUMMY_NOTES: ReadonlyArray<{ note: string; hint: string }> = [
  { note: "C4", hint: "92%" },
  { note: "D4", hint: "88%" },
  { note: "E4", hint: "needs work" },
  { note: "F4", hint: "needs work" },
];

export function GuestNoteBreakdownTeaser() {
  const t = useT();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div data-testid="note-analysis-guest-teaser">
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
        {t.gameDialogs.guestTeaserTitle}
      </h3>

      <div className="relative min-h-[130px]">
        {/* 블러된 더미 카드 그리드 (콘텐츠 단서) */}
        <div
          className="grid grid-cols-2 gap-1.5 select-none pointer-events-none"
          style={{ filter: "blur(3.5px)" }}
          aria-hidden="true"
        >
          {DUMMY_NOTES.map((d) => (
            <div
              key={d.note}
              className="rounded-lg bg-white border px-3 py-2.5"
              style={{ borderColor: "rgba(0,0,0,0.08)", borderWidth: "0.5px" }}
            >
              <div className="text-[13px] font-medium text-neutral-900">
                {d.note}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {d.hint}
              </div>
            </div>
          ))}
        </div>

        {/* 잠금 오버레이 + CTA */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-lg"
          style={{ backgroundColor: "rgba(249, 245, 236, 0.55)" }}
        >
          <Lock className="h-[22px] w-[22px]" style={{ color: "#D3224E" }} aria-hidden="true" />
          <p className="text-[13px] font-medium text-center px-2" style={{ color: "#1A1A1A" }}>
            {t.gameDialogs.guestTeaserPrompt}
          </p>
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="rounded-lg text-white text-[12px] font-medium px-[18px] py-2 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#D3224E" }}
            data-testid="guest-teaser-cta"
          >
            {t.gameDialogs.guestTeaserCta}
          </button>
        </div>
      </div>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
