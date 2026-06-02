import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import Seo from "@/components/Seo";
import { useAuth } from "@/contexts/AuthContext";
import { useLang, useT } from "@/contexts/LanguageContext";
import { logger } from "@/lib/sentry";
import { trackEvent } from "@/lib/analytics";

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const t = useT();
  const { lang } = useLang();

  useEffect(() => {
    const transactionId =
      searchParams.get("transaction_id") || searchParams.get("_ptxn") || "unknown";

    logger.info("결제 완료 — Success 페이지 진입", {
      description: "Paddle Checkout 완료 후 redirect 도착",
      user_id: user?.id ?? "(no_user)",
      transaction_id: transactionId,
    });

    trackEvent("subscribe", { transaction_id: transactionId });

    const refreshTimer = setTimeout(() => {
      refreshProfile?.();
    }, 2000);

    const navTimer = setTimeout(() => {
      navigate("/");
    }, 5000);

    return () => {
      clearTimeout(refreshTimer);
      clearTimeout(navTimer);
    };
  }, [navigate, refreshProfile, searchParams, user?.id]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <Seo
        title={t.pageMeta.checkoutSuccess.title}
        description={t.pageMeta.checkoutSuccess.description}
        canonical="https://noteflex.app/checkout/success"
        lang={lang === "ko" ? "ko" : "en"}
        noindex
      />
      <Header
        right={
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t.checkout.backHome}
          </Link>
        }
      />
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
      {/* 성공 애니메이션 */}
      <div className="flex flex-col items-center gap-2 animate-fade-up">
        <div className="w-20 h-20 rounded-full bg-green-100 border-4 border-green-500 flex items-center justify-center text-4xl animate-bounce">
          ✓
        </div>
        <span className="text-4xl mt-2">🎉</span>
      </div>

      {/* 메시지 */}
      <div className="flex flex-col items-center gap-2 text-center max-w-md animate-fade-up" style={{ animationDelay: "0.2s" }}>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          {t.checkout.success.title}
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {t.checkout.success.subtitle}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {t.checkout.success.receiptNote}
        </p>
      </div>

      {/* 혜택 안내 */}
      <div className="flex flex-col gap-2 p-4 rounded-2xl bg-card border border-border shadow-sm max-w-md w-full animate-fade-up" style={{ animationDelay: "0.4s" }}>
        <p className="text-sm font-semibold text-foreground mb-1">
          {t.checkout.success.benefitsHeading}
        </p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {t.checkout.success.benefits.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 버튼 */}
      <Link
        to="/"
        className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 animate-fade-up"
        style={{ animationDelay: "0.6s" }}
      >
        {t.checkout.success.startCta}
      </Link>

      <p className="text-xs text-muted-foreground animate-fade-up" style={{ animationDelay: "0.8s" }}>
        {t.checkout.success.autoRedirect}
      </p>
      </div>
    </div>
  );
}
