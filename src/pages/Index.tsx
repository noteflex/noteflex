import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { initSound } from "@/lib/sound";
import AuthModal from "@/components/AuthModal";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { GAME_ENABLED } from "@/lib/featureFlags";

function ComingSoonNotice() {
  const t = useT();
  const [bodyBefore, bodyAfter] = t.comingSoon.body.split("{email}");
  const email = "contact@noteflex.app";
  return (
    <div
      className="flex flex-col items-center gap-4 animate-fade-up"
      style={{ animationDelay: "0.15s" }}
    >
      <div className="px-8 py-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 font-semibold text-lg shadow-md">
        {t.comingSoon.badge}
      </div>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {bodyBefore}
        <a
          href={`mailto:${email}?subject=Noteflex%20Launch%20Notification`}
          className="text-primary underline hover:text-primary/80"
        >
          {email}
        </a>
        {bodyAfter}
      </p>
    </div>
  );
}

export default function Index() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const t = useT();
  const navigate = useNavigate();

  const [showAuth, setShowAuth] = useState(false);

  const handleStart = async () => {
    initSound().catch(() => {});
    navigate("/play", { state: { fromNav: true } });
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const pageHeaderRight = GAME_ENABLED && !authLoading ? (
    user ? (
      <div className="flex items-center gap-3">
        {profile?.role !== "admin" && (
          <Link
            to="/dashboard"
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {t.header.dashboard}
          </Link>
        )}
        <Link
          to="/profile"
          className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {t.header.profile}
        </Link>
        <span className="text-xs text-muted-foreground truncate max-w-[150px]">{user.email}</span>
        <button
          onClick={handleSignOut}
          className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {t.header.signOut}
        </button>
      </div>
    ) : (
      <button
        onClick={() => setShowAuth(true)}
        className="text-xs px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
      >
        {t.header.signIn}
      </button>
    )
  ) : null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
    >
      <Header right={pageHeaderRight} />
      {showAuth && GAME_ENABLED && <AuthModal onClose={() => setShowAuth(false)} />}

      <div className="safe-area-page flex-1 flex flex-col items-center justify-center px-4">
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-semibold text-foreground text-center tracking-tight leading-tight whitespace-pre-line animate-fade-up"
        >
          {t.hero.title}
        </h1>
        <p
          className="text-lg sm:text-xl font-normal text-muted-foreground text-center mt-6 animate-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          {t.hero.subtitle}
        </p>
        {GAME_ENABLED ? (
          <button
            onClick={handleStart}
            className="mt-10 px-10 py-4 rounded-full bg-primary text-primary-foreground font-medium text-lg shadow hover:shadow-md hover:scale-[1.02] transition-all duration-150 active:scale-[0.98] animate-fade-up"
            style={{ animationDelay: "0.4s" }}
          >
            {t.game.start}
          </button>
        ) : (
          <div className="mt-12 animate-fade-up" style={{ animationDelay: "0.4s" }}>
            <ComingSoonNotice />
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
