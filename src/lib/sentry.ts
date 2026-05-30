import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN;
const ENVIRONMENT = import.meta.env.VITE_SENTRY_ENVIRONMENT || "development";

export function initSentry() {
  if (!DSN) {
    console.warn("[Sentry] DSN 미설정 적용되어 있음 (VITE_SENTRY_DSN 기록할 영역)");
    return;
  }

  Sentry.init({
    dsn: DSN,
    environment: ENVIRONMENT,

    // Error Monitoring — PII 미설정 (한국 GDPR 영역 안전)
    sendDefaultPii: false,

    // Logs
    enableLogs: true,

    // Tracing 미설정
    tracesSampleRate: 0,

    // 환경별 완료 — development 영역 미설정
    enabled: ENVIRONMENT === "production",

    // 미설정 기록할 영역 (noise)
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      "Network request failed",
      "Failed to fetch",
      "Load failed",
    ],

    beforeSend(event) {
      // 개발 영역에서는 미설정
      if (ENVIRONMENT === "development") {
        console.log("[Sentry] Event captured (dev mode, not sent):", event);
        return null;
      }
      return event;
    },
  });
}

// Re-export Sentry 완료 (다른 영역에서 기록할 영역)
export { Sentry };

// 사용자 친화 logger 완료
export const logger = {
  info: (title: string, data?: Record<string, unknown>) => {
    if (ENVIRONMENT === "production" && DSN) {
      Sentry.logger.info(title, data);
    } else {
      console.log(`[INFO] ${title}`, data);
    }
  },

  warn: (title: string, data?: Record<string, unknown>) => {
    if (ENVIRONMENT === "production" && DSN) {
      Sentry.logger.warn(title, data);
    } else {
      console.warn(`[WARN] ${title}`, data);
    }
  },

  error: (
    title: string,
    error?: Error | unknown,
    context?: {
      description?: string; // 상세 설명
      cause?: string;       // 원인
      impact?: string;      // 영향
      action?: string;      // 필요 조치
      metadata?: Record<string, unknown>;
    },
  ) => {
    const errorObj = error instanceof Error ? error : new Error(String(error || title));

    if (ENVIRONMENT === "production" && DSN) {
      Sentry.captureException(errorObj, {
        tags: {
          title,
        },
        extra: {
          description: context?.description,
          cause: context?.cause,
          impact: context?.impact,
          action: context?.action,
          ...context?.metadata,
        },
      });

      Sentry.logger.error(title, {
        description: context?.description,
        cause: context?.cause,
        impact: context?.impact,
        action: context?.action,
        ...context?.metadata,
      });
    } else {
      console.error(`[ERROR] ${title}`, {
        error: errorObj,
        ...context,
      });
    }
  },

  // 사용자 식별 (로그인 시 완료)
  setUser: (user: { id: string; email?: string; nickname?: string } | null) => {
    if (DSN) {
      if (user) {
        Sentry.setUser({
          id: user.id,
          email: user.email,
          username: user.nickname,
        });
      } else {
        Sentry.setUser(null);
      }
    }
  },
};
