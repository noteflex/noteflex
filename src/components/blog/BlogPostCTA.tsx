import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useT } from "@/contexts/LanguageContext";

export default function BlogPostCTA() {
  const t = useT();
  const { mains, subs, buttonLabel } = t.blogCta;
  const idx = useMemo(
    () => Math.floor(Math.random() * mains.length),
    [mains.length],
  );
  const main = mains[idx];
  const sub = subs[idx];

  return (
    <aside className="rounded-lg border-[1.5px] border-[#D3224E] bg-white px-7 py-8 text-center shadow-sm">
      <div className="flex justify-center mb-4">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#D3224E"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-12 h-12"
          aria-hidden="true"
        >
          <circle cx="6" cy="17" r="3" />
          <circle cx="16" cy="17" r="3" />
          <path d="M9 17V4h10v13" />
          <path d="M9 8h10" />
        </svg>
      </div>
      <p className="text-[18px] font-medium text-neutral-900 leading-snug">
        {main}
      </p>
      {sub && (
        <p className="mt-1 text-sm text-neutral-500 leading-snug">{sub}</p>
      )}
      <Link
        to="/play"
        className="mt-5 inline-block rounded-md bg-[#D3224E] px-6 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
      >
        {buttonLabel}
      </Link>
    </aside>
  );
}
