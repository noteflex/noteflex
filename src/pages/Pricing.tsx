import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { openCheckout } from "@/lib/paddle";
import { toast } from "@/hooks/use-toast";

type BillingCycle = "monthly" | "yearly";

const FEATURES = [
  "Level 1~7 모든 레벨 이용",
  "광고 완전 제거",
  "무제한 플레이",
  "상세 학습 통계 분석",
  "약점 음표 집중 연습",
  "악보 업로드 & 커스텀 연습",
];

export default function Pricing() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  const [loading, setLoading] = useState<BillingCycle | null>(null);

  const handleSubscribe = async (plan: BillingCycle) => {
    if (!user) {
      toast({
        title: "로그인이 필요해요",
        description: "구독하려면 먼저 로그인해주세요",
      });
      navigate("/");
      return;
    }

    if (profile?.is_premium) {
      toast({
        title: "이미 프리미엄 이용 중이에요 🎹",
      });
      return;
    }

    setLoading(plan);
    try {
      await openCheckout({
        plan,
        userEmail: user.email,
        userId: user.id,
      });
    } catch (err: any) {
      toast({
        title: "결제 실행 실패",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
    >
      <Header
        right={
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 홈으로
          </Link>
        }
      />
      <div className="flex-1 px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center gap-3 mb-10 animate-fade-up">
          <span className="text-5xl">🎹</span>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight text-center">
            Noteflex Premium
          </h1>
          <p className="text-muted-foreground text-center max-w-md text-sm sm:text-base">
            반사 신경으로 악보를 읽는 진짜 실력, 지금 시작하세요
          </p>
        </div>

        {/* 이미 프리미엄이면 배너 */}
        {profile?.is_premium && (
          <div className="max-w-md mx-auto mb-8 p-4 rounded-2xl bg-primary/10 border-2 border-primary/30 animate-fade-up">
            <p className="text-center text-sm font-semibold text-primary">
              ✨ 이미 프리미엄을 이용하고 계세요
            </p>
          </div>
        )}

        {/* 월간/연간 토글 */}
        <div
          className="flex items-center justify-center gap-2 mb-8 animate-fade-up"
          style={{ animationDelay: "0.1s" }}
        >
          <button
            onClick={() => setCycle("monthly")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              cycle === "monthly"
                ? "bg-primary text-primary-foreground shadow"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            월간
          </button>
          <button
            onClick={() => setCycle("yearly")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all relative ${
              cycle === "yearly"
                ? "bg-primary text-primary-foreground shadow"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            연간
            <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
              44% OFF
            </span>
          </button>
        </div>

        {/* 플랜 카드 (1개 메인 플랜) */}
        <div
          className="max-w-md mx-auto animate-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="relative rounded-3xl bg-card border-2 border-primary shadow-xl overflow-hidden">
            {/* 배지 */}
            {cycle === "yearly" && (
              <div className="absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl bg-primary text-primary-foreground text-xs font-bold">
                🎉 가장 인기
              </div>
            )}

            <div className="p-8">
              {/* 플랜 제목 */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🎹</span>
                <h2 className="text-xl font-bold text-foreground">Premium</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                모든 기능을 자유롭게
              </p>

              {/* 가격 */}
              <div className="mb-6">
                {cycle === "monthly" ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">$2.99</span>
                    <span className="text-muted-foreground text-sm">/월</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">$19.99</span>
                      <span className="text-muted-foreground text-sm">/년</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="line-through">$35.88</span>
                      <span className="ml-2 text-primary font-semibold">
                        월 $1.67 · 16달러 할인
                      </span>
                    </p>
                  </>
                )}
              </div>

              {/* 기능 리스트 */}
              <ul className="space-y-2.5 mb-6">
                {FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* 구독 버튼 */}
              <button
                onClick={() => handleSubscribe(cycle)}
                disabled={loading !== null || profile?.is_premium}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === cycle
                  ? "처리 중..."
                  : profile?.is_premium
                  ? "이미 이용 중"
                  : cycle === "monthly"
                  ? "월간 구독 시작하기"
                  : "연간 구독 시작하기"}
              </button>

              {/* 안내 문구 */}
              <p className="text-[11px] text-muted-foreground text-center mt-3 leading-relaxed">
                언제든 취소 가능 · 자동 갱신 · 이메일로 영수증 발송
              </p>
            </div>
          </div>
        </div>

        {/* 무료 vs 프리미엄 비교 (간단 버전) */}
        <div
          className="mt-12 max-w-2xl mx-auto animate-fade-up"
          style={{ animationDelay: "0.3s" }}
        >
          <h3 className="text-center text-lg font-bold text-foreground mb-4">
            Free vs Premium
          </h3>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-foreground">
                    기능
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">
                    Free
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-primary">
                    Premium
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Level 1~4 (기본)", "✓", "✓"],
                  ["Level 5~7 (조표)", "—", "✓"],
                  ["광고 없음", "—", "✓"],
                  ["학습 통계", "기본", "상세"],
                  ["악보 업로드", "—", "✓"],
                  ["커스텀 연습", "—", "✓"],
                ].map(([label, free, premium], i, arr) => (
                  <tr
                    key={label}
                    className={i < arr.length - 1 ? "border-b border-border" : ""}
                  >
                    <td className="px-4 py-3 text-foreground">{label}</td>
                    <td className="text-center px-4 py-3 text-muted-foreground">
                      {free}
                    </td>
                    <td className="text-center px-4 py-3 text-primary font-semibold">
                      {premium}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 하단 안내 */}
        <p
          className="text-center text-xs text-muted-foreground mt-8 animate-fade-up"
          style={{ animationDelay: "0.4s" }}
        >
          결제는 Paddle이 안전하게 처리합니다
        </p>
      </div>
      </div>
    </div>
  );
}
