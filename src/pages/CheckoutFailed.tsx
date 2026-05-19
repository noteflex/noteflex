import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import { useT } from "@/contexts/LanguageContext";

export default function CheckoutFailed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reason = searchParams.get("reason");
  const t = useT();

  const isCancelled = reason === "cancelled";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-muted/30 via-background to-muted/20">
      <Header
        right={
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t.checkout.backHome}
          </Link>
        }
      />
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
      {/* 아이콘 */}
      <div className="flex flex-col items-center gap-2 animate-fade-up">
        <div className="w-20 h-20 rounded-full bg-orange-100 border-4 border-orange-400 flex items-center justify-center text-4xl">
          {isCancelled ? "⏸" : "⚠️"}
        </div>
      </div>

      {/* 메시지 */}
      <div
        className="flex flex-col items-center gap-2 text-center max-w-md animate-fade-up"
        style={{ animationDelay: "0.2s" }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          {isCancelled ? t.checkout.failed.cancelledTitle : t.checkout.failed.failedTitle}
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {isCancelled ? t.checkout.failed.cancelledSubtitle : t.checkout.failed.failedSubtitle}
        </p>
      </div>

      {/* 원인/해결 안내 */}
      {!isCancelled && (
        <div
          className="flex flex-col gap-2 p-4 rounded-2xl bg-card border border-border shadow-sm max-w-md w-full animate-fade-up"
          style={{ animationDelay: "0.4s" }}
        >
          <p className="text-sm font-semibold text-foreground mb-1">
            {t.checkout.failed.checkHeading}
          </p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {t.checkout.failed.checkItems.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 버튼 */}
      <div
        className="flex flex-col gap-2 w-full max-w-md animate-fade-up"
        style={{ animationDelay: "0.6s" }}
      >
        <Link
          to="/pricing"
          className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 text-center"
        >
          {t.checkout.failed.retryCta}
        </Link>
        <button
          onClick={() => navigate("/")}
          className="px-8 py-3 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-muted transition-colors"
        >
          {t.checkout.failed.homeCta}
        </button>
      </div>

      {/* 문의 안내 */}
      <p
        className="text-xs text-muted-foreground text-center animate-fade-up"
        style={{ animationDelay: "0.8s" }}
      >
        {t.checkout.failed.supportPrefix}
        <a
          href="mailto:support@noteflex.app"
          className="text-primary underline hover:text-primary/80"
        >
          support@noteflex.app
        </a>
        {t.checkout.failed.supportSuffix}
      </p>
      </div>
    </div>
  );
}
