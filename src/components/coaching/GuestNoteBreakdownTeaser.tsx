import { Lock } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";

/**
 * 6/01 비가입자 teaser — NoteAnalysisSection이 user 없을 때 노출.
 * 4개 더미 카드(C·D·E·F)를 2x2로 깔고 blur + 잠금 오버레이.
 *
 * 2026-06-22: 결과 다이얼로그의 가입 CTA 단일화 — 이 티저의 가입 버튼·"5 seconds" 문구·
 *   prompt 텍스트를 제거. 가입 진입점은 동일 다이얼로그의 "Nice work" nudge 박스가 단독 책임.
 *   블러+잠금 아이콘 자체로 시각적 유인은 유지.
 */

const DUMMY_NOTES: ReadonlyArray<{ note: string; hint: string }> = [
  { note: "C4", hint: "92%" },
  { note: "D4", hint: "88%" },
  { note: "E4", hint: "needs work" },
  { note: "F4", hint: "needs work" },
];

export function GuestNoteBreakdownTeaser() {
  const t = useT();

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

        {/* 잠금 오버레이 — 버튼·문구 없음, 잠금 아이콘만. pointer-events-none 로 비상호작용. */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-lg pointer-events-none"
          style={{ backgroundColor: "rgba(249, 245, 236, 0.55)" }}
          aria-hidden="true"
        >
          <Lock className="h-[22px] w-[22px]" style={{ color: "#D3224E" }} />
        </div>
      </div>
    </div>
  );
}
