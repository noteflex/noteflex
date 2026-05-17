import * as Sentry from "@sentry/react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function ErrorBoundary({ children }: Props) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-4">문제가 발생했습니다</h1>
            <p className="text-muted-foreground mb-4">
              잠시 후 다시 시도해주세요. 문제가 계속되면 새로고침 해주세요.
            </p>
            <button
              onClick={resetError}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}
      showDialog={false}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
