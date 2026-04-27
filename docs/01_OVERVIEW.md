# 01. 프로젝트 개요

> **작성일**: 2026-04-28
> **대상 독자**: 새로 합류한 개발자 / 운영자 / 검토자
> **선행 자료**: `README.md`, `docs/PENDING_BACKLOG.md`

---

## 1. 서비스 정체성

| 항목 | 내용 |
|---|---|
| 서비스명 | **Noteflex** (앱 패키지명: `com.domisol.app` — 모바일은 `Domisol` 브랜드) |
| 한 줄 소개 | 악보 독보 훈련 웹 앱 — 오선지의 음표 이름을 맞히며 독보 능력을 키운다 |
| 타겟 사용자 | 플루트·바이올린·첼로·보컬 등 **단성 멜로디 악기 연주자**, 음악 입문자, 시창청음 학습자 |
| 핵심 가치 제안 | ① 21단계 점진형 커리큘럼 (Lv 1-1 ~ Lv 7-3) <br> ② 오답 음표를 N+2턴 뒤 재출제하는 retry queue <br> ③ 음표별 mastery 추적과 가중치 출제 (약점 3배 더 출제) <br> ④ Lv 5+ 키사인·스와이프 액시덴탈 등 고급 인터랙션 |
| 메인 도메인 | `noteflex.app` (Vercel 호스팅, Porkbun DNS — `docs/07_DEPLOYMENT.md` 참조) |
| 현재 상태 | Coming Soon 모드 (`VITE_GAME_ENABLED=false`로 정적 페이지만 노출 — 출시 시 `true`로 전환) |

---

## 2. 비즈니스 모델

### 2.1 구독 등급 (`src/lib/levelSystem.ts:31`, `src/lib/subscriptionTier.ts`)

| 등급 | 식별 조건 | 접근 가능 단계 | 비고 |
|---|---|---|---|
| **Guest** | 미로그인 (`user=null`) | Lv 1-1 ~ 1-3 (3단계) | 진도/기록 미저장 |
| **Free** | 로그인 + 무료 | Lv 1-1 ~ 2-3 + Lv 3-1 + Lv 4-1 (8단계) | 진도 저장 |
| **Pro** | `profile.role==='admin'` 또는 `profile.subscription_tier==='pro'` 또는 `profile.is_premium===true` | 21단계 전체 | Paddle/IAP 결제 |

> 🔗 `getUserTier()` 판정 로직: `src/lib/subscriptionTier.ts:12-28`
> 🔗 `canAccessSublevel()` 게이팅: `src/lib/levelSystem.ts:225-246`

### 2.2 가격 (Paddle Sandbox 기준 — 출시 시 Production으로 전환)

| 플랜 | Price ID (Sandbox) | 기본가 |
|---|---|---|
| Monthly | `pri_01kpk2kf6f08bjhwvjhcn42rnw` | $2.99/월 (확정) |
| Yearly | `pri_01kpk2qw52waj1c56j4y7xf6c9` | 미정 — `docs/PENDING_BACKLOG.md §1.2` |

> 🔗 결제 통합: `src/lib/paddle.ts:1-96`, 가격 페이지: `src/pages/Pricing.tsx`

---

## 3. 기술 스택

