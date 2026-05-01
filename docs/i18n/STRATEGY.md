# Noteflex i18n + 라우팅 + PWA 출시 전략

> 최종 수정: 2026-05-01  
> 작성: Opus 분석 → Sonnet 문서화  
> 범위: KR+EN 동시 출시 (2026-05-31) → JP+CN 출시 후 확장

---

## 1. 글로벌 출시 전략 개요

### 목표

| 항목 | 내용 |
|---|---|
| 1차 출시 (2026-05-31) | KR + EN 동시 |
| 2차 확장 (출시 후 2~3개월) | JP + CN |
| 장기 목표 | 음악 교육 시장 상위 5개 언어 커버 |

### 핵심 원칙

1. **URL 구조 우선 결정** — 나중에 바꾸면 SEO 손실 크므로 출시 전에 확정
2. **콘텐츠 분리** — UI 문자열 / 마케팅 텍스트 / 이메일 템플릿 별도 관리
3. **기본 언어 = KR** — 미매칭 로케일은 KR 폴백 (EN 폴백 아님 — 타깃 시장 우선)
4. **SEO 독립** — `/en/`, `/ja/` 등 서브경로로 각 언어판이 별도 색인

---

## 2. URL 구조

### 채택 방식: 서브경로 (subdirectory)

```
https://noteflex.com/          → KR (기본)
https://noteflex.com/en/       → EN
https://noteflex.com/ja/       → JP (2차)
https://noteflex.com/zh/       → CN (2차)
```

### 서브경로 vs 서브도메인 비교

| 항목 | 서브경로 (`/en/`) | 서브도메인 (`en.`) |
|---|---|---|
| SEO | 도메인 권위 통합 — 유리 | 분산 — 불리 |
| 구현 복잡도 | Next.js 미들웨어로 처리 | DNS + 별도 배포 |
| 유지비용 | 낮음 | 높음 |
| 채택 | **채택** | 미채택 |

### hreflang 설정

```html
<!-- 각 페이지 <head>에 삽입 -->
<link rel="alternate" hreflang="ko" href="https://noteflex.com/" />
<link rel="alternate" hreflang="en" href="https://noteflex.com/en/" />
<link rel="alternate" hreflang="x-default" href="https://noteflex.com/" />
```

---

## 3. 다국어 운영 방식

### 3.1 번역 관리 구조

```
src/
  messages/
    ko.json      ← 기본 (한국어)
    en.json      ← 영어
    ja.json      ← 일본어 (2차)
    zh.json      ← 중국어 간체 (2차)
```

### 3.2 라이브러리 선택: next-intl

| 이유 | 내용 |
|---|---|
| Next.js App Router 공식 지원 | 서버 컴포넌트에서 번역 사용 가능 |
| 미들웨어 통합 | 로케일 감지 + 리다이렉트 내장 |
| 타입 안전성 | `useTranslations()` 훅 — 오타 컴파일 에러 |
| 번들 크기 | 로케일별 JSON만 로드 |

### 3.3 번역 파일 구조 (예시)

```json
// ko.json
{
  "game": {
    "countdown": "준비",
    "correct": "정답!",
    "wrong": "틀렸어요",
    "timeUp": "시간 초과"
  },
  "level": {
    "beginner": "입문",
    "intermediate": "숙련",
    "master": "마스터"
  },
  "landing": {
    "headline": "악보를 눈으로 읽어라",
    "cta": "무료로 시작"
  }
}
```

### 3.4 1차 출시 번역 범위 (KR+EN)

| 카테고리 | 문자열 수 (추정) | 우선순위 |
|---|---|---|
| 게임 UI (버튼, 피드백, 타이머) | ~30 | 🔴 필수 |
| 레벨/단계 라벨 | ~20 | 🔴 필수 |
| 랜딩 페이지 + CTA | ~40 | 🔴 필수 |
| 오류 메시지 | ~15 | 🟡 권장 |
| 이메일 템플릿 | ~3개 | 🟡 권장 |
| 마케팅 블로그 | 별도 | ⏳ 2차 |

---

## 4. Next.js 라우팅 보호

