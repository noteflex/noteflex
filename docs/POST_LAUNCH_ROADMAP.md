# Noteflex 출시 후 로드맵

**최초 작성:** 2026-05-31 (가오픈 출시일)  
**갱신 주기:** 매주 일요일 진척 마킹  
**PENDING_BACKLOG.md와 관계:** 발견된 항목은 PENDING에 누적 → 우선순위·일정·진척은 이 문서에서 추적

---

## 🔴 긴급 (출시 직후 24~48시간)

| # | 작업 | 분량 | 상태 |
|---|---|---|---|
| 1 | **RLS 정상화 (premium_waitlist)** — 가오픈에서 비활성. anon 이메일 조회 가능 = 보안 위험. is_admin() 함수 정확한 이름·schema 확인 후 RLS 재활성 | 30분 | ⏳ |
| 2 | **Supabase SMTP 정상화** — Google OAuth 외 사용자 가입 차단 중. Supabase Logs 진단 → 외부 SMTP (Resend·SendGrid·AWS SES) 셋업 → EMAIL_AUTH_ENABLED=true 복원 | 1~2시간 | ⏳ |
| 3 | **첫 24시간 모니터링** — Sentry Issues · Vercel Analytics · Supabase Auth 신규 가입 · premium_waitlist 추적 | 매일 30분 | ⏳ |
| 4 | **iOS 한국어 검증** — VPN 끄고 시크릿 창에서 한국어 표시 확인 (가오픈 검증 시 영어만 봤음) | 5분 | ⏳ |

---

## 🟡 단기 (이번 주)

| # | 작업 | 분량 | 상태 |
|---|---|---|---|
| 5 | **Paddle 심사 follow-up** — 6/5 금까지 답 없으면 Paddle 대시보드 → Support → Ticket 직접 열기 (5/27 메일 발송) | 30분 | ⏳ |
| 6 | **Paddle 통과 시 활성** — PAYMENT_LOCKED=false + 환경변수 4개 (ENV·CLIENT_TOKEN·PRICE_MONTHLY·PRICE_YEARLY) + waitlist 사용자 알림 발송 | 1~2시간 | ⏳ |
| 7 | **AdSense 통과 시 활성** — Vercel 환경변수 15개 추가 (VITE_ADS_ENABLED=true · VITE_INFEED_ADS_ENABLED=true · VITE_ADSENSE_PUBLISHER_ID · VITE_ADSENSE_SLOT_* 12개) + Redeploy + cookie consent 정교화 | 1~2시간 | ⏳ |
| 8 | **AuthModal 테스트 sprint** — SMTP hotfix + i18n 변경으로 39/45 fail. SMTP 정상화 + EMAIL_AUTH_ENABLED=true 복원 시점에 ko/en 둘 다 검증 가능하도록 재작성 | 2~3시간 | ⏳ |
| 9 | **모바일 게임 layout 재조정** — Pixel 7 등 세로 디바이스 콘텐츠 아래 빈 공간 큼. min-h-[100dvh] + flex justify-center 또는 하단 보조 정보 추가 | 1~2시간 | ⏳ |
| 10 | **vitest 풀 스위트 OOM 해소** — --max-old-space-size=8192 + --pool=forks --poolOptions.forks.singleFork 후보 | 1시간 | ⏳ |
| 11 | **블로그 일일 작성** — SEO 누적 (ko + en 1쌍/일) | 매일 1~2시간 | 🔄 |

---

## 🟢 중기 (2~4주)

| # | 작업 | 분량 | 상태 |
|---|---|---|---|
| 12 | **사용자 행동 분석** — Vercel Analytics 데이터 보고 funnel·이탈·retention 분석 | 매주 1~2시간 | ⏳ |
| 13 | **모바일 햄버거 (Navigation Sub-step 4)** — 데이터 보고 진짜 필요한지 결정. 만들면 Radix Sheet 슬라이드 패널 | 2~3시간 | ⏳ |
| 14 | **focus_mode 출제 로직 통합** — 현재 enum만, 로직 X | 3~4시간 | ⏳ |
| 15 | **weak_score v2 엔진 DB 적용** — 마이그레이션 | 2시간 | ⏳ |
| 16 | **7판 윈도우 시스템 후속 테스트 재작성** — LevelSelect · MasteryScoreCard · levelSystem | 2~3시간 | ⏳ |
| 17 | **Dead code 정리** — AICoachingDetail.tsx · MiniStaff/StaffDisplay · vexflow 의존성 제거 | 1시간 | ⏳ |
| 18 | **SEO 모니터링** — Google Search Console 인덱싱 · 검색어 · CTR 분석 | 주간 30분 | 🔄 |

---

## 🔵 장기 (1~3개월)

| # | 작업 |
|---|---|
| 19 | **자체 visit_logs 시스템** — Vercel Analytics 보완 (퍼널·코호트 분석, admin 페이지 통합, 게임 join 가능) |
| 20 | **Edge Glow 콤보 효과** — 콤보 시스템 도입 후 |
| 21 | **Hybrid 음표 변화** — particle effect, 모바일 성능 검증 |
| 22 | **대시보드 음표 오선지 시각화** |
| 23 | **vercel.json max-w-* 통일** — 페이지 너비 일관 |
| 24 | **LangToggle 헤더 마운트 재검토** — ja·zh 언어 추가 시 |
| 25 | **backup 테이블 3개 삭제** — 안정 확인 후 |
| 26 | **SW kill switch** — 영구 SW 깨짐 대비 |
| 27 | **자체 visit_logs 시스템** (출시 후 3~6개월차) |

---

## 📋 내일 (6/1 월) 시작 최우선 3개

1. **RLS 정상화** (보안) — 30분
2. **iOS 한국어 검증** + 24시간 데이터 확인 — 30분
3. **SMTP 진단** — Supabase Logs 확인 후 외부 SMTP 셋업 결정 — 1~2시간

이 3개 끝나면 출시 안정성 확보.

---

## 우선순위 원칙

1. **사용자가 진짜 보는 것** (UX·보안·결제) > 코드 정리·기능 추가
2. **데이터 보고 결정** — 모바일 햄버거·자체 visit_logs 같은 큰 작업은 사용자 행동 데이터 보고 진짜 필요한지 판단 후
3. **외부 의존성** (Paddle·AdSense) — 통과 시점에 즉시 활성하면 수익 시작
4. **테스트 sprint** — 코드 안정성 + 향후 변경 회귀 방지

---

## 상태 마킹 규칙

- ⏳ 시작 전
- 🔄 진행 중 (반복 작업)
- ✅ 완료
- ⛔ 중단/취소 (사유 메모)

매주 일요일 진척 갱신. 완료 항목은 상태만 ✅로 변경하고 라인은 유지 (히스토리 추적).