### 3.1 프론트엔드

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | **React 18.3** + **TypeScript 5.8** | `package.json:67-68` |
| 빌드 도구 | **Vite 5.4** + `@vitejs/plugin-react-swc` | SWC 컴파일러 (esbuild보다 빠름) |
| 라우팅 | `react-router-dom 6.30` | `BrowserRouter` 기반 SPA |
| 상태 관리 | **React Context** (AuthContext) + `@tanstack/react-query 5.83` + `useState`/`useRef` | Redux 미사용 |
| UI 라이브러리 | **Tailwind CSS 3.4** + **shadcn/ui** + **Radix UI Primitives** | `tailwind.config.ts`, `components.json` |
| 폼 검증 | `react-hook-form 7.61` + `@hookform/resolvers` + `zod 3.25` | |
| 음악 렌더링 | `vexflow 5.0` + `abcjs 6.6` | 오선지 SVG, 사용은 `src/components/practice/GrandStaffPractice.tsx` |
| 사운드 | `tone 15.1` | 음표 재생, `src/lib/sound.ts` |
| 차트 | `recharts 2.15` | XP·정확도 추이 |
| 아이콘 | `lucide-react 0.462` | |
| 마크다운 | `react-markdown 10.1` + `remark-gfm 4.0` | 블로그·약관 페이지 |
| 다크모드 | `next-themes 0.3` | (현재 light 고정) |

### 3.2 백엔드 / 인프라

| 영역 | 선택 | 비고 |
|---|---|---|
| 인증·DB·Storage | **Supabase** (`@supabase/supabase-js 2.101`) | Project ref: `rcwydfzkuhfcnnbqjmpp` |
| 서버리스 함수 | **Supabase Edge Functions** (Deno) | 6개 함수 — `docs/04_DB_SCHEMA.md` |
| 결제 (Web) | **Paddle** (`@paddle/paddle-js 1.6`) | Sandbox 환경 사용 중 |
| 결제 (Mobile) | **RevenueCat** (`@revenuecat/purchases-capacitor 12.3`) | IAP 추상화 |
| 모바일 빌드 | **Capacitor 8.3** (`@capacitor/android`, `@capacitor/ios`) | `appId: com.domisol.app` |
| 호스팅 | **Vercel** (SPA fallback) | `vercel.json` |
| DNS | **Porkbun** | (`docs/07_DEPLOYMENT.md`) |

### 3.3 테스트 / 품질

| 영역 | 선택 | 비고 |
|---|---|---|
| 단위/통합 테스트 | **Vitest 3.2** + `@testing-library/react 16.0` + `jsdom 20` | `vitest.config.ts` |
| E2E 테스트 | `@playwright/test 1.57` (설치만, 실제 테스트 0개) | `docs/06_TESTING.md` 참조 |
| Lint | **ESLint 9.32** + `typescript-eslint 8.38` + `eslint-plugin-react-hooks` | `eslint.config.js` |

### 3.4 모니터링·관측

- 현재 **부재** (Sentry 미도입 — `docs/PENDING_BACKLOG.md §12.1`)
- 자체 로깅: `console.log` / `console.error` 만 존재

---

## 4. 디렉토리 구조

