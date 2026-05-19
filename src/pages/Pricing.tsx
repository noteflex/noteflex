import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { getUserTier } from "@/lib/subscriptionTier";
import { PaymentErrorBoundary } from "@/components/PaymentErrorBoundary";
import { openCheckout, PADDLE_PRICES, getPaddleLocale } from "@/lib/paddle";
import { logger } from "@/lib/sentry";

// ── 다국어 콘텐츠 (ja·zh = en fallback, Phase 3에서 정식 번역 예정) ──────
const CONTENT = {
  ko: {
    heroTitle: "Noteflex 요금제",
    heroSub: "무료로 시작하고, 준비됐을 때 업그레이드하세요.",
    freeName: "Free",
    freePrice: "$0",
    freePriceSub: "영원히 무료",
    freeDesc: "핵심 기능, 평생 무료",
    moName: "Premium",
    moPrice: "$2.99",
    moPriceSub: "/월",
    moBadge: "Most Popular",
    moDesc: "악보가 음악으로 보이는 순간까지",
    yrName: "Premium",
    yrPrice: "$24.99",
    yrPriceSub: "/년",
    yrBadge: "Save 30%",
    yrDesc: "1년 약속, 30% 절약",
    freeFeatures: [
      "Level 1~5 서브레벨 1 순차 해금",
      "7회/일 세션 한도",
      "기록 대시보드",
      "기본 연습 통계",
    ],
    premiumFeatures: [
      "Level 1~7 모든 레벨, 서브레벨까지 전부 해제",
      "광고 없는 몰입 — 오직 음악에만",
      "AI 학습 코치 — 일·주·월 분석으로 약점 발견",
      "약점 음표 집중 훈련 — 못 읽는 음표만 골라서",
      "무제한 플레이 — 멈출 이유 없음",
      "기록 대시보드 + 자세한 통계",
      "새 기능 우선 이용 — 항상 한 걸음 앞서",
    ],
    currentPlan: "현재 플랜",
    alreadyPremium: "이미 프리미엄 이용 중",
    startFree: "무료로 시작하기",
    upgradeMo: "월간 구독 시작",
    upgradeYr: "연간 구독 시작",
    signupFirst: "회원가입 후 시작",
    compareTitle: "플랜 비교",
    compareHeaders: ["기능", "비가입", "Free", "Premium"],
    compareRows: [
      ["일일 연습 횟수", "3회", "7회", "무제한"],
      ["이용 가능 레벨", "맛보기", "기초", "전체"],
      ["약점 음표 분석", "—", "—", "✓"],
      ["AI 학습 코치", "—", "—", "✓"],
      ["광고", "있음", "있음", "없음"],
      ["기록·통계", "기본", "기본", "자세히"],
      ["신기능 우선 이용", "—", "—", "우선"],
    ],
    faqTitle: "자주 묻는 질문",
    faqMore: "자주 묻는 질문 전체 보기 →",
    faqs: [
      {
        q: "언제든 취소할 수 있나요?",
        a: "네, 구독 기간 중 언제든 취소할 수 있습니다. 취소 후에도 남은 기간은 계속 이용하실 수 있습니다.",
      },
      {
        q: "환불 정책이 궁금해요.",
        a: "결제 후 14일 이내 요청 시 전액 환불해 드립니다. 자세한 내용은 환불 정책 페이지를 확인해 주세요.",
      },
    ],
    securedBy: "결제는 Paddle이 안전하게 처리합니다",
    refundPolicy: "환불 정책",
    cancelNote: "언제든 취소 가능 · 자동 갱신 · 이메일 영수증",
    backHome: "← 홈으로",
  },
  en: {
    heroTitle: "Noteflex Pricing",
    heroSub: "Start free. Upgrade when you're ready.",
    freeName: "Free",
    freePrice: "$0",
    freePriceSub: "forever",
    freeDesc: "Core features. No credit card. Forever.",
    moName: "Premium",
    moPrice: "$2.99",
    moPriceSub: "/mo",
    moBadge: "Most Popular",
    moDesc: "Until the notes become music.",
    yrName: "Premium",
    yrPrice: "$24.99",
    yrPriceSub: "/yr",
    yrBadge: "Save 30%",
    yrDesc: "One year. 30% off. Done.",
    freeFeatures: [
      "Level 1–5 Sub1 sequential unlock",
      "7 sessions/day limit",
      "Performance dashboard",
      "Basic practice stats",
    ],
    premiumFeatures: [
      "All levels 1–7, every sublevel unlocked",
      "Ad-free focus — just music",
      "AI learning coach — daily, weekly, monthly insights",
      "Targeted practice on weak notes — only what you need",
      "Unlimited play — no reason to stop",
      "Performance dashboard with detailed stats",
      "Early access to new features — always one step ahead",
    ],
    currentPlan: "Current Plan",
    alreadyPremium: "Already on Premium",
    startFree: "Get Started Free",
    upgradeMo: "Start Monthly",
    upgradeYr: "Start Annual",
    signupFirst: "Sign Up to Start",
    compareTitle: "Plan Comparison",
    compareHeaders: ["Feature", "Guest", "Free", "Premium"],
    compareRows: [
      ["Daily sessions", "3", "7", "Unlimited"],
      ["Levels", "Taste", "Basics", "Everything"],
      ["Weak-note analysis", "—", "—", "✓"],
      ["AI learning coach", "—", "—", "✓"],
      ["Ads", "Yes", "Yes", "None"],
      ["Stats", "Basic", "Basic", "Detailed"],
      ["Early access", "—", "—", "First"],
    ],
    faqTitle: "Frequently Asked Questions",
    faqMore: "See all FAQs →",
    faqs: [
      {
        q: "Can I cancel anytime?",
        a: "Yes. You can cancel at any time. Access continues through the end of the current billing period.",
      },
      {
        q: "What is the refund policy?",
        a: "You may request a full refund within 14 days of purchase. See the Refund Policy page for details.",
      },
    ],
    securedBy: "Payments secured by Paddle",
    refundPolicy: "Refund Policy",
    cancelNote: "Cancel anytime · Auto-renews · Email receipt",
    backHome: "← Home",
  },
} as const;

