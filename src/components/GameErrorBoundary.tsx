import * as Sentry from "@sentry/react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  children: ReactNode;
}

function GameErrorFallback({ resetError }: { error: unknown; resetError: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">게임 중 문제가 발생했습니다</h1>
        <p className="text-muted-foreground mb-6">
          잠시 후 다시 시도해주세요. 게임 데이터는 안전합니다.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={resetError}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            다시 시도
          </button>
          <button
            onClick={() => {
              resetError();
              navigate("/");
            }}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:opacity-90"
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  );
}

export function GameErrorBoundary({ children }: Props) {
  return (
    <Sentry.ErrorBoundary
      fallback={(props) => <GameErrorFallback {...props} />}
      showDialog={false}
      beforeCapture={(scope) => {
        scope.setTag("area", "game");
        scope.setLevel("error");
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
