import { useLang, useT } from "@/contexts/LanguageContext";

export default function LangToggle() {
  const { lang, setLang } = useLang();
  const t = useT();

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        type="button"
        onClick={() => setLang("ko")}
        className={
          lang === "ko"
            ? "font-bold text-foreground"
            : "text-muted-foreground hover:text-foreground transition-colors"
        }
        aria-label={t.langToggle.ko}
        aria-pressed={lang === "ko"}
      >
        {t.langToggle.ko}
      </button>
      <span className="text-muted-foreground" aria-hidden="true">·</span>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={
          lang === "en"
            ? "font-bold text-foreground"
            : "text-muted-foreground hover:text-foreground transition-colors"
        }
        aria-label={t.langToggle.en}
        aria-pressed={lang === "en"}
      >
        {t.langToggle.en}
      </button>
    </div>
  );
}
