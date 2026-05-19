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
      {
        q: "Noteflex는 어떤 사람에게 적합한가요?",
        a: "피아노·다른 악기를 시작했거나 다시 시작한 분, 악보 읽기가 느려 답답한 분, 매일 짧게 초견을 연습하고 싶은 분. 클래식·재즈·교회 반주·합창 어느 영역이든 도움이 됩니다.",
      },
      {
        q: "악기 없이도 사용할 수 있나요?",
        a: "네. Noteflex는 악기 없이 화면만으로 계이름 읽기를 훈련합니다. 출퇴근·휴식 시간 등 어디서든 짧게 연습할 수 있습니다.",
      },
      {
        q: "하루에 얼마나 연습해야 하나요?",
        a: "매일 5~10분이면 충분합니다. 짧고 자주가 길고 가끔보다 효과적입니다.",
      },
      {
        q: "진도를 어떻게 추적하나요?",
        a: "대시보드에서 일일·주간 학습 통계, 약점 음표 분석, 정확도와 속도 변화를 확인할 수 있습니다.",
      },
      {
        q: "계정을 삭제하면 데이터는 어떻게 되나요?",
        a: "탈퇴 후 30일 동안은 같은 이메일로 다시 가입하면 학습 기록이 자동으로 복원됩니다. 30일이 지나면 모든 학습 기록과 개인 정보가 완전히 삭제되며, 이후에는 복구할 수 없습니다.",
      },
      {
        q: "여러 기기에서 동시에 사용할 수 있나요?",
        a: "여러 기기에서 사용할 수 있지만, 한 번에 한 기기에서만 로그인할 수 있습니다. 다른 기기에서 로그인하면 기존 기기의 세션은 자동으로 종료됩니다. 학습 기록은 모든 기기에서 동기화됩니다.",
      },
      {
        q: "앱 스토어에서 다운로드할 수 있나요?",
        a: "현재 Noteflex는 웹 앱입니다. 모바일에서는 홈 화면에 추가하면 앱처럼 사용할 수 있습니다 (PWA 지원). 앱 스토어 정식 출시는 추후 반영 예정입니다.",
      },
      {
        q: "오프라인에서도 사용할 수 있나요?",
        a: "안정적인 학습 기록 동기화를 위해 인터넷에 연결된 상태에서 사용해 주세요.",
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
      {
        q: "Who is Noteflex for?",
        a: "Anyone starting or returning to piano or another instrument, struggling with reading sheet music, or wanting a short daily sight-reading habit. Whether you play classical, jazz, church accompaniment, or choral music — Noteflex helps.",
      },
      {
        q: "Can I use Noteflex without an instrument?",
        a: "Yes. Noteflex trains note reading entirely on screen. Practice anywhere — commute, breaks, downtime — without a piano or sheet music.",
      },
      {
        q: "How long should I practice each day?",
        a: "5–10 minutes daily is enough. Short and frequent beats long and rare.",
      },
      {
        q: "How do I track my progress?",
        a: "The dashboard shows daily and weekly stats, weak-note analysis, and changes in accuracy and speed over time.",
      },
      {
        q: "What happens to my data if I delete my account?",
        a: "For 30 days after deletion, signing up again with the same email will automatically restore your learning records. After 30 days, all data is permanently deleted and cannot be recovered.",
      },
      {
        q: "Can I use Noteflex on multiple devices simultaneously?",
        a: "You can use Noteflex on multiple devices, but only one device can be signed in at a time. Signing in on a new device automatically signs you out of the previous one. Your learning records sync across all devices.",
      },
      {
        q: "Is there a mobile app on the App Store?",
        a: "Noteflex is currently a web app. On mobile, you can add it to your home screen to use it like a native app (PWA supported). A dedicated app store release is planned for the future.",
      },
      {
        q: "Can I use Noteflex offline?",
        a: "For reliable sync of your learning records, please use Noteflex while connected to the internet.",
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
