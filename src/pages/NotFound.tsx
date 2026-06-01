import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Music2 } from "lucide-react";
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
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <Music2
          className="mb-6 h-12 w-12"
          style={{ color: "#D3224E" }}
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <div
          className="font-medium tracking-tight leading-none"
          style={{ fontSize: "96px", color: "#888" }}
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
            className="rounded-md border border-border bg-transparent px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted text-center"
          >
            {t.notFoundPage.playGame}
          </Link>
        </div>
      </main>
    </div>
  );
}
