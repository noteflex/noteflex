import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLang } from "@/contexts/LanguageContext";
import Seo from "@/components/Seo";

type Section =
  | { title: string; description: string; channelType: "email"; channel: string }
  | { title: string; description: string; channelType: "link"; channel: string; linkLabel: string };

const CONTENT: Record<"ko" | "en", { title: string; subtitle: string; backHome: string; sections: Section[] }> = {
  ko: {
    title: "문의",
    subtitle: "원하시는 채널로 연락해 주세요",
    backHome: "← 홈으로",
    sections: [
      {
        title: "비즈니스 문의",
        description: "제휴, 언론, B2B",
        channelType: "email",
        channel: "contact@noteflex.app",
      },
      {
        title: "기술 지원",
        description: "계정, 게임 사용법, 버그 신고",
        channelType: "email",
        channel: "support@noteflex.app",
      },
      {
        title: "결제·환불·영수증",
        description: "Paddle이 결제를 처리합니다. 결제 관련 문의는 Paddle 고객 지원을 이용해 주세요.",
        channelType: "link",
        channel: "https://www.paddle.com/help",
        linkLabel: "Paddle Help Center →",
      },
    ],
  },
  en: {
    title: "Contact",
    subtitle: "Reach out through the right channel",
    backHome: "← Home",
    sections: [
      {
        title: "Business Inquiries",
        description: "Partnerships, press, B2B",
        channelType: "email",
        channel: "contact@noteflex.app",
      },
      {
        title: "Technical Support",
        description: "Account, game usage, bug reports",
        channelType: "email",
        channel: "support@noteflex.app",
      },
      {
        title: "Billing, Refunds, Receipts",
        description: "Paddle handles all payments. For billing inquiries, please visit Paddle's support.",
        channelType: "link",
        channel: "https://www.paddle.com/help",
        linkLabel: "Paddle Help Center →",
      },
    ],
  },
};

export default function Contact() {
  const { lang } = useLang();
  const isKo = lang === "ko";
  const { title, subtitle, backHome, sections } = isKo ? CONTENT.ko : CONTENT.en;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
    >
      <Seo
        title={isKo ? "문의 | Noteflex" : "Contact | Noteflex"}
        description={
          isKo
            ? "Noteflex 비즈니스 제휴, 기술 지원, 사용자 피드백 문의 채널 안내."
            : "Get in touch with Noteflex — business inquiries, technical support, and user feedback."
        }
        canonical="https://noteflex.app/contact"
        lang={isKo ? "ko" : "en"}
      />
      <Header
        right={
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {backHome}
          </Link>
        }
      />
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full animate-fade-up">
          <h1 className="text-3xl font-bold text-foreground mb-2">{title}</h1>
          <p className="text-muted-foreground mb-8">{subtitle}</p>
          <div className="space-y-4">
            {sections.map((s) => (
              <div
                key={s.title}
                className="rounded-xl border border-border bg-card p-5"
              >
                <p className="font-semibold text-foreground mb-1">{s.title}</p>
                <p className="text-sm text-muted-foreground mb-2">{s.description}</p>
                {s.channelType === "email" ? (
                  <a
                    href={`mailto:${s.channel}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {s.channel}
                  </a>
                ) : (
                  <a
                    href={s.channel}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {s.linkLabel}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
