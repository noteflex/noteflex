import * as Sentry from "@sentry/react";
import type { ReactNode } from "react";
import { useT } from "@/contexts/LanguageContext";

interface Props {
  children: ReactNode;
}

function ErrorFallback({ resetError }: { error: unknown; resetError: () => void }) {
  const t = useT();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">{t.errorBoundary.title}</h1>
        <p className="text-muted-foreground mb-4">{t.errorBoundary.description}</p>
        <button
          onClick={resetError}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
        >
          {t.errorBoundary.retryButton}
        </button>
      </div>
    </div>
  );
}

export function ErrorBoundary({ children }: Props) {
  return (
    <Sentry.ErrorBoundary
      fallback={(props) => <ErrorFallback {...props} />}
      showDialog={false}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
