# 07. 배포 + 인프라

> **작성일**: 2026-04-28
> **선행 자료**: `docs/01_OVERVIEW.md` (기술 스택), `docs/04_DB_SCHEMA.md` (Supabase)

---

## 1. 배포 전체 그림

```
┌────────────────────────────────────────────────────────────────────────┐
│  Git push (origin/main)                                                │
└─────────────┬──────────────────────────────────────────────────────────┘
              ▼
┌─────────────────────────────────────┐    ┌──────────────────────────────┐
│  Vercel (자동 빌드 + 배포)           │    │  Porkbun DNS                 │
│  - vite build                        │◄───┤  noteflex.app A/CNAME레코드   │
│  - dist/ 정적 자산 호스팅            │    └──────────────────────────────┘
│  - SPA fallback (vercel.json)        │
└─────────────────────────────────────┘
              │ HTTPS
              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  사용자 브라우저 (React SPA)                                            │
│   ↓ 환경변수 (VITE_*) 빌드 타임 주입                                    │
│   ↓ Supabase 호출 / Paddle Checkout                                     │
└─────────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐    ┌──────────────────────────────┐
│  Supabase (rcwydfzkuhfcnnbqjmpp)     │◄───┤  Paddle Webhook              │
│  - PostgreSQL + RLS                  │    │  (외부 → Edge Function)      │
│  - Auth (Google OAuth, email/pw)     │    └──────────────────────────────┘
│  - Edge Functions (Deno, 6개)        │
│  - Realtime (WebSocket)              │
└─────────────────────────────────────┘
```

---

## 2. Vercel (호스팅 + 빌드)

### 2.1 빌드 설정

| 항목 | 값 |
|---|---|
| Build Command | `npm run build` (= `vite build`) |
| Output Directory | `dist/` |
| Install Command | `npm install` |
| Node Version | (Vercel 기본 — Node 20 LTS 권장) |
| Framework Preset | `Vite` (자동 감지) |

### 2.2 SPA Fallback (`vercel.json`)

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- 모든 경로를 `index.html`로 rewrite → 새로고침 시에도 React Router 유지
- API 라우트 없음 — 백엔드는 모두 Supabase

### 2.3 Vercel 환경변수 (Production)

Vercel Dashboard → Project Settings → Environment Variables 에서 관리.

**현재 (Sandbox 모드)**:

| 키 | 값 | 비고 |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://rcwydfzkuhfcnnbqjmpp.supabase.co` | ⚠️ `vite.config.ts:17`에 하드코딩되어 빌드 시 무시됨 |
| `VITE_SUPABASE_ANON_KEY` | (긴 JWT) | ⚠️ 동일하게 하드코딩 |
| `VITE_PADDLE_ENVIRONMENT` | `sandbox` | |
| `VITE_PADDLE_CLIENT_TOKEN` | `test_9ec2c7a8...` | |
| `VITE_PADDLE_PRICE_MONTHLY` | `pri_01kpk2kf6f08bjhwvjhcn42rnw` | |
| `VITE_PADDLE_PRICE_YEARLY` | `pri_01kpk2qw52waj1c56j4y7xf6c9` | |
| `VITE_GAME_ENABLED` | `false` | Coming Soon 모드 |

> ⚠️ **하드코딩 이슈**: `vite.config.ts:16-19`에서 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`를 `define`으로 강제 주입한다. Vercel 환경변수는 무시됨. Supabase 키 회전 시 **코드도 같이 수정** 필요.

### 2.4 자동 배포 흐름

1. `git push origin main` → Vercel 웹훅 트리거
2. Vercel: `npm install` → `npm run build` → `dist/` 업로드
3. CDN 글로벌 배포 (~30초~1분)

> 📌 **빌드 가드 없음**: `npm test` / `npm run lint` 자동 실행되지 않음 — `docs/06_TESTING.md §7` 참조.

### 2.5 Preview 배포

PR / 브랜치 push 시 Vercel이 자동 preview URL 생성 — `*.vercel.app`.

---

## 3. 도메인 (DNS)

### 3.1 메인 도메인

| 항목 | 값 |
|---|---|
| 도메인 | **`noteflex.app`** |
| 등록기관 | **Porkbun** |
| DNS 호스팅 | Porkbun (또는 Vercel — 코드에서 확인 필요) |
| 연결 방식 | Vercel 표준 (A/CNAME 레코드 또는 Vercel Nameserver) |

### 3.2 출시 시 도메인 체크리스트

- [ ] `noteflex.app` A/AAAA/CNAME → Vercel
- [ ] `www.noteflex.app` → Apex로 리다이렉트 (또는 동일 배포 연결)
- [ ] SSL 인증서 활성화 (Vercel 자동)
- [ ] Paddle 등록 도메인 일치 확인
- [ ] Supabase Auth Redirect URL 등록 (`https://noteflex.app/**`)

