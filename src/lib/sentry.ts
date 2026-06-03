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

    // Sentry SDK 10 default ignoreErrors (eventFilters.js) 가 이미 잡는 패턴은 재등록 X:
    //   /^Script error\.?$/, /^ResizeObserver loop completed with undelivered notifications.$/,
    //   GTM·Google Search·CEFSharp·Facebook 인앱 브라우저 등 11개.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      // 네트워크 일시 실패·사용자 abort (라우트 변경·페이지 이탈 시 fetch 취소 패턴)
      "Network request failed",
      "Failed to fetch",
      "Load failed",
      "AbortError",
      "The user aborted a request",
      "NetworkError when attempting to fetch resource",
      "cancelled",
      // Storage quota — private browsing·storage 가득
      "QuotaExceededError",
      // PWA SW 등록 거부 — registerSW.ts 의 onRegisterError 가 잡지 못한 경로 (workbox-window
      // dynamic import 실패·구형 Android·incognito·확장프로그램 차단 등) 대비 보조 필터.
      /service\s?worker/i,
      /registerSW/i,
      /^Rejected$/,
    ],

    // 확장 프로그램·3rd-party 광고·analytics 스크립트 noise. stacktrace URL 기준 차단.
    denyUrls: [
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      /^safari-(web-)?extension:\/\//,
      /googletagmanager\.com/,
      /pagead2\.googlesyndication\.com/,
      /google-analytics\.com/,
      /googleadservices\.com/,
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
