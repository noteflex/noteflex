import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/Header";
import { useT } from "@/contexts/LanguageContext";

export default function NotFound() {
  const location = useLocation();
  const t = useT();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div
      className="flex flex-col min-h-[100dvh]"
      style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
    >
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#D3224E"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mb-6 w-16 h-16"
          aria-hidden="true"
        >
          <circle cx="6" cy="17" r="3" />
          <circle cx="16" cy="17" r="3" />
          <path d="M9 17V4h10v13" />
          <path d="M9 8h10" />
        </svg>
        <div
          className="font-medium tracking-tight leading-none"
          style={{ fontSize: "96px", color: "rgba(211, 34, 78, 0.35)" }}
          aria-label="404"
        >
          404
        </div>
        <h1 className="mt-6 text-xl font-medium text-foreground">
          {t.notFoundPage.headline}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t.notFoundPage.body}
        </p>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:gap-3 w-full max-w-xs sm:max-w-none sm:w-auto">
          <Link
            to="/"
            className="rounded-md px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 text-center"
            style={{ backgroundColor: "#D3224E" }}
          >
            {t.notFoundPage.backHome}
          </Link>
          <Link
            to="/play"
            className="rounded-md border px-6 py-3 text-sm font-medium transition-colors text-center hover:bg-[#FFF5F7]"
            style={{ borderColor: "#D3224E", color: "#D3224E" }}
          >
            {t.notFoundPage.playGame}
          </Link>
        </div>
      </main>
    </div>
  );
}
