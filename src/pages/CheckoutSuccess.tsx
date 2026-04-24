import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function CheckoutSuccess() {
  const navigate = useNavigate();

  // 5초 후 자동으로 메인으로 이동 (선택사항)
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/");
    }, 5000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 bg-gradient-to-br from-primary/10 via-background to-accent/10">
      {/* 성공 애니메이션 */}
      <div className="flex flex-col items-center gap-2 animate-fade-up">
        <div className="w-20 h-20 rounded-full bg-green-100 border-4 border-green-500 flex items-center justify-center text-4xl animate-bounce">
          ✓
        </div>
        <span className="text-4xl mt-2">🎉</span>
      </div>

      {/* 메시지 */}
      <div className="flex flex-col items-center gap-2 text-center max-w-md animate-fade-up" style={{ animationDelay: "0.2s" }}>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          결제가 완료되었습니다!
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Piano Note Trainer Premium을 시작해보세요 🎹
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          영수증은 이메일로 발송됩니다.
        </p>
      </div>

      {/* 혜택 안내 */}
      <div className="flex flex-col gap-2 p-4 rounded-2xl bg-card border border-border shadow-sm max-w-md w-full animate-fade-up" style={{ animationDelay: "0.4s" }}>
        <p className="text-sm font-semibold text-foreground mb-1">
          🎁 이제 사용 가능한 기능
        </p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary">✓</span>
            <span>모든 레벨 (1~7) 무제한 이용</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">✓</span>
            <span>광고 완전 제거</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">✓</span>
            <span>상세 학습 통계 및 약점 분석</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">✓</span>
            <span>악보 업로드 및 커스텀 연습</span>
          </li>
        </ul>
      </div>

      {/* 버튼 */}
      <Link
        to="/"
        className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 animate-fade-up"
        style={{ animationDelay: "0.6s" }}
      >
        🎹 시작하기
      </Link>

      <p className="text-xs text-muted-foreground animate-fade-up" style={{ animationDelay: "0.8s" }}>
        5초 후 자동으로 홈으로 이동합니다
      </p>
    </div>
  );
}