### 3.3 펜딩 — 도메인 이메일

`docs/PENDING_BACKLOG.md §9.1`:

- 🔴 `support@noteflex.app`, `tax@noteflex.app`, `admin@noteflex.app`
- Google Workspace 또는 Cloudflare Email Routing 사용 예정
- 약관·법적 문서·Paddle Vendor 등록 시 필요

---

## 4. Supabase (백엔드)

### 4.1 환경

| 항목 | 값 |
|---|---|
| Project Ref | `rcwydfzkuhfcnnbqjmpp` |
| URL | `https://rcwydfzkuhfcnnbqjmpp.supabase.co` |
| Region | (Supabase Dashboard 확인 필요) |
| Plan | (Free / Pro — 확인 필요) |

### 4.2 마이그레이션 운영

**현재 방식**: 로컬 SQL 파일을 Supabase Studio나 CLI로 수동 적용.

```
supabase/migrations/
  ├─ 20260404142430_*.sql        # user_custom_scores
  ├─ 20260405142021_*.sql        # user_note_logs
  ├─ ...
  └─ 20260425_sublevel_system.sql # user_sublevel_progress
```

> ⚠️ **스키마 표류 위험**: `note_mastery`, `daily_batch_runs`, `subscriptions`, `user_streaks`, `admin_actions`, `user_sessions` 테이블은 **마이그레이션에 정의 없음**. Supabase Studio에서 생성된 채로 운영 중.
>
> 출시 전 정리:
> - [ ] Supabase Studio에서 모든 테이블·함수·트리거 SQL을 추출 → migrations 폴더에 추가
> - [ ] `is_admin()`, `check_nickname_available()` 함수 정의 추가
> - [ ] 신규 환경 셋업 시나리오 검증 (`supabase db reset` → 모든 테이블 재생성)

### 4.3 RLS 정책 운영

- 클라이언트는 anon key + JWT로만 접근 → RLS가 1차 방어선
- service_role 키는 Edge Function에서만 사용 (관리자 액션, 결제 처리)
- 키 노출 시 즉시 회전 (`docs/PENDING_BACKLOG.md §11`: `VITE_SUPABASE_ANON_KEY 회전`)

### 4.4 Edge Functions 배포

```bash
supabase functions deploy admin-action
supabase functions deploy paddle-webhook
supabase functions deploy verify-iap-receipt
supabase functions deploy analyze-sheet-music
```

각 함수의 환경변수 (Supabase Dashboard → Edge Functions → Secrets):

| 함수 | 필요 Secrets |
|---|---|
| `admin-action` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `paddle-webhook` | `PADDLE_WEBHOOK_SECRET` (HMAC 키), `VITE_PADDLE_PRICE_MONTHLY/YEARLY` |
| `verify-iap-receipt` | `APPLE_SHARED_SECRET`, `APPLE_BUNDLE_ID`, `GOOGLE_PACKAGE_NAME`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `REVENUECAT_WEBHOOK_AUTH`, `IAP_TEST_MODE`, `SUPABASE_SERVICE_ROLE_KEY` |
| `analyze-sheet-music` | `LOVABLE_AI_API_KEY` (또는 동등 키 — 코드 확인 필요), `SUPABASE_SERVICE_ROLE_KEY` |

### 4.5 Realtime publication

`user_note_logs` 테이블만 publication에 등록됨. 실시간 학습 로그 스트리밍 가능.

---

## 5. Paddle (결제)

### 5.1 현재 환경 (Sandbox)

| 항목 | 값 |
|---|---|
| Environment | `sandbox` |
| Vendor | (확인 필요) |
| Client Token | `test_9ec2c7a8...` |
| Monthly Price | `pri_01kpk2kf6f08bjhwvjhcn42rnw` ($2.99/월) |
| Yearly Price | `pri_01kpk2qw52waj1c56j4y7xf6c9` (가격 미정) |
| Webhook URL | `https://rcwydfzkuhfcnnbqjmpp.supabase.co/functions/v1/paddle-webhook` |
| HMAC 검증 | `Paddle-Signature: ts=...;h1=...` 헤더 |

