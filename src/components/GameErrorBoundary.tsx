import * as Sentry from "@sentry/react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "@/contexts/LanguageContext";

interface Props {
  children: ReactNode;
}

function GameErrorFallback({ resetError }: { error: unknown; resetError: () => void }) {
  const navigate = useNavigate();
  const t = useT();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">{t.game.errorTitle}</h1>
        <p className="text-muted-foreground mb-6">{t.game.errorBody}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={resetError}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            {t.game.errorRetry}
          </button>
          <button
            onClick={() => {
              resetError();
              navigate("/");
            }}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:opacity-90"
          >
            {t.game.errorHome}
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
