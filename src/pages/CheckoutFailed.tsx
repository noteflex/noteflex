import { Link, useNavigate, useSearchParams } from "react-router-dom";

export default function CheckoutFailed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reason = searchParams.get("reason"); // ?reason=cancelled 등

  const isCancelled = reason === "cancelled";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 bg-gradient-to-br from-muted/30 via-background to-muted/20">
      {/* 아이콘 */}
      <div className="flex flex-col items-center gap-2 animate-fade-up">
        <div className="w-20 h-20 rounded-full bg-orange-100 border-4 border-orange-400 flex items-center justify-center text-4xl">
          {isCancelled ? "⏸" : "⚠️"}
        </div>
      </div>

      {/* 메시지 */}
      <div
        className="flex flex-col items-center gap-2 text-center max-w-md animate-fade-up"
        style={{ animationDelay: "0.2s" }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          {isCancelled ? "결제가 취소되었어요" : "결제를 완료하지 못했어요"}
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {isCancelled
            ? "언제든 다시 시도하실 수 있어요"
            : "일시적인 문제일 수 있으니 다시 시도해주세요"}
        </p>
      </div>

      {/* 원인/해결 안내 */}
      {!isCancelled && (
        <div
          className="flex flex-col gap-2 p-4 rounded-2xl bg-card border border-border shadow-sm max-w-md w-full animate-fade-up"
          style={{ animationDelay: "0.4s" }}
        >
          <p className="text-sm font-semibold text-foreground mb-1">
            💡 다음을 확인해주세요
          </p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-orange-500">•</span>
              <span>카드 정보가 정확한지 확인</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500">•</span>
              <span>카드 한도 또는 해외 결제 가능 여부</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500">•</span>
              <span>다른 카드로 다시 시도</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500">•</span>
              <span>인터넷 연결 상태 확인</span>
            </li>
          </ul>
        </div>
      )}

      {/* 버튼 */}
      <div
        className="flex flex-col gap-2 w-full max-w-md animate-fade-up"
        style={{ animationDelay: "0.6s" }}
      >
        <Link
          to="/pricing"
          className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 text-center"
        >
          다시 결제하기
        </Link>
        <button
          onClick={() => navigate("/")}
          className="px-8 py-3 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-muted transition-colors"
        >
          홈으로 돌아가기
        </button>
      </div>

      {/* 문의 안내 */}
      <p
        className="text-xs text-muted-foreground text-center animate-fade-up"
        style={{ animationDelay: "0.8s" }}
      >
        문제가 계속되면{" "}
        <a
          href="mailto:support@noteflex.app"
          className="text-primary underline hover:text-primary/80"
        >
          support@noteflex.app
        </a>
        으로 문의해주세요
      </p>
    </div>
  );
}