### 5.2 Production 전환 절차

`docs/PENDING_BACKLOG.md §11` + `§9.2`:

1. **사업자 등록**: Leo Republic 활용 (한국 사업자), Paddle Vendor 신청 (출시 핵심 의존성).
2. **Production Vendor 활성화** + 도메인 등록 (`noteflex.app`).
3. **Production 상품 생성**:
   - Monthly $2.99
   - Yearly (할인율 결정 후)
4. **새 Price ID 받음**.
5. **Vercel 환경변수 갱신**:
   - `VITE_PADDLE_ENVIRONMENT=production`
   - `VITE_PADDLE_CLIENT_TOKEN=live_*`
   - `VITE_PADDLE_PRICE_MONTHLY=pri_*` (production)
   - `VITE_PADDLE_PRICE_YEARLY=pri_*` (production)
6. **Supabase Edge Function Secrets 갱신**:
   - `PADDLE_WEBHOOK_SECRET=...` (Production 비밀)
   - 위 Price ID 동기화
7. **Webhook 엔드포인트 등록** (Paddle Dashboard).
8. **테스트 결제** 1회 실행 → `subscriptions` 테이블, `profiles.is_premium` 확인.

### 5.3 RevenueCat (Mobile IAP)

| 항목 | 값 |
|---|---|
| 패키지 | `scan_pack_10` (10 credits), `scan_pack_30` (30 credits) |
| 검증 함수 | `verify-iap-receipt` |
| 웹훅 인증 | Bearer 토큰 (`REVENUECAT_WEBHOOK_AUTH`) |

> 📌 출시 시 RevenueCat 대시보드에서 Production 키로 전환.

---

## 6. 환경변수 운영 매트릭스

### 6.1 클라이언트 빌드 타임 (`VITE_*`)

| 변수 | 로컬 (.env) | Vercel Sandbox | Vercel Production |
|---|---|---|---|
| `VITE_SUPABASE_URL` | (`vite.config.ts` 하드코딩 — .env 무시) | 동일 | 회전 후 코드 수정 |
| `VITE_SUPABASE_ANON_KEY` | 동일 | 동일 | 회전 후 코드 수정 |
| `VITE_PADDLE_ENVIRONMENT` | sandbox | sandbox | **production** |
| `VITE_PADDLE_CLIENT_TOKEN` | test_* | test_* | **live_*** |
| `VITE_PADDLE_PRICE_MONTHLY` | sandbox ID | sandbox ID | **production ID** |
| `VITE_PADDLE_PRICE_YEARLY` | sandbox ID | sandbox ID | **production ID** |
| `VITE_GAME_ENABLED` (`.env.local`) | true | **false** (Coming Soon) | **true** (출시 시) |

### 6.2 Supabase Edge Functions Secrets

| 변수 | 용도 |
|---|---|
| `SUPABASE_URL` | 함수 내 클라이언트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | RLS 우회 (관리자/결제 처리) |
| `PADDLE_WEBHOOK_SECRET` | HMAC 검증 |
| `APPLE_SHARED_SECRET` / `APPLE_BUNDLE_ID` | iOS receipt 검증 |
| `GOOGLE_PACKAGE_NAME` / `GOOGLE_SERVICE_ACCOUNT_JSON` | Android purchaseToken 검증 |
| `REVENUECAT_WEBHOOK_AUTH` | RevenueCat 웹훅 Bearer |
| `IAP_TEST_MODE` | 테스트 영수증 허용 (Production은 false) |
| `LOVABLE_AI_API_KEY` (추정) | 악보 OCR (Gemini 호출) |

### 6.3 IAP 로컬 테스트 (`.env.local.test`)

`README_IAP_TESTING.md` 가이드 참고. `npm run iap:test` 실행.

---

## 7. 모바일 앱 (Capacitor)

### 7.1 설정 (`capacitor.config.ts`)

```ts
{
  appId: "com.domisol.app",
  appName: "Domisol",
  webDir: "dist",
  bundledWebRuntime: false,
  plugins: { App: { launchUrl: "domisol://" } },
}
```