```
noteflex/
├─ android/                         # Capacitor Android 빌드 산출물
├─ public/                          # 정적 자산 (favicon, robots.txt, treble/bass-clef SVG)
├─ scripts/
│  └─ test-iap-verification.sh      # IAP 함수 로컬 테스트 스크립트
├─ src/
│  ├─ App.tsx                       # 라우트 정의 + Provider 트리
│  ├─ main.tsx                      # 엔트리포인트
│  ├─ index.css / App.css           # 전역 스타일 (Tailwind + CSS 변수)
│  ├─ contexts/
│  │  └─ AuthContext.tsx            # 인증 + 프로필 상태
│  ├─ hooks/                        # 18개 커스텀 hook (useUserStats, useRetryQueue 등)
│  ├─ lib/                          # 비즈니스 로직 라이브러리 (levelSystem, paddle, solfege 등)
│  ├─ components/
│  │  ├─ ui/                        # shadcn/ui 프리미티브 (50+ 파일)
│  │  ├─ admin/                     # 관리자 다이얼로그 5개
│  │  ├─ home/DiagnosisTab.tsx      # 홈 화면 진단 탭
│  │  ├─ practice/GrandStaffPractice.tsx  # 오선지 렌더러
│  │  └─ NoteGame.tsx 외 ~30개      # 게임 컴포넌트
│  ├─ pages/                        # 라우트 단위 페이지
│  │  ├─ Index.tsx, Home.tsx, Pricing.tsx, ProfilePage.tsx
│  │  ├─ Blog.tsx, BlogPost.tsx
│  │  ├─ legal/LegalPage.tsx
│  │  └─ admin/                     # AdminLayout, AdminUsers, AdminUserDetail, AdminLogs, AdminBatchRuns
│  ├─ content/
│  │  ├─ blog/welcome.md            # 마크다운 블로그 콘텐츠
│  │  └─ legal/{terms,privacy,refund,cookies}.md
│  ├─ integrations/
│  │  ├─ supabase/{client,types}.ts # Supabase 클라이언트 + 자동 생성 타입
│  │  └─ lovable/index.ts
│  └─ test/
│     ├─ setup.ts                   # vitest 셋업 (jsdom, jest-dom)
│     └─ example.test.ts
├─ supabase/
│  ├─ config.toml                   # Supabase 로컬 환경 설정
│  ├─ migrations/                   # 9개 SQL 마이그레이션 (2026-04-04 ~ 2026-04-25)
│  └─ functions/                    # 6개 Edge Function (Deno)
│     ├─ admin-action/
│     ├─ analyze-sheet-music/
│     ├─ paddle-webhook/
│     ├─ payment-webhook/           # (구현 미완성 — index.ts 없음)
│     ├─ create-checkout-session/   # (구현 미완성)
│     └─ verify-iap-receipt/
├─ docs/
│  ├─ PENDING_BACKLOG.md            # 미구현 백로그 (24항목 + 4 기획서 종합)
│  └─ 00_INDEX.md ~ 07_DEPLOYMENT.md  # 본 문서들
├─ dist/                            # Vite 빌드 산출물
├─ package.json / package-lock.json
├─ vite.config.ts / vitest.config.ts / playwright.config.ts
├─ tsconfig.json / tsconfig.app.json / tsconfig.node.json
├─ tailwind.config.ts / postcss.config.js
├─ eslint.config.js / components.json
├─ vercel.json                      # SPA fallback 설정
├─ capacitor.config.ts              # 모바일 앱 설정
├─ .env / .env.local / .env.local.test
└─ README.md / README_IAP_TESTING.md
```

---

## 5. 의존성 목록 (`package.json`)

### 5.1 런타임 dependencies (핵심만 발췌)

| 패키지 | 버전 | 역할 |
|---|---|---|
| `react` / `react-dom` | 18.3.1 | UI 프레임워크 |
| `react-router-dom` | 6.30.1 | SPA 라우팅 |
| `@supabase/supabase-js` | 2.101.1 | Supabase JS 클라이언트 |
| `@tanstack/react-query` | 5.83.0 | 서버 상태 캐싱 (관리자 페이지 위주 사용) |
| `@paddle/paddle-js` | 1.6.2 | Paddle 결제 오버레이 |
| `@revenuecat/purchases-capacitor` | 12.3.2 | iOS/Android IAP 추상화 |
| `@capacitor/core` / `android` / `ios` / `app` | 8.3.0 | 모바일 네이티브 래퍼 |
| `@capacitor/cli` | 7.6.1 | Capacitor CLI |
| `@lovable.dev/cloud-auth-js` | 1.0.1 | Lovable 클라우드 인증 (현재 사용 미확인) |
| `@radix-ui/react-*` | 1.x ~ 2.x | shadcn/ui 기반 헤드리스 프리미티브 (30+ 패키지) |
| `vexflow` | 5.0.0 | 오선지 렌더링 (SVG) |
| `abcjs` | 6.6.2 | ABC notation → 악보 변환 |
| `tone` | 15.1.22 | Web Audio 기반 사운드 합성 |
| `recharts` | 2.15.4 | 통계 차트 (XP 막대, 정확도 라인) |
| `lucide-react` | 0.462.0 | 아이콘 (SVG) |
| `react-hook-form` | 7.61.1 | 폼 상태 관리 |
| `@hookform/resolvers` | 3.10.0 | RHF + zod 통합 |
| `zod` | 3.25.76 | 런타임 스키마 검증 (`src/lib/nicknameValidation.ts` 등) |
| `react-markdown` | 10.1.0 | 마크다운 렌더링 |
| `remark-gfm` | 4.0.1 | GitHub Flavored Markdown 확장 |
| `date-fns` | 3.6.0 | 날짜 포매팅 (한국어 로케일) |
| `tailwind-merge` | 2.6.0 | Tailwind 클래스 충돌 해결 |
| `class-variance-authority` | 0.7.1 | 변형 클래스 빌더 (shadcn 기본) |
| `clsx` | 2.1.1 | 조건부 클래스 |
| `tailwindcss-animate` | 1.0.7 | shadcn 애니메이션 유틸 |
| `sonner` | 1.7.4 | 토스트 알림 |
| `next-themes` | 0.3.0 | 테마 토글 |
| `cmdk` | 1.1.1 | 커맨드 팔레트 |
| `embla-carousel-react` | 8.6.0 | 캐러셀 |
| `react-day-picker` | 8.10.1 | 달력 입력 |
| `react-resizable-panels` | 2.1.9 | 분할 패널 |
| `input-otp` | 1.4.2 | OTP 입력 |
| `vaul` | 0.9.9 | 드로어 |

