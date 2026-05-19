import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLang } from "@/contexts/LanguageContext";

const content = {
  ko: {
    title: "Noteflex 소개",
    paragraphs: [
      "저는 다소 늦은 나이에 피아노를 시작했습니다.",
      "가장 큰 벽은 악보였습니다. 음표를 보고 계이름이 떠오르기까지 한참이 걸렸고, 그 사이 손가락은 멈춰 있었습니다. 음표를 보자마자 계이름이 떠오르면, 그리고 연습실도, 악보도, 피아노도 없는 자리에서 계이름 읽기를 연습할 수 있다면 얼마나 좋을까.",
      "Noteflex는 이 고민에서 시작되었습니다. 저처럼 악보 앞에서 머뭇거리는 사람들이, 언제 어디서든 짧게라도 초견을 연습할 수 있도록 만들었습니다.",
      "완벽한 서비스라고 말하지 않겠습니다. 다만 여러분의 초견 실력과 함께 자라는 서비스가 되겠다고 약속합니다.",
    ],
  },
  en: {
    title: "About Noteflex",
    paragraphs: [
      "I started learning piano later than most.",
      "The biggest wall was the score. The moment I saw a note, it took ages for the name to come to mind — and while I hesitated, my fingers froze. I kept thinking: what if I could read notes the instant I saw them? What if I could practice this anywhere, without a practice room, without sheet music, without a piano?",
      "That's why I built Noteflex. So that people like me, who pause at every note, can train their sight-reading anytime, anywhere — even in short moments.",
      "I won't claim this is a finished product. But I promise this: Noteflex will grow alongside your sight-reading.",
    ],
  },
};

export default function About() {
  const { lang } = useLang();
  const isKo = lang === "ko";
  const { title, paragraphs } = isKo ? content.ko : content.en;

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
            {isKo ? "← 홈으로" : "← Home"}
          </Link>
        }
      />
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full animate-fade-up">
          <h1 className="text-3xl font-bold text-foreground mb-8">{title}</h1>
          <div className="space-y-6">
            {paragraphs.map((p, i) => (
              <p key={i} className="text-foreground leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
