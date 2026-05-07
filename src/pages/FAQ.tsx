import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLang } from "@/contexts/LanguageContext";

const CONTENT = {
  ko: {
    title: "자주 묻는 질문",
    backHome: "← 홈으로",
    faqs: [
      {
        q: "언제든 취소할 수 있나요?",
        a: "네, 구독 기간 중 언제든 취소할 수 있습니다. 취소 후에도 남은 기간은 계속 이용하실 수 있습니다.",
      },
      {
        q: "어떤 결제 수단을 지원하나요?",
        a: "Paddle을 통해 Visa·Mastercard·Amex 등 주요 신용카드와 PayPal, 지역별 결제 수단을 지원합니다.",
      },
      {
        q: "무료 체험 기간이 있나요?",
        a: "별도의 무료 체험 기간은 없습니다. Free 플랜으로 Level 1·2를 제한 없이 무료로 연습해 보세요.",
      },
      {
        q: "Free에서 Premium으로 어떻게 업그레이드하나요?",
        a: "요금제 페이지에서 플랜을 선택하거나 대시보드에서 업그레이드를 누르면 결제 창이 열립니다. 결제 완료 즉시 활성화됩니다.",
      },
      {
        q: "환불 정책이 궁금해요.",
        a: "결제 후 14일 이내 요청 시 전액 환불해 드립니다. 자세한 내용은 환불 정책 페이지를 확인해 주세요.",
      },
    ],
  },
  en: {
    title: "Frequently Asked Questions",
    backHome: "← Home",
    faqs: [
      {
        q: "Can I cancel anytime?",
        a: "Yes. You can cancel at any time. Access continues through the end of the current billing period.",
      },
      {
        q: "What payment methods are accepted?",
        a: "Paddle supports major credit cards (Visa, Mastercard, Amex), PayPal, and various regional payment methods.",
      },
      {
        q: "Is there a free trial?",
        a: "There is no separate trial period. The Free plan gives you full access to Levels 1 and 2 at no charge.",
      },
      {
        q: "How do I upgrade from Free to Premium?",
        a: "Select a plan on the Pricing page or click Upgrade from the dashboard. A payment window opens, and your account activates immediately.",
      },
      {
        q: "What is the refund policy?",
        a: "You may request a full refund within 14 days of purchase. See the Refund Policy page for details.",
      },
    ],
  },
} as const;

export default function FAQ() {
  const { lang } = useLang();
  const c = CONTENT[lang === "ko" ? "ko" : "en"];

  return (
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
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8 animate-fade-up">
            {c.title}
          </h1>
          <div className="space-y-4 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            {c.faqs.map((item) => (
              <div key={item.q} className="rounded-xl border border-border bg-card p-5">
                <p className="font-semibold text-sm text-foreground mb-1">{item.q}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