### 5.2 devDependencies (테스트·빌드 도구)

| 패키지 | 버전 | 역할 |
|---|---|---|
| `vite` | 5.4.19 | 번들러·dev 서버 |
| `@vitejs/plugin-react-swc` | 3.11.0 | React SWC 트랜스파일 |
| `vitest` | 3.2.4 | 테스트 러너 |
| `@testing-library/react` | 16.0.0 | React 컴포넌트 테스트 |
| `@testing-library/jest-dom` | 6.6.0 | DOM 매처 확장 |
| `@testing-library/user-event` | 14.6.1 | 사용자 이벤트 시뮬레이션 |
| `jsdom` | 20.0.3 | 가상 DOM |
| `@playwright/test` | 1.57.0 | E2E 테스트 (현재 0개 — `docs/06_TESTING.md`) |
| `typescript` | 5.8.3 | TS 컴파일 |
| `eslint` + `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` | latest | 코드 검사 |
| `tailwindcss` + `@tailwindcss/typography` + `autoprefixer` + `postcss` | latest | CSS 빌드 파이프라인 |
| `lovable-tagger` | 1.1.13 | Lovable 개발 모드 컴포넌트 태깅 (`vite.config.ts:20`) |
| `@types/node` / `@types/react` / `@types/react-dom` | latest | 타입 정의 |

---

## 6. 환경변수 목록

### 6.1 클라이언트 (`.env`, Vite 빌드 시 주입 — `VITE_` 접두사)

| 변수명 | 현재 값 (Sandbox) | 용도 |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://rcwydfzkuhfcnnbqjmpp.supabase.co` | Supabase 프로젝트 엔드포인트 (※ `vite.config.ts:17-18`에 하드코딩되어 있어 .env 값은 무시됨 — 보안 회전 시 코드도 수정 필요) |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Supabase 익명 키 (RLS로 보호) |
| `VITE_PADDLE_ENVIRONMENT` | `sandbox` | Paddle 환경 — 출시 시 `production`으로 |
| `VITE_PADDLE_CLIENT_TOKEN` | `test_9ec2c7a8...` | Paddle 클라이언트 토큰 — 출시 시 `live_*` |
| `VITE_PADDLE_PRICE_MONTHLY` | `pri_01kpk2kf6f08bjhwvjhcn42rnw` | 월간 구독 Price ID |
| `VITE_PADDLE_PRICE_YEARLY` | `pri_01kpk2qw52waj1c56j4y7xf6c9` | 연간 구독 Price ID |