export default function Pricing() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLang();
  const c = CONTENT[lang === "ko" ? "ko" : "en"];
  const tier = getUserTier(user ?? null, profile ?? null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const handleCta = async (plan: "free" | "monthly" | "yearly") => {
    if (tier === "pro") return;
    if (plan === "free" && tier !== "guest") return; // Free 가입자는 현재 플랜
    if (tier === "guest") {
      navigate("/signup");
      return;
    }
    // Free 가입자 → Paddle Checkout 호출
    if (plan === "monthly" || plan === "yearly") {
      const priceId = PADDLE_PRICES[plan];
      if (!priceId) {
        logger.error("Paddle Price ID 누락", new Error("Missing price ID"), {
          description: "환경변수에 Price ID가 박지 X",
          cause: `VITE_PADDLE_PRICE_${plan.toUpperCase()} 누락`,
          impact: "결제 진행 불가",
          action: "Vercel 환경변수 영역 확인 필요",
          metadata: { plan },
        });
        return;
      }
      if (!user?.email) {
        logger.warn("결제 불가 — 이메일 정보 없음", {
          user_id: user?.id,
          plan,
        });
        return;
      }

      try {
        setIsCheckoutLoading(true);
        logger.info("결제 시작", {
          description: `Paddle Checkout 호출 (${plan})`,
          user_id: user.id,
          plan,
        });
        await openCheckout({
          plan,
          userEmail: user.email,
          userId: user.id,
          locale: getPaddleLocale(lang),
        });
      } catch (err) {
        logger.error("결제 진행 실패", err, {
          description: "openCheckout 호출 실패",
          cause: err instanceof Error ? err.message : String(err),
          impact: "사용자가 결제 진행 불가",
          action: "Paddle SDK 로드 확인, Price ID 유효성 확인",
          metadata: { plan, user_id: user.id },
        });
      } finally {
        setIsCheckoutLoading(false);
      }
    }
  };

  const freeCtaLabel =
    tier === "pro"
      ? c.alreadyPremium
      : tier === "free"
      ? c.currentPlan
      : c.startFree;

  const moCtaLabel =
    tier === "pro" ? c.alreadyPremium : tier === "guest" ? c.signupFirst : c.upgradeMo;

  const yrCtaLabel =
    tier === "pro" ? c.alreadyPremium : tier === "guest" ? c.signupFirst : c.upgradeYr;

  return (
    <PaymentErrorBoundary>
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
    >
      <Header
        right={
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {c.backHome}
          </Link>
        }
      />

      <div className="flex-1 px-4 py-12">
        <div className="max-w-7xl mx-auto space-y-16">

          {/* ── Hero ─────────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-3 animate-fade-up">
            <span className="text-5xl">🎹</span>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight text-center">
              {c.heroTitle}
            </h1>
            <p className="text-muted-foreground text-center max-w-md text-sm sm:text-base">
              {c.heroSub}
            </p>
          </div>

          {/* ── 플랜 카드 3개 ──────────────────────────────────── */}
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-up"
            style={{ animationDelay: "0.1s" }}
          >
            {/* Free */}
            <div className="rounded-3xl bg-card border border-border shadow-sm overflow-hidden flex flex-col">
              <div className="p-7 flex flex-col flex-1">
                <div className="mb-1">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {c.freeName}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-5">{c.freeDesc}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-foreground">{c.freePrice}</span>
                  <span className="text-sm text-muted-foreground">{c.freePriceSub}</span>
                </div>
                <ul className="space-y-2 mb-8 flex-1">
                  {c.freeFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className="text-muted-foreground mt-0.5 flex-shrink-0">✓</span>
                      <span className="text-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleCta("free")}
                  disabled={tier !== "guest"}
                  className="w-full py-3 rounded-xl border border-border text-sm font-semibold transition-all hover:bg-muted/60 disabled:opacity-60 disabled:cursor-default"
                >
                  {freeCtaLabel}
                </button>
              </div>
            </div>

            {/* Premium Monthly — Most Popular */}
            <div className="relative rounded-3xl bg-card border-2 border-primary shadow-xl overflow-hidden flex flex-col">
              <div className="absolute top-0 left-0 right-0 py-1.5 bg-primary text-primary-foreground text-xs font-bold text-center tracking-wide">
                {c.moBadge}
              </div>
              <div className="p-7 pt-10 flex flex-col flex-1">
                <div className="mb-1">
                  <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                    {c.moName}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-5">{c.moDesc}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-foreground">{c.moPrice}</span>
                  <span className="text-sm text-muted-foreground">{c.moPriceSub}</span>
                </div>
                <ul className="space-y-2 mb-8 flex-1">
                  {c.premiumFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className="text-primary mt-0.5 flex-shrink-0">✓</span>
                      <span className="text-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleCta("monthly")}
                  disabled={tier === "pro" || isCheckoutLoading}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-60 disabled:cursor-default"
                >
                  {isCheckoutLoading ? "..." : moCtaLabel}
                </button>
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  {c.cancelNote}
                </p>
              </div>
            </div>

            {/* Premium Annual — Save 30% */}
            <div className="relative rounded-3xl bg-card border-2 border-orange-400 shadow-xl overflow-hidden flex flex-col">
              <div className="absolute top-0 left-0 right-0 py-1.5 bg-orange-500 text-white text-xs font-bold text-center tracking-wide">
                {c.yrBadge}
              </div>
              <div className="p-7 pt-10 flex flex-col flex-1">
                <div className="mb-1">
                  <span className="text-xs font-semibold uppercase tracking-widest text-orange-500">
                    {c.yrName}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-5">{c.yrDesc}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-foreground">{c.yrPrice}</span>
                  <span className="text-sm text-muted-foreground">{c.yrPriceSub}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-5">
                  <span className="line-through">$35.88</span>
                  <span className="ml-2 text-orange-500 font-semibold">
                    {lang === "ko" ? "월 $2.08 · $10.89 절약" : "$2.08/mo · save $10.89"}
                  </span>
                </p>
                <ul className="space-y-2 mb-8 flex-1">
                  {c.premiumFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className="text-orange-500 mt-0.5 flex-shrink-0">✓</span>
                      <span className="text-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleCta("yearly")}
                  disabled={tier === "pro" || isCheckoutLoading}
                  className="w-full py-3 rounded-xl bg-orange-500 text-white text-sm font-semibold shadow-md hover:shadow-lg hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-default"
                >
                  {isCheckoutLoading ? "..." : yrCtaLabel}
                </button>
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  {c.cancelNote}
                </p>
              </div>
            </div>
          </div>

          {/* ── 비교 매트릭스 ──────────────────────────────────── */}
          <div
            className="animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            <h2 className="text-xl font-bold text-foreground text-center mb-5">
              {c.compareTitle}
            </h2>
            <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm max-w-3xl mx-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    {c.compareHeaders.map((header, idx) => {
                      const isPremium = idx === c.compareHeaders.length - 1;
                      return (
                        <th
                          key={header}
                          className={`px-5 py-4 text-left font-semibold ${
                            isPremium
                              ? "text-primary bg-primary/5"
                              : "text-foreground"
                          }`}
                        >
                          {isPremium && <span className="mr-1">✨</span>}
                          {header}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {c.compareRows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className="border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      {row.map((cell, cellIdx) => {
                        const isFirstCol = cellIdx === 0;
                        const isPremiumCol = cellIdx === row.length - 1;
                        return (
                          <td
                            key={cellIdx}
                            className={`px-5 py-4 ${
                              isFirstCol
                                ? "font-medium text-foreground"
                                : isPremiumCol
                                ? "text-primary font-semibold bg-primary/5"
                                : "text-muted-foreground"
                            }`}
                          >
                            {cell}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── FAQ ────────────────────────────────────────────── */}
          <div
            className="max-w-2xl mx-auto animate-fade-up"
            style={{ animationDelay: "0.3s" }}
          >
            <h2 className="text-xl font-bold text-foreground text-center mb-6">
              {c.faqTitle}
            </h2>
            <div className="space-y-4">
              {c.faqs.map((item) => (
                <div
                  key={item.q}
                  className="rounded-xl border border-border bg-card p-5"
                >
                  <p className="font-semibold text-sm text-foreground mb-1">{item.q}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.a}
                  </p>
                </div>
              ))}
              <div className="text-center pt-2">
                <Link
                  to="/faq"
                  className="text-sm text-primary hover:underline underline-offset-2 transition-colors"
                >
                  {c.faqMore}
                </Link>
              </div>
            </div>
          </div>

          {/* ── Paddle 안전 문구 ──────────────────────────────── */}
          <div
            className="flex flex-col items-center gap-2 animate-fade-up"
            style={{ animationDelay: "0.4s" }}
          >
            <p className="text-xs text-muted-foreground">{c.securedBy}</p>
            <Link
              to="/refund"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              {c.refundPolicy}
            </Link>
          </div>

        </div>
      </div>
    </div>
    </PaymentErrorBoundary>
  );
}
