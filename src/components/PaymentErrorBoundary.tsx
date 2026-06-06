import * as Sentry from "@sentry/react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "@/contexts/LanguageContext";

interface Props {
  children: ReactNode;
}

function PaymentErrorFallback({ resetError }: { error: unknown; resetError: () => void }) {
  const navigate = useNavigate();
  const t = useT();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">{t.paymentError.title}</h1>
        <p className="text-muted-foreground mb-2">{t.paymentError.safetyNote}</p>
        <p className="text-sm text-muted-foreground mb-6">{t.paymentError.supportNote}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={resetError}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            {t.paymentError.retryButton}
          </button>
          <button
            onClick={() => {
              resetError();
              navigate("/");
            }}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:opacity-90"
          >
            {t.paymentError.homeButton}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PaymentErrorBoundary({ children }: Props) {
  return (
    <Sentry.ErrorBoundary
      fallback={(props) => <PaymentErrorFallback {...props} />}
      showDialog={false}
      beforeCapture={(scope) => {
        scope.setTag("area", "payment");
        scope.setLevel("error");
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