### 7.2 빌드 절차

```bash
npm run build           # 웹 빌드
npx cap sync            # dist/ → android/ios 동기화
npm run cap:open:android  # Android Studio 열기
npm run cap:open:ios      # Xcode 열기
```

### 7.3 출시 절차

- Google Play Console 업로드 (`com.domisol.app`)
- Apple App Store Connect 업로드
- IAP 상품 등록 (`scan_pack_10`, `scan_pack_30`)
- RevenueCat 연결

> 📌 현재 `ios/` 디렉토리 없음 — iOS 빌드 미시작 (확인 필요).

---

## 8. 출시 플로우 (Coming Soon → 실서비스)

### 8.1 사전 준비 (출시 1주 전)

- [ ] 한국 사업자 등록 완료 (Leo Republic)
- [ ] Paddle Production Vendor 승인
- [ ] 약관 4종 본문 확정 (변호사 자문 — `PENDING_BACKLOG.md §10.1`)
- [ ] 도메인 이메일 발급 (`support@noteflex.app` 등)
- [ ] AdSense 심사용 블로그 글 2~3편 게시
- [ ] Supabase 마이그레이션 정리 (외부 정의 테이블 SQL 추출)
- [ ] `vite.config.ts` 하드코딩 Supabase 키 회전 + 코드 수정 + 동기화

### 8.2 출시 D-1

- [ ] `docs/06_TESTING.md §9` 🔴 항목 처리 (실패 케이스 수정, CI 도입)
- [ ] 부하 테스트 (k6) — `PENDING_BACKLOG.md §7.5`
- [ ] Sentry 도입 (`§12.1`)
- [ ] 환경변수 동기화 (Vercel + Supabase Functions)

### 8.3 출시 당일

```
1. Vercel 환경변수 변경 (모두 한 번에):
   [ ] VITE_PADDLE_ENVIRONMENT     sandbox    → production
   [ ] VITE_PADDLE_CLIENT_TOKEN    test_*     → live_*
   [ ] VITE_PADDLE_PRICE_MONTHLY   sandbox    → production ID
   [ ] VITE_PADDLE_PRICE_YEARLY    sandbox    → production ID
   [ ] VITE_SUPABASE_ANON_KEY      회전        (채팅 노출 이력)
   [ ] VITE_GAME_ENABLED           false      → true   ← Coming Soon 해제

2. Supabase Edge Functions Secrets 갱신:
   [ ] PADDLE_WEBHOOK_SECRET       live secret
   [ ] IAP_TEST_MODE               false

3. Vercel 재배포 트리거 (환경변수 변경만으로 자동 재빌드 됨)

4. 출시 확인:
   [ ] noteflex.app 메인 → 게임 진입 가능
   [ ] /pricing → 결제 시도 → 실제 카드 결제 1회 → 환불 처리
   [ ] /admin/users → 결제한 사용자 is_premium=true 확인
   [ ] /admin/batch-runs → 수동 실행 → daily_batch_runs 기록
   [ ] /admin/logs → 액션 로그 정상 기록
```

### 8.4 출시 직후 모니터링

- Vercel Analytics (트래픽)
- Supabase Dashboard (DB 부하, RLS 거부, Function 호출 수)
- Paddle Dashboard (결제 성공률, 취소율)
- 사용자 피드백 채널 (이메일, SNS DM)

---

## 9. 롤백 전략

### 9.1 코드 롤백

```bash
git revert <commit>
git push origin main
# Vercel 자동 재배포
```

또는 Vercel 대시보드에서 이전 배포로 즉시 롤백 가능.

### 9.2 Coming Soon 모드 즉시 활성화

```
Vercel: VITE_GAME_ENABLED = false
→ 자동 재빌드 → 게임/결제 라우트 차단
```

배포에 ~1분 소요. 이미 진입한 사용자도 다음 라우트 변경 시 차단됨.

### 9.3 Edge Function 롤백

```bash
git checkout <prev_commit> -- supabase/functions/<name>/
supabase functions deploy <name>
```

### 9.4 DB 마이그레이션 롤백

⚠️ **위험** — DROP은 데이터 손실. 출시 전후로는 forward-only 마이그레이션 + soft delete 권장.

---

## 10. 모니터링·관측성 (현황 + 펜딩)