### 4.1 미들웨어 구조 (middleware.ts)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale } from "@/i18n/config";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 자산·API 제외
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 로케일 감지
  const pathnameLocale = locales.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameLocale) return NextResponse.next();

  // Accept-Language 헤더 기반 감지
  const acceptLang = request.headers.get("accept-language") ?? "";
  const detectedLocale = detectLocale(acceptLang) ?? defaultLocale;

  // KR(기본) → 리다이렉트 없음; 나머지 → /en/ 등으로 리다이렉트
  if (detectedLocale !== defaultLocale) {
    return NextResponse.redirect(
      new URL(`/${detectedLocale}${pathname}`, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
```

### 4.2 구독 게이트 보호

기존 `canAccessSublevel(tier, level, sublevel)` 로직은 유지.  
미들웨어는 **로케일 라우팅만** 담당 — 인증/구독 체크는 각 페이지 서버 컴포넌트에서 처리.

```typescript
// app/[locale]/game/[level]/[sublevel]/page.tsx
import { canAccessSublevel } from "@/lib/levelSystem";

export default async function GamePage({ params }) {
  const { locale, level, sublevel } = params;
  const user = await getUser();
  
  if (!canAccessSublevel(user.tier, Number(level), Number(sublevel))) {
    redirect(`/${locale}/upgrade`);
  }
  // ...
}
```

### 4.3 App Router 디렉토리 구조

```
app/
  [locale]/
    layout.tsx        ← IntlProvider + locale 주입
    page.tsx          ← 랜딩
    game/
      [level]/
        [sublevel]/
          page.tsx
    practice/
      page.tsx
    upgrade/
      page.tsx
  api/
    ...               ← locale 무관
```

---

## 5. PWA 등록

### 5.1 목표

- iOS Safari에서 "홈 화면에 추가" 지원 (Add to Home Screen)
- 오프라인 캐싱 — 정적 자산·게임 로직 오프라인 동작
- 앱 아이콘 + 스플래시 스크린

### 5.2 구현 방법: next-pwa

```bash
npm install next-pwa
```

```javascript
// next.config.js
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    // 게임 오디오 샘플러 파일 캐시
    {
      urlPattern: /\/samples\//,
      handler: "CacheFirst",
      options: { cacheName: "audio-cache", expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 } },
    },
  ],
});
```

### 5.3 manifest.json

```json
{
  "name": "Noteflex",
  "short_name": "Noteflex",
  "description": "악보를 눈으로 읽는 훈련",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#b91c1c",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "lang": "ko",
  "dir": "ltr"
}
```

### 5.4 iOS 전용 메타태그 (layout.tsx)

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

---

## 6. 출시 후 확장 계획 (JP + CN)

### 6.1 일본어 (JP)

| 항목 | 내용 |
|---|---|
| 출시 시점 | KR+EN 출시 후 2~3개월 |
| 번역 방식 | DeepL API 초벌 → 음악 용어 수동 검수 |
| URL | `noteflex.com/ja/` |
| 특이사항 | 계이름 표기 — 일본은 "ドレミ" (이탈리아식) 사용, 한국 "도레미"와 동일하나 폰트·자간 주의 |

### 6.2 중국어 간체 (CN)

| 항목 | 내용 |
|---|---|
| 출시 시점 | JP 이후 |
| 번역 방식 | DeepL + 원어민 검수 |
| URL | `noteflex.com/zh/` |
| 특이사항 | 계이름: "Do Re Mi" 방식 (1도=C) 또는 "1234567" 숫자보표 — 설계 확정 필요 |

### 6.3 번역 품질 보증

- 게임 핵심 UI (정답/오답 피드백, 타이머) — 출시 전 원어민 검수 필수
- 마케팅 카피 — 전문 번역사 또는 현지 파트너
- 블로그 콘텐츠 — GPT-4o 번역 + 수동 SEO 최적화

---

## 7. 작업 단계별 일정

### Week 2 (출시 준비 인프라)

| 작업 | 예상 시간 | 담당 |
|---|---|---|
| next-intl 설치 + 기본 설정 | 2h | Claude Code |
| `app/[locale]/` 구조 전환 | 3h | Claude Code |
| 미들웨어 로케일 감지 | 1h | Claude Code |
| ko.json / en.json 1차 번역 (~90개 문자열) | 3h | 사용자 검수 포함 |
| hreflang 메타태그 삽입 | 0.5h | Claude Code |

### Week 3 (결제 + 구독 보호)

| 작업 | 예상 시간 | 담당 |
|---|---|---|
| `[locale]` 경로에 구독 게이트 통합 | 2h | Claude Code |
| Paddle 결제 플로우 로케일 처리 | 1h | Claude Code |
| `/upgrade` 페이지 다국어 | 1h | Claude Code |

### Week 4 (PWA + 마무리)

| 작업 | 예상 시간 | 담당 |
|---|---|---|
| next-pwa 설정 + manifest.json | 1h | Claude Code |
| 아이콘 192/512 생성 | 0.5h | 사용자 |
| iOS 메타태그 + 테스트 | 0.5h | Claude Code |
| 전체 다국어 QA (게임 플로우) | 2h | 사용자 |

### Week 5 (출시 직전)

| 작업 | 예상 시간 | 담당 |
|---|---|---|
| 프로덕션 빌드 + 다국어 경로 최종 확인 | 1h | Claude Code |
| 환경변수 production 전환 | 0.5h | 사용자 |
| Vercel 배포 + SEO 크롤링 확인 | 1h | Claude Code |

---

## 변경 이력

- 2026-05-01: 초안 작성 — KR+EN 1차 출시 전략, next-intl + next-pwa, 서브경로 URL 구조, Week 2~5 일정
