import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLang } from "@/contexts/LanguageContext";

export default function About() {
  const { lang } = useLang();
  const isKo = lang === "ko";

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
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-xl text-center animate-fade-up">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            {isKo ? "Noteflex 소개" : "About Noteflex"}
          </h1>
          <p className="text-muted-foreground">
            {isKo ? "준비 중입니다." : "Coming soon."}
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
