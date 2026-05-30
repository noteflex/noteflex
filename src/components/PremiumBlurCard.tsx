import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LanguageContext";

interface PremiumBlurCardProps {
  tier: "guest" | "free" | "premium" | "admin";
  children: React.ReactNode;
  ctaText?: string;
  onUpgrade?: () => void;
  blurAmount?: number;
}

const DEFAULT_CTA: Record<string, Record<string, string>> = {
  ko: { guest: "무료로 가입하기", free: "프리미엄 혜택 보기 →" },
  en: { guest: "Sign up — free", free: "View Premium Benefits →" },
};

export default function PremiumBlurCard({
  tier,
  children,
  ctaText,
  onUpgrade,
  blurAmount = 6,
}: PremiumBlurCardProps) {
  const navigate = useNavigate();
  const { lang } = useLang();

  if (tier === "premium" || tier === "admin") {
    return <>{children}</>;
  }

  const defaultCta =
    ctaText ?? DEFAULT_CTA[lang]?.[tier] ?? DEFAULT_CTA["en"][tier];

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigate("/pricing");
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg" data-testid="premium-blur-card">
      {/* blurred content — GPU layer via will-change. pointer-events-none 완료 → 잠금 우회 클릭 X */}
      <div
        style={{ filter: `blur(${blurAmount}px)`, willChange: "filter" }}
        className="pointer-events-none select-none"
        aria-hidden="true"
        data-testid="blur-layer"
      >
        {children}
      </div>

      {/* overlay CTA */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-sm"
        data-testid="upgrade-overlay"
      >
        <Button onClick={handleUpgrade} data-testid="upgrade-cta">
          {defaultCta}
        </Button>
      </div>
    </div>
  );
}