### 6.2 로컬 토글 (`.env.local`)

| 변수명 | 값 | 용도 |
|---|---|---|
| `VITE_GAME_ENABLED` | `true` (로컬 개발) / `false` (Vercel 프로덕션) | Coming Soon 모드 토글 — `false`이면 게임/결제 라우트가 `/`로 리다이렉트 (`src/components/ComingSoonGate.tsx:10`) |

### 6.3 IAP/Edge Function 테스트용 (`.env.local.test`)

| 변수명 | 용도 |
|---|---|
| `SUPABASE_FN_URL` | 로컬 함수 엔드포인트 (`http://127.0.0.1:54321/...`) |
| `SUPABASE_ANON_KEY` / `SUPABASE_JWT` | 테스트 사용자 인증 |
| `TEST_USER_ID` | 합성 영수증 검증용 사용자 UUID |
| `REVENUECAT_WEBHOOK_AUTH` | RevenueCat 웹훅 Bearer 토큰 |
| `IAP_TEST_MODE` | `true` 시 합성 영수증(TEST_VALID/REFUND/INVALID 접두사) 허용 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Edge Function 런타임용 (서비스 롤 키) |
| `APPLE_SHARED_SECRET` / `APPLE_BUNDLE_ID` | iOS receipt 검증 |
| `GOOGLE_PACKAGE_NAME` / `GOOGLE_SERVICE_ACCOUNT_JSON` | Android purchaseToken 검증 |

> 🔗 IAP 검증 로컬 실행 가이드: `README_IAP_TESTING.md`

### 6.4 출시 시 환경변수 전환 체크리스트 (`docs/PENDING_BACKLOG.md §11`)

```
[ ] VITE_PADDLE_ENVIRONMENT     sandbox     → production
[ ] VITE_PADDLE_CLIENT_TOKEN    test_*      → live_*
[ ] VITE_PADDLE_PRICE_MONTHLY   sandbox ID  → production ID
[ ] VITE_PADDLE_PRICE_YEARLY    sandbox ID  → production ID
[ ] VITE_SUPABASE_ANON_KEY      회전        (채팅 노출 이력)
[ ] VITE_GAME_ENABLED           false       → true (Coming Soon 해제)
```

---

## 7. 주요 npm 스크립트 (`package.json:6-18`)

| 스크립트 | 동작 |
|---|---|
| `npm run dev` | Vite 개발 서버 (`http://localhost:8080`) |
| `npm run build` | 프로덕션 빌드 (`dist/`) |
| `npm run build:dev` | 개발 모드 빌드 (lovable-tagger 포함) |
| `npm run preview` | 빌드 산출물 미리보기 |
| `npm run lint` | ESLint 실행 |
| `npm test` | Vitest 1회 실행 |
| `npm run test:watch` | Vitest watch 모드 |
| `npm run cap:sync` | 모바일 앱 동기화 (`npm run build && npx cap sync`) |
| `npm run cap:open:android` / `cap:open:ios` | 네이티브 IDE 열기 |
| `npm run iap:test` | IAP 검증 함수 로컬 테스트 (`scripts/test-iap-verification.sh`) |

---

## 8. 다음 문서 안내

- 시스템 구조·라우팅·hook 의존성 → `docs/02_ARCHITECTURE.md`
- 21단계·retry queue·가중치 출제 → `docs/03_GAME_LOGIC.md`
- 테이블·RLS·SQL 함수 → `docs/04_DB_SCHEMA.md`
- 사용자 관점 기능 카탈로그 → `docs/05_FEATURES.md`
- 테스트 현황과 갭 분석 → `docs/06_TESTING.md`
- 배포·도메인·환경변수 운영 → `docs/07_DEPLOYMENT.md`
- 미구현 백로그·결정 보류 항목 → `docs/PENDING_BACKLOG.md`