| 항목 | 현황 | 비고 |
|---|---|---|
| 로깅 | ❌ `console.log` 만 | Vercel Logs / Supabase Function Logs로 일부 확인 가능 |
| 에러 추적 | ❌ Sentry 미도입 | `PENDING_BACKLOG.md §12.1` |
| 메트릭 | ❌ | 향후 Grafana 또는 Vercel Analytics |
| 알림 | ❌ | (이메일 알림 등) |
| 부하 테스트 | ❌ | k6 계획 (`§7.5`) |

> 🔴 출시 전 Sentry 도입은 강력 권장 — 결제 실패·DB 권한 거부·Edge Function 에러 가시성 확보.

---

## 11. 보안 체크리스트

- [x] RLS 모든 테이블 활성화 (확인된 테이블만)
- [x] Edge Function service_role 키 사용 시 JWT 검증 선행 (`admin-action`)
- [x] Paddle 웹훅 HMAC 검증
- [x] RevenueCat 웹훅 Bearer 검증
- [ ] CSP 헤더 설정 (Vercel)
- [ ] CORS 정책 명시 (Edge Functions)
- [ ] 비밀키 회전 (`VITE_SUPABASE_ANON_KEY` 채팅 노출 이력 — 출시 전 회전 필수)
- [ ] 외부 의존 라이브러리 보안 audit (`npm audit`)
- [ ] Edge Function rate limiting (`analyze-sheet-music` 등 비용 발생 함수)

---

## 12. 비용 구조 (참고)

| 서비스 | 플랜 | 예상 |
|---|---|---|
| Vercel | Hobby (무료) → 출시 후 Pro 검토 | $0 ~ $20/월 |
| Supabase | Free → 출시 후 Pro ($25/월) | DB 8GB, 50K MAU |
| Paddle | 5% + 50¢/거래 | 거래 비례 |
| RevenueCat | Free (월 $10K MTR 미만) | $0 |
| Lovable AI Gateway | (사용량 기반) | 악보 OCR 호출당 |
| 도메인 | Porkbun `noteflex.app` | ~$10~30/년 |

> 📌 정확한 가격은 각 서비스 대시보드에서 확인.

---

## 13. 운영 핸드북 (요약)

| 상황 | 액션 |
|---|---|
| 게임 긴급 차단 | Vercel `VITE_GAME_ENABLED=false` |
| Supabase 키 노출 | Studio에서 anon key 회전 + `vite.config.ts` 수정 + 재배포 |
| Paddle 결제 장애 | `subscriptions` 테이블 확인 → `paddle-webhook` 로그 확인 → 수동 재처리 |
| 사용자 환불 요청 | Paddle Dashboard에서 환불 → 웹훅이 자동 처리 (확인 필요) |
| 일일 배치 실패 | `/admin/batch-runs` → 수동 실행 → 로그 확인 |
| Edge Function 에러 | Supabase Dashboard → Edge Functions → Logs |
| DB 마이그레이션 | 새 SQL 파일 추가 → Supabase Studio 실행 → migrations 폴더 커밋 |

---

## 14. 펜딩 인프라 항목 (`docs/PENDING_BACKLOG.md §12`)

- 🟡 Sentry 도입 (출시 직전)
- 🟡 E2E 테스트 (Playwright) — 가입 → 게임 → 결제
- 🟡 payment-webhook Edge Function 구현 완료 + 보안 점검
- 🟡 mastery DB 부하 모니터링 (출시 후 100~1000 DAU 시점)
- 🟡 Lv 7-3 3초 제한 검토 (베타 데이터 기반)
- 🟡 옵션 B 블로그 시스템 (`/admin/blog`)

---

## 15. 결론

**현재 인프라 성숙도**: 🟡 중간

- 🟢 코어 (Vercel + Supabase + Paddle/IAP) 통합 동작
- 🟡 자동화 (CI/CD, 모니터링) 미흡
- 🔴 스키마 표류, 키 회전, E2E 부재

**출시 전 1순위 정비**:
1. 마이그레이션 스키마 정리 (외부 테이블 SQL 추출)
2. Supabase 키 회전 + `vite.config.ts` 수정
3. Sentry 도입
4. CI 파이프라인 (GitHub Actions)
5. 환경변수 일괄 갱신 + 결제 검증

이 단계를 통과하면 안정적 출시가 가능하다.

---

(여기서 7개 문서 완료 — `docs/00_INDEX.md`로 돌아가기)
