# Noteflex 세션 로그

> **운영 원칙**: 1개 파일에 모든 세션 누적. 시간 역순 (최신 위). 매 세션 마무리 시 Claude Code가 작성.

---

## 2026-06-14

### 결제: Paddle → Creem 전환 + 라이브 전환 완료
- provider를 Paddle에서 Creem으로 교체(Paddle 휴면). subscriptions·sync_premium_status 트리거·expire cron 재사용(paddle_* 컬럼에 Creem 값 매핑: customer_id=cust_, subscription_id=sub_, price_id=product_id). Premium 권위 source=profiles.is_premium.
- Edge Function 3개: creem-checkout / creem-webhook(creem-signature HMAC 검증) / creem-customer-portal.
- Test Mode 디버깅 4건: webhook 401(--no-verify-jwt + config.toml) / premium_until null(Creem 페이로드 필드명 방어 파싱) / 취소 시 즉시 회수→기간말 취소로 정정(current_period_end 미래면 status=active + cancel_at_period_end=true) / portal redirect(customer_portal_link).
- 라이브 전환 완료: Live 상품 2개(monthly prod_7DZuT8doea5sgIEgWABuys / yearly prod_6KVISEXWb7hs2JxWgFYIW9), Live API 키, Live webhook(13 이벤트 구독), Supabase secret 4개 교체, PAYMENT_LOCKED=false.
- 라이브 검증 3경로 통과: 결제→is_premium 활성(+Creem First Sale 메일) / 기간말 취소→만료일까지 유지 / 환불→is_premium 즉시 회수.
- refund 핸들러 보강: 기존엔 profiles.is_premium만 회수하고 subscriptions row가 status=active로 stale 남아, 트리거 재발동 시 is_premium 부활 위험이 있었음. refund.created·dispute.created 시 subscriptions.status='refunded' + current_period_end=now() + canceled_at=now()로 UPDATE하고, is_premium 회수는 on_subscription_change 트리거에 일임(단일 경로). 대상 구독 미식별 시 profiles 직접 회수 폴백. 스키마 검증(canceled_at 컬럼 존재, 트리거 AFTER INSERT OR UPDATE로 무조건 발화)으로 재결제 없이 코드 리뷰 갈음.
- 커밋: d0ec6a2, cfd3e84, c9b53ec, 037c69e, d3521e8(Creem) / ed2ab2d(잠금 해제) / 4f1031e(refund 보강).

### 보고서: 과거 보고서 다시 보기
- 백엔드(20260613_report_history_rpc, apply 완료): is_pro() 헬퍼, get_daily/weekly/monthly_report 과거 기간 Pro 가드, list_report_periods 신규. 거부=pro_required(42501→403).
- 프론트: PeriodSelector 신규(rose pill 칩 + 원형 화살표 + 드롭다운). useWeekly/MonthlyReport를 직접 SELECT에서 RPC 호출로 통일. 디폴트=직전 완료 기간(기존 "이번주" SELECT는 rollup 미존재라 항상 no_data였던 버그도 해소).
- 잠금 동작 수정: 셀렉터 lock 클릭 시 대시보드 이탈(navigate) 제거→페이지 유지 + 인라인 안내, CTA 클릭 시에만 업그레이드 이동.
- 종류 이동 pill: 큰 카드 제거→좌/우 소프트 rose pill 항상 노출(Free 잠금도 좌·우 모두). 일간=우 주간 / 주간=좌 일간·우 월간 / 월간=좌 주간. 이동 자유, 도착 페이지가 게이팅.
- 디자인 위계: 셀렉터 칩(진한 rose) > 이동 pill(소프트 rose) > 본문. CTA=진한 rose.
- 커밋: 11f3642, 5b62f14, 6ba7542.

### 운영
- admin@noteflex.app = Free 유지(원복 안 함, 테스트/Free 체험 겸용).

---

## 2026-06-13 — 데일리 공유 완성 + 스트릭 Step 1 + 블로그 정책·prerender 진단

### 완료
- 데일리 공유 title·캡션 양쪽 정비 + 데일리 #번호 전면 제거 (f867a28).
- 데일리 시간초과 오답 2배 버그 수정 (99e9354 + 후속).
- 스트릭 Step 1 백엔드: `record_practice_day(p_local_date)` RPC 신설 (7cdb3be), 일반게임(useSessionRecorder)·데일리(DailyChallenge) 완료 시 호출, 호출 방식 fire-and-forget 통일 (beb8a5f). 로컬 자정 기준. 마이그레이션 Supabase apply + push 완료.
- 블로그 정책 검수 0 전제 재설계: 학술·논문 인용 금지, 토픽 화이트리스트(위키 수준 확정 음악 기초 사실만), 빈도 주 1~2회. 작성 프롬프트 + 정책 문서 수정 프롬프트 작성.
- 레벨 접근 범위 수정 (d1be6c3): Free = Lv1~2 전체 서브레벨 + Lv3 sub1까지 순차 unlock, Lv3 sub2+·Lv4+ = Premium 전용 (기존 Lv1~5 sub1만에서 변경). canAccessSublevel 1줄 교체 + getProgressGatePrev 표준 순차 위임. PlayPage handleGoToNextSublevel 회귀 가드(Lv3-1 통과 후 "다음 단계로" → Lv3-2 무단진입 차단 → UpgradeModal). Pricing·strings 카피 4곳. 테스트 갱신.
- 스트릭 Step 2 (479a557): source 단일화 — UI가 profiles 대신 user_streaks를 읽도록 useStreak 훅 신설. daily_activity 테이블 신설(user_id, local_date PK), record_practice_day v2가 user_streaks 갱신과 함께 INSERT. UI 3군데 — 헤더 StreakBadge(메인 화면만, 오늘완료 amber/미완 회색), 대시보드 StreakWidget(🔥N일 + 주간 7도트 + 최장), DailyResultCard 배지.
- 스트릭 UI 다듬기 (9a92156 + 옅은불꽃 fc01808): 주간 도트 화사 오렌지(#FB923C) 채움 + 또렷 🔥, 오늘 미완 칸 amber 테두리 + 옅은 🔥(opacity 0.5). 카피 단수/복수 — "{n} day streak"(수식 단수) / "Best {n} days"(독립 복수), ko "🔥 {n}일 연속"/"최장 {n}일".

### 학습/결정
- navigator.share 앱별 title/text 처리 제각각. 이미지 중심 앱(카톡·인스타)=title만, 텍스트 중심(X·문자)=캡션. 이미지 자체 완결(점수·날짜·URL 내장) + 캡션 병행.
- 블로그 = GEO/권위 자산이지 시드 채널 아님. 검수 0이라 인용 금지가 안전(틀린 인용 리스크 제거).
- 블로그 prerender 진단: Vite React SPA 클라이언트 렌더링 → view-source의 `#root` 빈 채. 구글봇은 JS 렌더링하므로 검색 색인은 됨(신생 도메인이라 느림, GSC "접수중"). AI 크롤러는 JS 미실행으로 본문 미인식 → GEO 0. 결론: 검색은 시간 대기, 공개 라우트 SSG prerender는 GEO 본격화 시 별도(사실추적 프롬프트 보류).
- 스트릭 source 불일치: record_practice_day=user_streaks 갱신 vs UI=profiles 읽음 → user_streaks 단일화. profiles.last_practice_date는 UTC라 로컬 자정과 어긋남, user_streaks(로컬)가 정확.
- 주간 7도트는 일별 이력 필요 → daily_activity 신설(분석용 user_stats_daily와 분리, 데일리 격리 유지). 도입 후부터 쌓임(과거 소급 X).
- 레벨 게이트는 canAccessSublevel 단일 함수지만 PlayPage "다음 단계로"가 우회 경로라 별도 가드 필수.

### 다음
- 레벨 접근 범위 수정 (착수).
- 스트릭 Step 2 UI (헤더 메인·대시보드·데일리 결과 화면).
- 블로그 SSG prerender (GEO 본격화 시).
- 블로그 기존 글 인용 일괄 제거 (검수 0 정책 소급, 한가할 때).

---

## 2026-06-12 — 데일리 공유 카드 + 시간초과 버그 + SW/CTA 진단

### 완료
- 트라이얼 CTA: AdPlaceholder TRIAL_BANNER_ENABLED=false kill-switch 확인 — 라이브 노출 없음. 죽은 i18n 카피는 Creem 연동 시 정리.
- /daily 404 원인 규명: 코드·라우트 정상, 원인은 PWA SW 수동 갱신(registerType "prompt" + skipWaiting/clientsClaim 미설정 → 구 SW가 구 번들 서빙 → /daily 없는 구 코드가 NotFound). 영향=미갱신 기존 사용자 한정, 자연 갱신으로 자가치유 → 즉시 수정 보류.
- 데일리 결과 카드 이미지 공유 신규 구현: canvas PNG 렌더(dailyCardImage.ts) + navigator.share({files}) + 텍스트 폴백 (12279d8).
- 공유 카드 디자인: 날짜 📅 강조·색 범례(빠름/느림/오답/미도달)·그리드 폭 축소·캡션 (5a723a7).
- 시간초과 오답 2배 버그: effect 중복 발화로 recordResultAndAdvance 2차 호출 → ref 가드 1차 실패 후 재진단·수정 (99e9354 + 후속 수정).
- 공유 title·캡션 양쪽 정비 + 데일리 #번호 전면 제거 (f867a28).

### 학습
- navigator.share는 받는 앱마다 title/text 처리 제각각. 이미지 중심 앱(카톡·인스타)=이미지+title만, 텍스트 중심(X·문자)=캡션까지. → 이미지 자체 완결(점수·날짜·URL 내장) + 캡션 병행 전략.
- 워들 교훈: 바이럴 ≠ 사업. 워들은 수익·리텐션 없이 NYT 매각으로 종료. 공유=유입 입구, 리텐션(스트릭·구독)=본체. 레퍼런스 듀오링고+워들.

### 다음
- 데일리 Phase 3(저장·스트릭) = 리텐션 본체, 최우선.
- 공유 실기기 검증(카톡 title / X·문자 캡션 / 인스타 이미지).

---

## 2026-06-04 — 분석 리포트 · 보안 · 주간 리포트 빌드 (06-03 시작)

### 완료
- **보안:** feedback·premium_waitlist 쓰기를 Edge Function 경유로 전환, RLS clean audit 통과. chunk-load PWA 복원력 추가(b0ca878).
- **"AI" 카피 제거:** 분석/코칭에 LLM 없음(순수 SQL 규칙 엔진) → 사용자 노출 "AI" 표기 전부 제거(Pricing·Index·SEO·index.html·strings·Dashboard 🤖→📊). 정직성·심사/환불 리스크 대응. "AI"는 추후 LLM narration layer용 이름으로 보류. 코드 식별자(AiFeedbackCard 등) 유지.
- **백로그 재정렬:** noteflex-backlog-status.md(47항목) 작성. 실제 레버 = 트래픽(SEO #37) + 결제(Paddle); 분석 깊이는 트래픽 전 저ROI로 정리.
- **분석 아키텍처 확정:** 야간 배치 rollup + 최소 live. 보고서 3종(일간=진단/행동, 주간=패턴/습관, 월간=성장/리텐션). clef·accidental 집계는 레벨 게이팅 혼동+per-note 중복으로 제외. interval은 "플레이한 레벨 내"로 한정 유지.
- **일간 강화:** WeakNoteHighlightSection + IntervalSection(user_note_logs live, leap-size 버킷, <5회/<2버킷 graceful hide) + takeaway 자동 선택.
- **interval 0% 버그 수정:** IntervalSection pct가 errorRate→accuracy. 로깅 정합성(30/30) 정상 확인.
- **dev_docs/ai-report.md 생성**, §9 주간 설계 추가.
- **시드(Opus):** admin user_note_logs 5/11–6/4 시드 후 배치 실행(raw log 기반, 가짜 rollup 아님). teardown은 marker 삭제 후 real-only 재빌드. JSONB 5컬럼 정상.
- **주간 리포트 빌드:** useWeeklyReport.ts(현재/직전 주+7일 병렬), WeeklyReport.tsx, WeeklyAnalyticsPage 사용, strings/types 반영. /analytics/weekly(weekly·monthly ComingSoonGate 제거).
- **"데이터 못 불러옴" 수정:** Promise.all 전부-실패-아니어도 죽던 것 → current fatal, prev·daily non-fatal+warn.
- **[중대] admin RLS 오염 발견·수정:** is_admin()이 전 유저 rollup 반환 → 훅이 user_id 필터 없이 RLS 의존해 타 유저 혼입(활동일 10/7, 추세선 1점, delta —). useWeeklyReport 세 쿼리에 .eq("user_id", userId) 추가. RLS 미변경(admin 전체 조회는 /admin/* 의도).
- **주간 polish + 데이터 3건 수정(Sonnet, 4파일):** 헤드라인을 "지난주 대비" 단일 기준으로(주중 기울기 모순 제거, win-first) / WEAK_NOTE_GREEN_THRESHOLD=0.75로 dot색·포함 기준 통일해 녹색(≥75%) 제외(D5 78% 제거), 섹션명 "집중할 음표"로 / "최장 공백"(미래 날짜 오류) → 경과일 연속 streak / 이모지 절제 추가.

### 진행 중 · 보류
- **[중대][Opus] RLS 오염 systemic audit:** 같은 패턴이 일간·월간(usePeriodReport)·useDailyIntervals·대시보드 read에 잔존 가능. admin 과거 검증(일간 ▲31%p 포함) 부분 오염. 개인 분석 read 전부에 명시적 user_id 필터 후 재검증.
- **일간 delta 버그:** ▲31%p가 1일 baseline에서 나옴. 직전 active days ≥3 가드 필요.
- **주간 검증 잔여:** 반응속도 delta 방향(빨라짐=emerald), 격려 카드 grace/nodata 분기.
- **월간 보고서:** 데이터 성숙 전 PARK. §9 수준 설계 미작성.
- **Paddle KYC:** proof-of-address 제출, 회신 대기(매출 게이트).

### 다음
- 주간 엣지 5종 화면 검증(정확도 하락/반응 느려짐/약점0/streak≤1/grace) → push.
- Opus RLS user_id 필터 audit 프롬프트.
- 사업 레버: SEO #37(트래픽) + Paddle 회신.

---

## 2026-06-03 — RLS 보안 정상화 + waitlist Edge Function 전환

### feedback · premium_waitlist RLS 보안 정상화
- 초기 문제: 두 테이블 RLS OFF + GRANT 상태 → anon 키로 전체 행 SELECT 가능한 노출
- feedback: RLS ON, `feedback_admin_all`(is_admin) 단일 정책. INSERT는 기존 Edge Function(service_role) 경유라 직접 INSERT 정책 불필요·제거(스팸 경로 차단)
- premium_waitlist 1차: anon UPDATE 정책 제거(임의 행 변조 구멍 차단), `Pricing.tsx` upsert → `ignoreDuplicates:true`(ON CONFLICT DO NOTHING)
- 직접 클라이언트 INSERT가 RLS 42501로 지속 실패(정책 상태로 설명 안 되는 충돌/upsert 상호작용) → 직접 경로 폐기 결정
- `waitlist-signup` Edge Function(service_role) 신규 생성·prod 배포, `Pricing.tsx` → `functions.invoke('waitlist-signup')` 전환 (커밋 9b1f22e)
- 저장·중복 처리 검증 통과 후, `20260603_premium_waitlist_remove_anon_insert.sql`로 anon/authenticated 직접 INSERT 정책 제거
- 최종 상태: 클라이언트는 Edge Function(service_role) 경유로만 기록, 외부 SELECT/INSERT/UPDATE 전부 차단, admin만 전체 접근

### AdSense 심사 정체 원인 규명 (미해결 → 다음 세션)
- prod Vercel에 `VITE_ADS_ENABLED` 미설정 확인 → publisher ID 코드가 라이브에 없음
- Google 문서: head Auto ads 코드 또는 body 광고 유닛으로 publisher ID가 페이지에 있어야 심사 가능 → 현재 검증 대상이 없어 5/24 제출 심사가 정체

### 교훈
- 공개 쓰기 경로는 클라이언트 직접 테이블 INSERT + RLS 조합 대신 Edge Function(service_role) 우선 채택
- 정책 상태는 추측 말고 실제 요청 응답(DevTools status·body)으로 먼저 확정

### 정리 필요
- 대시보드 수동 정책 변경들이 마이그레이션 파일과 어긋남 → repo 동기화 필요

---

## 2026-05-31 (Sun) — 출시 D-7

### 완료 (push)

**출제 로직 ② 검증 + 5단계 시뮬레이션**
- 4-E pickDecision trace · 4-F-1/F-2/F-3 NoteGame hook 통합 (8a5cfca · f66becc · 73b34b5)
- 5단계 simulator (simSession + 5종 시나리오 + 9 메트릭 + reporter + `npm run notegen`)
  · 5704636 · 9a96b23 · cb83d5a · a335016 · c9d2c15
- 외부 N+2 분석 반박: events 단위(시도) ≠ turn 단위. Turn 단위 연속 출제 0건, 최단 gap=2 (N+2 의도 작동 검증).

**핫픽스·인프라**
- PWA SW denylist 추가 (sitemap·ads·robots·GSC 인증) — 3eda4fc
- SEO Title ko/en 통일 (브랜드 우선) — e7f87c0
- Sound Sampler 폴백 (외부 CDN sample 실패 시 synth fallback + 다운그레이드) — 55fdc08
- Vercel Analytics + 아바타 관리자 메뉴 — ddc4b8c

**Edge Glow 정답·오답 시각 피드백 (5라운드)**
- 27124ff → de83582 (Portal 마운트) → 6a8600d (시간·강도) → 13541ea (vmin 비례) → 1cec98e (색상·spread)
- box-shadow inset (GPU compositor layer 회피)
- Portal 마운트 함정 학습: 부모 transform이 containing block 생성 → position:fixed가 부모 기준 됨.

**코칭 다이얼로그 전면 정비**
- CoachingDialogShell + NoteAnalysisSection 신규 — b833a4c
- Hero 정답률 + 트렌드 배지 + 동기부여 메시지 + 보조 stats(3-col) + 음표별 분석 2x2 카드
- 6 분기 동기부여 메시지 (ko/en)
- 글자 크기 일괄 키움 (가독성) — f658d37

**Navigation 정비 (Sub-step 1·2·3)**
- Sub-step 1: Skip to content a11y WCAG — 9e57317
  · LangToggle 헤더 마운트·UserMenu Pricing/Blog shortcuts는 사용자 의도로 제외 (롤백)
- Sub-step 2: Footer 색·위계만 미세 조정 — 56c74f6 (1차 시도 부피 키워서 거의 원복)
- Sub-step 3: 데스크탑 헤더 nav 3개 (Pricing·Blog·FAQ, md+ 분기) — 666ccba
- Sub-step 4 (모바일 햄버거): PENDING 강등 — ROI 낮음, Vercel Analytics 데이터 확인 후 결정

### 학습·인사이트
- 외부 분석 검증 시 단위 구분 중요 (events vs turn) — 단위 오독이 잘못된 결론 도출.
- Edge Glow Portal 마운트 함정 — transform 가진 부모는 containing block. fixed가 부모 기준 됨.
- 사용자 의도 보존 — 분석가 권장 ≠ 사용자 의도. 이전에 의도적 제거한 항목 다시 살리지 않을 것 (LangToggle·UserMenu shortcuts).
- 1차 수정 분량 조절 — "미세 조정" 의도면 미세하게. 부피 키우면 모바일 뚱뚱화.

### PENDING 추가
- [출시후] LangToggle 헤더 마운트 재검토 — ja·zh 언어 추가 시. IP 자동 감지로 guest UX 충분, UI 미니멀 톤 + 한국 색채 회피 의도.
- [출시후] 모바일 햄버거 메뉴 (Sub-step 4) — Vercel Analytics 사용자 행동 데이터 확인 후 진짜 필요 시 추가. 현재 footer로 충분, ROI 낮음.

### 남은 출시 작업 (D-7)
- 환경변수 적용 (Paddle prod·Supabase·AdSense) — AdSense 심사 통과 후
- Android PWA 실기기 테스트 — 출시 1일 전
- 블로그 일일 작성

---

## 2026-05-30 (SEO 인프라 fix + /play 7판 윈도우 시스템)

### 1. sitemap·ads.txt·robots.txt 404 fix (`e1e463a`)

- 증상: `https://noteflex.app/sitemap.xml`, `/ads.txt`, `/robots.txt` 셋 다 브라우저에서 SPA 404 페이지 렌더 → Googlebot도 HTML 받아 sitemap 못 읽음 → GSC 색인 실패
- 원인: `vercel.json`의 catch-all rewrite `/((?!api/).*)`가 정적 파일까지 SPA fallback으로 잡음
- 수정: rewrite source에 정적 확장자·특수 경로 제외 추가
  - 명시: sitemap.xml / robots.txt / ads.txt / favicon.ico / manifest.webmanifest
  - 확장자: js / css / svg / png / jpg / jpeg / gif / ico / webp / webmanifest / woff(2) / ttf / otf / xml / txt / map / json
- Python regex 시뮬 5케이스 검증 통과

### 2. 블로그 URL 슬러그 통일 (`c4f7b9a`)

- 증상: sitemap URL `/blog/ko/chunking-music-reading`(깨끗) vs 실제 라우팅 `/blog/ko/2026-05-28-chunking-music-reading`(파일명 그대로) → sitemap URL 404, GSC 색인 127개 모두 "해당사항 없음"
- 원인: `src/lib/markdownLoader.ts`의 `pathToSlug`가 파일명 그대로 사용. frontmatter `slug:` 필드는 파싱만 되고 라우팅·매칭에 미사용. 반면 sitemap/vite getBlogRoutes는 깨끗한 슬러그 사용 → 3시스템 불일치
- 수정:
  - `markdownLoader.ts` 전면 정비: `blogIndex` 인덱스 신규(`cleanSlug` + `fileSlug` + `combinedSlug`). `loadBlogPost` cleanSlug 우선 + fileSlug fallback. `resolveCleanSlug` helper 신규
  - `BlogPost.tsx`: useNavigate 추가. 옛 URL(YYYY-MM-DD-slug) 들어오면 깨끗한 슬러그로 SPA navigate replace
  - `vite.config.ts` getBlogRoutes: frontmatter slug 우선 (sitemap·generate-sitemap과 동일 로직)
- 옛 URL 외부 backlink는 SPA 내부 redirect로 보존

### 3. /play clear 조건 — 누적 → 최근 7판 윈도우 시스템

**1차 마이그레이션** (`20260529_recent_plays_window.sql`):
- `ALTER TABLE user_sublevel_progress ADD COLUMN recent_plays JSONB DEFAULT '[]'`
- 윈도우 항목 형식: `[{at, attempts, correct, reaction_ratio}, ...]` 최대 7, 최신이 앞 (FIFO)
- `record_sublevel_attempt` 매 호출 시 윈도우 prepend + 8번째에서 가장 오래된 항목 제거
- `get_mastery_score` 점수·표시를 윈도우 평균(SUM(correct)/SUM(attempts), AVG(reaction_ratio))으로 변경. 표본 < 3이면 acc·react 점수 0
- 클라(`levelSystem.ts`): `RecentPlay` 타입, `calculateAccuracy`/`calculateReactionRatio` 윈도우 기반, `getCompletion`에 `sampleCount`/`sampleInsufficient` 추가. `MIN_RECENT_SAMPLE=3`, `RECENT_WINDOW_SIZE=7` 상수
- `useLevelProgress.ts` supabase select에 `recent_plays` 컬럼 추가

**잔여 버그 발견**: 1차 마이그레이션이 `get_mastery_score`만 윈도우로 바꾸고 `record_sublevel_attempt`의 통과 판정(`v_passed`)은 옛 누적 기준 그대로 유지:
- `acc >= 0.80` (다른 곳은 0.85)
- `play_count >= 5` (다른 곳은 10)
- 반응속도 조건 자체 누락

→ snape016 케이스: 누적 73판 73% acc로 못 깨던 단계가 윈도우 평균 ~94% + reaction 0.147로 클라 화면에선 통과 기준 충족인데 DB의 `passed=false` 잔존

**2차 마이그레이션** (`20260530_pass_window_aligned.sql`):
- `v_passed` 분기를 윈도우 기반 + 4지표 모두로 교체
- 4지표 임계 클라 `PASS_CRITERIA`와 100% 일치: `0.85 / 0.35 / 10 / 5`, `c_min_sample=3`
- 반환 jsonb의 `accuracy`·`reaction_ratio`도 윈도우 기반으로 변경 (UI 일관성)
- 기존 데이터 다운그레이드 안 함(UX 보호). passed=false인 윈도우 충족 케이스는 다음 1판 칠 때 `v_just_passed=true`로 자동 통과 + 다음 sublevel INSERT

### 4. 숙련도 카드 UI 정비

- 제목 ko `"마스터리"` → `"숙련도"`, en `"Mastery"` 유지
- `Trophy` lucide 아이콘 (amber-500) + 제목 진하게(`text-sm font-semibold`)
- `expanded` 초기값 `true` → `false` (기본 접힘)
- `computeMasteryScore` 표본 < 3이면 acc·react 점수 0 (play·streak만 부분 적용)
- 측정 기준 안내 박스 4상태 분기:
  - `N < 3`: amber-50 박스 + "정확도·반응속도 = 최근 7판 평균" + "3판 이상 쳐야 측정 시작 (현재 n/3)"
  - `3 ≤ N < 7`: amber-50 박스 + 메인 + "지금은 최근 n판 데이터로 계산 중 (7판 누적 중)"
  - `N = 7`: muted 한 줄 (메인만)
  - fast_track: 표본 N에 따라 동일 분기
- STRINGS 재구성: `masteryWindowMain` / `masteryWindowSubBefore3(n)` / `masteryWindowSubBuilding(n)` (기존 `sampleInsufficient`·`basedOnRecentPartial`·`basedOnRecentFull` 제거)

---

## 2026-05-27 ~ 2026-05-29 (대시보드 정비 스프린트)

### 1. 대시보드 delta 기준 수정 — 직전 1세션 → 7일 평균 baseline

- 기존: `lastSessionNotToday` 단일 세션과 비교 → 표본 1로 변동 폭이 커 의미 부족
- 수정: `myStats.dailyStats30d`에서 **오늘 제외 최근 7일** 윈도우로 baseline 계산
  - 정확도: note-count weighted (`SUM(correct)/SUM(total)`)
  - 속도: 일별 `avg_reaction_ms` 단순 평균
  - XP: 일별 평균 (오늘 단일 비교용)
- 표본 < 3일이면 delta 숨김 (`hasEnoughBaseline = baseline7d.length >= 3`)
- 라벨: ko "vs 최근" → "vs 7일 평균", en "vs Last session" → "vs 7-day avg"
- 파일: `src/pages/Dashboard.tsx`, `src/i18n/strings.ts`

### 2. XP/세션/노트 2배 중복집계 버그 fix

- 증상: 오늘 실제 세션 2개(xp 14+128=142, 노트 N개)인데 `user_stats_daily.xp_earned=284`, `sessions_count=4`로 정확히 2배. 과거 데이터도 5/17 이후 ratio=2.0
- 원인: `record_game_session` RPC가 `user_sessions INSERT` 직후 `user_stats_daily UPSERT`를 직접 수행 + `on_session_complete` 트리거(`handle_session_complete`)가 동일 UPSERT를 또 수행 = 매 세션 2회 합산
- 수정: `record_game_session`에서 `user_stats_daily UPSERT` 블록만 제거 (트리거가 단독 처리)
- 마이그레이션: `20260527_fix_record_game_session_dedup.sql` (DB 적용 완료, 과거 데이터 복구 완료)
- 백업 테이블: `user_stats_daily_backup_20260527` (안정 확인 후 삭제 — PENDING)

### 3. React Hooks 크래시 fix (2회)

- "Rendered more hooks than during the previous render" 크래시 (ErrorBoundary 발동)
- 원인: `lastActivityData = useMemo(...)`가 `if (authLoading) return ...` / `if (!user) return ...` early return **뒤**에 호출 → 첫 렌더와 두번째 렌더의 hook 개수 차이
- 수정: `useMemo`를 모든 early return 위로 이동 + 내부에서 hook 결과(`myStats.sessions`, `myStats.dailyStats30d`, `stats.lastPracticeDate`, `levelProgress`) 직접 사용
- 파일: `src/pages/Dashboard.tsx`

### 4. weak_score v2 — 정확도 주신호화

- 기존 공식: `(1-acc) × √n + LEAST(avg_ms/3000, 1) × 0.3` — sqrt(n) 가중치 과해 73%·n=33이 0%·n=5보다 위로 옴
- 신규 v2: `(1-acc) + LEAST(n/100, 0.15) + LEAST(avg_ms/3000, 1) × 0.05`
  - (1-acc) 주항 (0~1)
  - 표본 보너스 ≤0.15 캡 (같은 정확도면 큰 n이 약간 위)
  - 속도 보너스 ≤0.05 캡 (미미한 보조)
- 검증 5케이스: Gb3 0%/n5 > Eb4 23%/n13 > B1 29%/n7 > G1 60%/n10 > B4 73%/n33 (기대 정렬 정확 일치)
- **대시보드 클라이언트** (`WeakSlowNotesCards.tsx`)는 적용 완료
- **엔진 마이그레이션** (`20260528_weak_score_v2.sql`, `build_period_rollup`의 `weak_calc` CTE 교체)은 작성됨, **DB 미적용** (출시 후 적용 + 기존 rollup 재생성 PENDING)

### 5. 약점/느린 음표 카드 정비 (WeakSlowNotesCards)

- 데이터 출처 변경 없음 (`fetchUserNoteLogs(500)` 클라 집계 유지 — 실시간 스냅샷 원칙)
- 약점 정렬: 단순 `accuracy ASC` → weak_score v2 내림차순
- 표시: 각 항목에 `n=N` 표본 수 칩 추가 (`attemptsCountFormat: "n={n}"`)
- 느린 음표: avgTime ≥ 6.5s (sub1 timeLimit 7s 근접)면 "⏱ 시간초과" / "⏱ Timed out" 라벨로 timeout 다발 표기
- 툴팁 수정: "최근 200개" → "최근 500개"로 실제 fetch 개수와 일치 (ko/en)
- Top3 → Top5 라벨 (코드 `TOP_N=5`였으나 문구만 Top 3)

### 6. NextStepCard 신규 — 대시보드 음표 현황 카드

- 두 박스 구조: 좌 "이 음에 집중" / 우 컬럼 "연습이 필요한 음" + "마스터한 음"
- 좌 zone amber `#FAEEDA` + 우상 sage `#DCE5D5` + 우하 blue-gray `#C9D3DD` 3색 조화
- 음표 표시: ko는 계이름+음이름 ("시 B4"), en은 음이름 단독 (`useLang` 분기 + `SOLFEGE_KO` 매핑)
- 좌 박스 톤 분기: recent_20_correct 16+ = primary(레드) "마스터 직전", 10–15 = amber "거의 다 왔어요", <10 = 중립 "마스터하는 중"
- 데이터 출처:
  - 좌(집중) + 우상(연습 필요) = **실시간**. `user_note_logs(500)` fetch → 음표별 최근 20개 윈도우 → `(correct, attempts)` 계산. ever_weakness=true + status≠graduated 후보에서 live_correct 정렬, 좌=1위, 우상=2~5위 (최대 4)
  - 우하(마스터) = **배치**. `user_note_status.status='graduated'` + `graduated_at DESC` FIFO (최대 3 slot)
  - 배치 갱신 시각: `max(updated_at)` → "방금 전 / N시간 전 / N일 전 갱신"
- 졸업 기준 재현: 엔진 `refresh_user_note_status`와 동일하게 `recent 20 + ever_weakness + correct >= 19 + sessions >= 2`
- 상단 Lv 게이지 한 차례 추가했다가 제거 (정확도 누적 기준이 의미 부족 — clear 조건 재정의 작업으로 분리)

### 7. 오선지 시도 → 폐기

- 시도 1: vexflow `Renderer/Stave/StaveNote` 사용 `MiniStaff` → "Too many ticks" 크래시 + 번들 2,594KB → 3,744KB로 1.1MB 증가
- 조사: `StaffDisplay.tsx`(vexflow)는 src 전체에서 import 0 → dead code. 게임은 `GrandStaffPractice.tsx`가 자체 SVG(`<ellipse>`, `<line>`, Bravura SMuFL `<text>`) + 좌표 계산(`noteToStep`, `stepToY`, 자체 `SHARP_KEY_POS`/`FLAT_KEY_POS` 매핑)로 렌더 — vexflow 사용 X
- 시도 2: GrandStaffPractice 좌표 로직 복사한 SVG `MiniStaff` → 작은 박스(150×88, 78×56) 음높이 잘림 + aspect ratio 불일치
- 최종 결정: 오선지 폐기, **계이름+음이름 텍스트**로 대체. `MiniStaff.tsx`는 dead code로 보존 (rm 금지)

---

## 2026-05-26 (분석 엔진 v1)

### 1. 블로그 §1-4 "초견과 청음" 작성 (커밋 `b7a3b4e` 포함)

- `src/content/blog/ko/2026-05-26-sight-reading-vs-ear-training.md` + EN 버전 생성
- 이미지 2종: Guidonian Hand (Wikimedia) + BnF Gallica solfège (HTTP 200 검증)
- 학술 인용: Hayward & Gromko (2009) DOI 10.1177/0022429409332677
- `docs/marketing/blog_topics_100.md` §6 작성 이력 + §7.8-D/E 갱신

### 2. DB 사전 RECON (2회)

**1차**: `user_note_logs`, `user_sessions`, `user_analytics_rollup`, `user_note_status` 스키마 확인.  
**2차 GAP-FILL**: `user_stats_daily.weak_notes` 항상 NULL, `note_mastery.recent_accuracy` 항상 NULL, `note_mastery` 테이블 자체 미활용 → 분석 기준을 `user_note_logs` 단독으로 확정.  
- `user_note_logs.response_time` 단위 = **초(seconds)** (ms 변환 필요: `×1000`)
- `note_key` 형식: `"C"`, `"C#"`, `"Db"` 등 (코드 확인)

### 3. 분석 엔진 v1 구현

마이그레이션 파일 7종 (적용 순서):

| 파일 | 내용 |
|---|---|
| `20260526_analytics_01_indexes.sql` | 복합 인덱스 3개 (`user_note_logs`, `user_sessions`) |
| `20260526_analytics_02_tables.sql` | `user_analytics_rollup`, `user_note_status`, `daily_batch_runs` 확장 |
| `20260526_analytics_02b_…sql.bak` | ⚠️ 오진단 파일 (.bak, 적용 불필요) |
| `20260526_analytics_03a_functions.sql` | `refresh_user_note_status`, `build_period_rollup`, `run_daily_analytics_rollup` |
| `20260526_analytics_03b_cron.sql` | pg_cron 업데이트만 (03a 수동 검증 후 적용) |
| `20260526_analytics_04_rpcs.sql` | `get_daily_report`, `get_weekly_report`, `get_monthly_report`, `get_user_note_status` |
| `20260526_analytics_05_fix_octave_type.sql` | `user_note_logs.octave` TEXT→INTEGER 멱등 ALTER |

### 4. 프로덕션 버그 3종 수정

**Bug 1 — date−bigint (42883)**: `ROW_NUMBER()` 반환이 bigint → `date - bigint` 연산자 없음.  
수정: `(p_period_end - (ROW_NUMBER() OVER (...) - 1)::int)` — 03a L339, 04 L170.

**Bug 2 — users_processed=0**: date−bigint 에러가 유저별 EXCEPTION에 잡혀 모든 유저 실패.  
수정: date−bigint 패치 후 재실행 → processed=3, failed=0 확인.

**Bug 3 — text=integer (42883) in refresh_user_note_status**: `user_note_logs.octave`가 라이브 DB에서 TEXT로 드리프트 (소스 마이그레이션은 INTEGER).  
수정: `05_fix_octave_type.sql` 멱등 ALTER (정규식 가드 + information_schema 체크).

### 5. 아키텍처 결정 사항

- **Tutorial 제외**: `user_sessions.session_type='tutorial'` 시간범위 EXISTS (session_id 없어서 time-range 매칭)
- **졸업 v1**: 정확도 기준만 (sublevel 없어서 속도 기준 v2로 이연)
- **약점 점수**: `(1 - accuracy) × √attempts + LEAST(avg_ms/3000, 1.0) × 0.3`
- **cron 안전**: `run_daily_analytics_rollup` 최외층 EXCEPTION = NOTICE only (premium 만료 cron 보호)
- **99_rollback.sql**: footgun이므로 `docs/20260526_analytics_99_rollback.sql.txt`로 이동

### 6. 파일 위생

- `supabase/migrations/20260526_analytics_02b_…sql` → `.bak` (오진단)
- `supabase/migrations/20260526_analytics_99_rollback.sql` → `docs/…sql.txt` (footgun 방지)

---

## 2026-05-25 (3차)

### 1. UpgradeModal 빨간 테스트 수정 (커밋 `06e6c61`)

- 원인: 이전 세션에서 `benefitWeakNotes` EN 문구를 "Focused weak-note training mode" → "Detailed weakness analysis"로 바꿨으나 테스트 기대값은 미갱신.
- 현재 EN benefits 3번째 = "✨ Distraction-free, ad-free experience"
- 수정: `getByText(/Personalized practice/)` → `getByText(/Distraction-free/)`
- 결과: 789/789 통과

### 2. PWA 설치 가능화 (커밋 `8e5a578`)

**vite-plugin-pwa v1.3.0 설치**
- `vite.config.ts`에 VitePWA 추가
  - `registerType: "autoUpdate"`, `injectRegister: "auto"`
  - manifest 인라인: name=Noteflex, display=standalone, theme_color=#D3224E, background_color=#faf8f0(light mode hsl 48 50% 96% → hex)
  - workbox: globPatterns 정적 자산, navigateFallback=/index.html, maximumFileSizeToCacheInBytes=4MB(메인 번들 2.8MB > 기본 2MB)
  - navigateFallbackDenylist: /rest/, /auth/, /realtime/ (Supabase API 미가로채기)

**아이콘 생성** (`scripts/gen-pwa-icons.mjs` 신규, sharp 재사용)
- `public/pwa-192x192.png` (3.7KB), `public/pwa-512x512.png` (14KB) — favicon.svg 리사이즈
- `public/pwa-maskable-512x512.png` (14KB) — #D3224E 512×512 배경 + 로고 410px 중앙(안드로이드 safe zone ~80%)

**index.html**
- `theme-color` 메타: #faf8f0 → #D3224E (manifest theme_color 일치)
- iOS 메타(apple-mobile-web-app-capable/status-bar-style/title/apple-touch-icon) 이미 존재 → 유지

**빌드 결과**
- `dist/manifest.webmanifest` (0.44KB) ✓
- `dist/sw.js` (2.3KB) ✓ — precache: pwa-192/512/maskable, favicon류, index.html, assets/index.js(2.8MB), assets/index.css
- Supabase API 미가로채기: navigateFallbackDenylist 적용 확인

**설치 프롬프트 컴포넌트**: 미존재 (FAQ 텍스트에만 "홈 화면에 추가" 언급). beforeinstallprompt 훅 없음 → 신규 생성 없이 브라우저 기본 배너 사용.

**검증**
- `npm run build` ✓ (tsc 0 errors)
- 789/789 통과

---

## 2026-05-25 (2차)

### 1. 출시 전 분석 — 로깅 입자도 + PWA manifest

**로깅 입자도 (A 결론)**
- `user_note_logs` 테이블: 음표마다 1행 INSERT (note_key, octave, clef, is_correct, response_time[초단위], error_type, level). per-note 분석 정본.
- `user_sessions.note_attempts` JSONB: 세션 종료 시 배열 일괄 저장 ({note, correct, reaction_ms, clef, accidental}).
- **누락**: interval_from_prev (직전 음과의 반음 거리) — 두 경로 모두 미저장. 소급 불가 → 즉시 수집 필요.

**PWA manifest (B 결론)**
- public/manifest.json 없음, vite-plugin-pwa 없음, `<link rel="manifest">` 없음.
- PWA 자체 미구성 상태. 192/512 아이콘 항목 없음.

### 2. interval_from_prev 로깅 추가 (커밋 `0fb41f1`)

**마이그레이션**: `supabase/migrations/20260525_note_interval_from_prev.sql`
- `ALTER TABLE user_note_logs ADD COLUMN IF NOT EXISTS interval_from_prev INTEGER;` (nullable, 소급 없음)

**`src/lib/noteUtils.ts`** (신규)
- `noteKeyToSemitone(noteKey, octave)`: note_key("C", "C#", "Db"...) + octave → 절대 반음 수 (octave×12 + 음계인덱스)

**`src/lib/userNoteLogs.ts`**
- `UserNoteLogPayload` / `UserNoteLogInput`에 `interval_from_prev: number | null` 추가
- `fetchUserNoteLogs` select에 `interval_from_prev` 포함

**`src/hooks/useNoteLogger.ts`**
- `prevNoteRef`: 직전 음(note_key, octave) 추적
- `logNote`: prevNote 있으면 signed semitone 계산 → `interval_from_prev`, 세션 첫 음 → NULL
- `resetPrevNote()` 공개

**`src/components/NoteGame.tsx`**
- `const { logNote, resetPrevNote } = useNoteLogger();`
- `recorder.startSession(...)` 두 지점(초기 useEffect, handleReplay) 직후 `resetPrevNote()` 호출

**테스트 목 갱신**: NoteGame 7개 테스트 파일의 `useNoteLogger` 목에 `resetPrevNote: vi.fn()` 추가

**검증**
- `npm run build` ✓ (0 errors)
- 테스트 788/789 통과 (UpgradeModal 1건 = 이전 세션 `benefitWeakNotes` 변경 선행 실패, 우리 변경과 무관 — stash 전후 동일)
- 반음 수학 검증: G4→C5 = (5×12)−(4×12+7) = 60−55 = **+5** ✓, C4→G4 = 55−48 = **+7** ✓, G4→C4 = 48−55 = **-7** ✓

---

## 2026-05-25

### 1. 게임 UI / 그랜드 staff / i18n
- 아바타(UserMenu) 게임 화면에서 완전 제거(집중 모드). NoteGame 헤더 = 나가기 버튼만(justify-start). PlayPage fixed overlay 제거 유지. 아바타는 레벨선택(PlayPage:146) 등 다른 곳엔 유지. NoteGame 테스트에 vi.mock("@/components/UserMenu") 추가, 97/97 통과.
- 그랜드 staff C4 앵커: GRAND_BASS_YOFF unify(144) 시도 후 반려, 220 복귀 확정. 음표 명칭 게임은 명확한 staff 분리 > tight grand staff 표준. 코드에 "unify 금지" 주석. 항목 종결.
- AccidentalSwipeTutorial i18n: 하드코딩 한국어 → useT() + strings.ts accidentalTutorial 섹션(interface/ko/en) 신설.

### 2. Paddle 기간만료 해지 검증 + 트리거/cron 캡처
- paddle-webhook/index.ts는 is_premium 직접 변경 안 함 — subscriptions 테이블만 upsert. is_premium 프로비전/해지는 DB 트리거 on_subscription_change → sync_premium_status()(status in active/trialing → is_premium=true, premium_until=current_period_end). 접근 게이트 = is_premium boolean only(subscriptionTier.ts, 날짜 체크 없음).
- 검증: 기간만료 해지 정상(scheduled-cancel은 status='active' 유지 → 기간끝까지 premium → 'canceled' 이벤트로 false). past_due/paused는 즉시 false(dunning grace 없음, 출시후 고려).
- 트리거+함수가 어떤 마이그레이션에도 없었음(라이브 DB에만 존재) → 20260525_premium_sync_trigger_and_cron.sql로 캡처(CREATE OR REPLACE 함수 + 트리거 + pg_cron). 데일리 배치(run_daily_batch_analysis→expire_premium_users)는 cron 스케줄 없었음 → cron.schedule('noteflex-daily-batch','0 15...') 추가. (최초 0 18 → 관리자 페이지 표기 "UTC 15:00 한국 자정"에 맞춰 0 15로 정렬.) 라이브 적용 완료(cron.job: noteflex-daily-batch | 0 15 | true). 수동 SELECT run_daily_batch_analysis() 검증 성공.
- AdminBatchRuns.tsx + /admin/batch-runs + RLS(daily_batch_runs_admin_select) 이미 완성 상태였음(신규 작성 불필요). premium_expired 컬럼 포함 풀 렌더 확인.

### 3. AdSense 심사 신청 (검토 중)
- 준비 확인: index.html에 실 publisher ID ca-pub-4314740126698954(meta + 무조건 로드 script), public/ads.txt 라이브 200, 블로그 126편(ko 63+en 63), 정책 페이지(/terms /privacy /about /contact), privacy.md·cookies.md에 AdSense·쿠키·광고 고지 존재.
- 정정/결정: 신청 시 VITE_ADS_ENABLED=true 안 함. 슬롯 ID가 placeholder(0000...)고 실 슬롯 ID는 승인 후 발급(ad unit 생성 잠김). 켜면 깨진 ins 단위 렌더 → 심사 마이너스. 검증은 index.html 무조건 로드 script가 담당. → ads OFF로 신청.
- 콘솔: noteflex.app "검토 필요" → "검토 요청" 클릭 → "준비 중/In progress". ads.txt 상태 "찾을 수 없음"은 스테일(마지막 체크 5/7), 재크롤로 해소 예정, 승인 안 막음.
- EU CMP: Google CMP 3가지 선택지(동의/동의하지않음/옵션관리) 선택 + /privacy URL로 설정 제출.

### 4. 기록한다 sweep (블로그 본문)
- grep 599건 = 과잉매칭. 대부분 오탐(박=beat: 강박/약박/한 박/N박/기록할=beat를) + docs의 "기록한다 금지" 규칙 언급.
- 진짜 위반 = ko 블로그 4편(ban 이전 Code가 정상 동사를 기록한다로 잘못 치환). 문맥 복구(기계적 치환 금지): adult-sight-reading 15곳, hobbyist-musician 6곳, fast-note-recognition 7곳, reading-ledger-lines 2곳. beat 용어 보존. (d28a951)
- 나머지 595 = 오탐/내부 logger·주석·docs cruft → 화면 무관, 출시후 별도 sweep.

### 5. SEO 메타 (react-helmet)
- 발견: head 관리자 전무(react-helmet 0, document.title 0). 모든 페이지가 정적 index.html 제너릭 메타만 사용 → 블로그 frontmatter title/description이 head에 반영 안 됨.
- react-helmet-async 도입 + Seo 컴포넌트(src/components/Seo.tsx). HelmetProvider는 App.tsx ErrorBoundary 안쪽. BlogPost: title({meta.title} | Noteflex)·description·canonical(/blog/{lang}/{slug})·og·hreflang(ko/en/x-default). Blog/About/FAQ/Contact/Pricing: title+canonical. tsc/build 클린. (SEO 커밋 2건)
- 라이브 검증: 시크릿 Elements DOM에 canonical/hreflang/title 반영 = helmet 정상(구글봇 렌더 OK). "소스 보기"엔 없음 = SPA 정상(서버 정적 index.html).
- 한계: 소셜·비JS 크롤러(카톡/트위터)는 정적 메타만 봄 → prerender(출시후) 과제. hreflang은 모든 slug가 ko+en 쌍 존재 전제 — 데일리 ko+en 동시 발행 규칙 유지 필수(한쪽만 있으면 hreflang 404 위험).

### 6. 러버블 완전 청산
- favicon: 러버블 기본 favicon.ico(4/7) → favicon.svg(Noteflex #D3224E 음표 로고)에서 .ico+apple-touch-icon.png+favicon-32x32.png 재생성, index.html 링크 4개. (e1fa774). 일반 브라우저에서 러버블로 보였던 건 캐시(시크릿=Noteflex 정상). favicon.svg 실물=Noteflex 음표 확인. 코드 정상.
- lovable auth: src/integrations/lovable/index.ts = 죽은 코드(import 0건, 로그인 전부 supabase.auth) → 주석 stub 처리 + @lovable.dev/cloud-auth-js dep 제거. (8db7d5a)
- lovable-tagger: vite.config.ts dev 플러그인 제거(import+호출, ({mode})→()), package.json devDep 제거. (376ef68) → lovable grep 0건, 완전 청산.

### 7. Pricing 컴플라이언스 (Paddle/AdSense)
- 가격 $4.99/$39.99 전체 일치 확인(옛 $2.99/$24.99/$35.99 흔적 없음). /refund는 Footer(83) + Pricing(470) 링크 = 결제 지점 근접 노출.
- benefitWeakNotes 미구현("약점 음표 집중 훈련 모드"/"Focused weak-note training mode") → 구현된 "상세 약점 분석"/"Detailed weakness analysis"로 교체(strings.ts ko 484·en 939). (1df27a8)

### 8. Paddle LIVE 계정 가입 + KYB 제출 (검토 중)
- 기존 sandbox만 보유 → paddle.com에서 LIVE 계정 신규 가입(별개 계정).
- 가입 메일: billing@noteflex.app (admin@noteflex.app의 Google Workspace 별칭으로 신설, 수신 확인).
- 입력 내역: What do you sell=Digital products or SaaS · Account=YongJun Kim · Business name=Donofear, type=Individual, annual revenue="Not yet", website=noteflex.app · 사업장 주소=서울 서초구 사임당로8길 13, 4층 402-L976호(06640) · 개인 거주지=경기 수원 팔달구 화산로 57, 144동 701호(별도 입력, Same as personal 해제) · 상품설명(음악 초견 교육 SaaS 구독 $4.99/$39.99, 디지털 only) · AUP 동의 · 웹사이트 검증 URL(도메인 noteflex.app / pricing /pricing / terms /terms / privacy /privacy / refund /refund) · 사업자 상세(개업일, trading name=Noteflex, sales tax number=367-45-01000, National ID 생략) · 리스크 질문 전부 No + 정보 정확 confirm.
- 제출 → "We are reviewing your details" / Verification status: In progress.
- 라이브 카탈로그: 비어 있어서 Premium 상품 신규 생성 + 가격 2개(둘 다 recurring USD, Min/Max quantity 1, trial 없음):
  - $4.99 Monthly → Price ID: pri_01ksez99vvpyfv1f7ff43e05kp
  - $39.99 Yearly → Price ID: pri_01ksezab72vjnxdg03x1bmk836

### 이번 세션 커밋
- 20260525 premium sync 트리거+cron 마이그레이션 (+ cron 0 18→0 15)
- e1fa774 favicon de-lovable
- 8db7d5a lovable auth cleanup
- d28a951 기록한다 블로그 4편 복구
- 1df27a8 pricing benefitWeakNotes 교체
- SEO 메타 2건 (react-helmet-async+Seo / BlogPost·페이지 적용)
- 376ef68 lovable-tagger 제거
- 세션 전반부 게임UI·그랜드staff·AccidentalSwipeTutorial 커밋
- push: 여러 차례 수행. 최신(376ef68·SEO 메타) push 반영 확인 권장.

### 다음 세션 핵심 상태
- AdSense: 검토 중(In progress) — 승인/반려 메일 대기.
- Paddle: KYB 검토 중(In progress) — billing@noteflex.app 메일 주시(신원 인증 여권+셀피·도메인 인증 코드·추가서류 요청 가능).

---

## 2026-05-21 (수) — 게임 데이터 적재 fix · calibration 재설계 · UI 카피·타임존 fix

### 게임 데이터 적재 진단·fix

1. forpaddle 계정 Level 1 플레이 → 5개 테이블 중 3개 INSERT 누락 발견
   - 적재 OK: user_note_logs, daily_sessions, user_streaks
   - 적재 X: user_sessions, user_stats_daily, practice_logs

2. record_game_session RPC 실패 원인 추적
   - Sentry: "invalid input syntax for type integer: '986.7666666507721'"
   - 클라이언트는 정수만 전달 (console.log 단계별 검증)
   - 진짜 원인: handle_session_complete 트리거의 `(attempt->>'reaction_ms')::INT` 캐스팅
   - clampReactionMs(rawMs - offsetMs) 결과 소수 → JSONB 저장 후 트리거 ::INT 거부

3. fix 적용
   - `src/hooks/useSessionRecorder.ts:287-288`: noteAttempts 생성 시 reaction_ms·reaction_ms_raw 모두 Math.round() 적용
   - `supabase/migrations/20260520_fix_session_trigger_int_cast.sql`: 트리거의 `::INT` → `::NUMERIC::INT` 변경

### reaction_ms 누적 버그 fix

1. 2차 버그 발견 — 첫 19개 음표가 게임 시작부터 누적 시간 기록(1492ms→27727ms), 20번째부터 정상화

2. 원인 추적
   - noteStartTime 갱신 위치 11곳 분산
   - batch 내 음표 진행 시 currentIndex 변화에 갱신 누락
   - 디버그 console.log로 정답 처리 후 [noteStartTime] 로그 빠지는 경로 확인

3. fix 적용 — useEffect 안전 그물 추가
   - `src/components/NoteGame.tsx`에 currentIndex·currentTarget·phase·showCountdown 변화 시 noteStartTime 자동 갱신 useEffect 추가
   - 초기 line 362에 추가했다가 TDZ 에러 발생, line 891로 이동
   - 검증: avg_reaction_ms 8830ms → 688ms 정상화

### Calibration 시스템 재설계

1. 치명 결함 발견
   - 기존 CalibrationModal이 사용자 자극→탭 반응시간(444ms)을 그대로 offset으로 저장
   - 시스템 지연이 아닌 사용자 반응시간을 모든 음표 반응시간에서 차감
   - 결과: 모든 사용자 반응시간이 비정상적으로 빨라 보임 (실제 1.1초 → 표시 0.6초)

2. 새 설계 적용
   - AudioContext.outputLatency + baseLatency 기반 자동 측정
   - 백그라운드 자동 진행 (UI X, 사용자 조작 X)
   - 디바이스 변경 시 자동 재측정 (navigator.mediaDevices.ondevicechange)
   - 첫 측정 알림 X, 디바이스 변경 시 토스트만

3. 구현 내역
   - `src/lib/userEnvironmentOffset.ts`에 measureSystemLatency() 함수 추가
   - `src/hooks/useUserEnvOffset.ts`에 자동 측정 + devicechange 이벤트 리스너 추가
   - `src/components/NoteGame.tsx`에서 CalibrationModal 렌더링·관련 state 제거
   - CalibrationModal.tsx 파일 자체는 유지 (롤백 대비)

4. localStorage V1→V2 키 마이그
   - 기존 `noteflex.userEnvOffset` → `noteflex.userEnvOffsetV2`
   - 기존 `noteflex.calibrationSkippedOnce` → `noteflex.calibrationSkippedOnceV2`
   - 새 코드 배포 시 V1 키 자동 cleanup
   - 모든 기존 사용자 옛 측정값(444ms 등) 자동 폐기

5. 검증
   - 사용자 환경: outputLatency=0, baseLatency=5.3ms → user_env_offset_ms=5
   - avg_reaction_ms 1122ms, raw_avg 1127ms → 보정 영향 미미 (정상)

### UI 카피·자동 갱신·타임존 fix

1. UI 카피 수정 (`src/i18n/strings.ts`)
   - line 597 ko: "...다음 세션부터 적용된요." → "...다음 세션부터 나타납니다."
   - line 699 ko: "오늘 박으면 {n}일째 ✨" → "오늘 연습하면 {n}일째 ✨"
   - line 1078 en: "Today makes it day {n} ✨" → "Practice today to make it day {n} ✨"

2. 대시보드 자동 갱신
   - `src/pages/Dashboard.tsx`에 visibilitychange 이벤트 리스너 추가
   - 탭/앱 복귀 시 myStats.refresh() 자동 호출
   - 사용자 새로고침 버튼 수동 클릭 불필요

3. 타임존 버그 fix
   - isoFromIsoOrTimestamp 함수가 UTC 문자열을 slice(0,10)으로 자르기만 함
   - 한국 자정 이후·UTC 자정 전 게임 진행 시 "오늘 시작 안 함" 잘못 표시
   - 글로벌 출시 시 모든 시간대 사용자 영향 (자정 근처 게임 시 발생)
   - fix: `new Date(s)`로 변환 후 사용자 로컬 시간 기준 ISO 추출

### 메모리 정리

- 메모리 30개 본문에서 "기록한다" 표현 일괄 제거 (#1, #2, #3, #11, #15, #16, #20, #25, #26, #27)
- 메모리 #4에 "기록한다 동사 사용 절대 금지" 규칙 추가
- 메모리 #5 출시 마감일 갱신 (5/31 → 6/7)

### 작업 효율 분담 학습

- 사용자 피드백: 채팅 Claude가 함수 본문 전체를 프롬프트에 작성하는 등 토큰 낭비
- 합의: 채팅 Claude는 진단·결정·간결한 지시, Claude Code는 코드 변경·파일 작업·빌드·commit
- 프롬프트 작성 전 사용자 의견 묻기

---

## 2026-05-20 (화) — UpgradeModal 후킹 다이얼로그 이동 + 콘텐츠 페이지 완료

### 주요 작업

1. About 페이지 작성 완료 (commit `ea6986b`)
   - 1인 개발자 시점 미션, ko·en, 4문단 구조

2. Contact 페이지 작성 완료 (commit `3b9ee72`)
   - 비즈니스(contact@)·기술지원(support@)·결제(Paddle Help) 분리

3. FAQ 페이지 확장 완료 (commit `a384165`)
   - 5개 → 13개로 확장
   - 핵심: 30일 grace period 복원, 동시 접속 불가 명시, 앱스토어 추후 안내

4. Pricing 비교표 정리 (commit `ea202fe`)
   - 레벨 집중 제거 → 사용자 가치 중심 7행 (일일 연습 횟수·이용 가능 레벨·약점 음표 분석·AI 학습 코치·광고·기록·통계·신기능 우선 이용)
   - 잡스 스타일 UI: ✨ Premium 강조, 좌측 정렬, 미니멀 보더

5. UpgradeModal 후킹 다이얼로그 → 출시 후로 이동
   - 정교화 작업 (랜덤 노출·광고 충돌 방지·카피 풀·"오늘 안 보기") 출시 후 진행

6. 블로그 3편 작성 (출근 전 자동 작성)

---

## 2026-05-19 (화) — 결제 시스템 마무리 · SEO · 콘텐츠 페이지 · Pricing 정리

### 주요 작업 — 결제 시스템 완전 종료

1. **Customer Portal redirect 기능 추가** (`38c2c58`)
   - `supabase/functions/paddle-customer-portal/index.ts` 신규 생성
   - ProfilePage "구독 관리" 버튼 추가 (Premium 사용자 전용)
   - Paddle Customer Portal로 redirect → 사용자가 표준 페이지에서 취소·결제수단 변경·인보이스 조회 가능
   - Edge Function 자체 JWT 검증(`supabase.auth.getUser`) + `verify_jwt = false` 설정
   - i18n: `strings.ts`에 `manageSubscription`·`manageSubscriptionLoading` 추가 (ko·en)

2. **DB 컬럼명 정리: stripe_* → paddle_*** (`fb437bb`)
   - `profiles.stripe_customer_id` → `paddle_customer_id`
   - `subscriptions.stripe_customer_id` → `paddle_customer_id`
   - `subscriptions.stripe_subscription_id` → `paddle_subscription_id`
   - `subscriptions.stripe_price_id` → `paddle_price_id`
   - 영향 파일: `paddle-webhook/index.ts`, `useAdminUserDetail.ts`, `AdminUserDetail.tsx`, 마이그레이션 2개
   - 사용자 데이터 0건 시점에서 안전하게 진행

3. **profile.paddle_customer_id 자동 동기화 fix** (`1cb5a8c`)
   - 발견: webhook이 `subscriptions` 테이블에만 customer_id 기록, `profiles` 테이블에는 NULL 유지
   - 증상: 구독 관리 버튼 클릭 시 Edge Function 404 (Paddle customer not found)
   - 원인: webhook 코드가 `profiles` 테이블 UPDATE 누락
   - fix: `handleSubscriptionEvent`에서 subscriptions UPSERT 후 profiles UPDATE 추가
   - 신규 사용자도 결제 즉시 구독 관리 가능

4. **Paddle API key 권한 추가**
   - 발견: Customer portal sessions API 호출 시 403 forbidden
   - 원인: 기존 API key가 모든 권한 Read 전용으로 설정됨
   - fix: Paddle Dashboard에서 Customer portal sessions = Write 권한 추가
   - 사용자가 직접 Paddle Dashboard에서 진행

5. **PADDLE_ENVIRONMENT 환경변수 추가**
   - Supabase Edge Function secrets에 `PADDLE_ENVIRONMENT=sandbox` 명시적 설정
   - 기존 Edge Function 코드는 기본값 sandbox로 동작했으나 명시적 설정으로 안전성 확보

6. **CheckoutSuccess·CheckoutFailed i18n 적용** (`63e36da`)
   - 한글 하드코딩 → `useT()` 다국어
   - "Piano Note Trainer" 옛 이름 → "Noteflex" 정정
   - "악보 업로드 및 커스텀 연습" 항목 삭제 (미구현 기능)
   - `strings.ts`에 `checkout` 영역 신규 추가 (ko·en)

### SEO 정리

- **robots.txt 빌드 후 강제 복사 fix** (`830b75c`)
  - 원인: vite 빌드 과정에서 어딘가 `robots.txt`를 짧은 버전으로 덮어쓰는 현상
  - fix: `package.json` build script에 `cp public/robots.txt dist/robots.txt` 추가
  - 결과: `dist/robots.txt` 476 bytes (Allow/Disallow 전체 포함) 정상 유지
- **sitemap.xml 자동 생성** (`4556985`)
  - `scripts/generate-sitemap.ts` 신규 작성 (vite-node 기반)
  - `npm run sitemap` 명령으로 정적 페이지 10개 + KO 블로그 58편 + EN 블로그 58편 = 총 126개 URL 자동 생성
  - 빌드 시 자동 갱신되도록 `build` 스크립트에 통합

### 콘텐츠 페이지 작성 — About · Contact · FAQ

1. **About 페이지** (`ea6986b`)
   - "Coming soon" 제거 → 1인 개발자 시점 미션 글 작성
   - 4문단: 시작·문제·해결·약속
   - ko·en 동시 작성
   - 핵심 문장: "여러분의 초견 실력과 함께 자라는 서비스가 되겠다고 약속합니다"

2. **Contact 페이지** (`3b9ee72`)
   - 3섹션 분리: 비즈니스 문의·기술 지원·결제 영역
   - contact@noteflex.app (mailto), support@noteflex.app (mailto), Paddle Help (외부 링크)
   - 응답 시간 명시 제외 (사용자 결정)
   - 사업자 정보는 Footer만 사용 (중복 회피)
   - tax@ 영역 미포함 (결제는 Paddle 책임)

3. **FAQ 확장** (`a384165`)
   - 기존 5개(취소·결제 수단·무료 체험·업그레이드·환불) 유지
   - 신규 8개 추가: 적합한 사용자·악기 없이 사용·일일 연습 시간·진도 추적·계정 삭제(30일 grace period)·여러 기기 동시 사용(불가능 명시)·앱 스토어(추후 반영)·오프라인(온라인 권장)
   - 총 13개 (ko·en)
   - 레벨 구성 질문 제외 (향후 레벨 추가 예정)

### Pricing 비교표 정리 (`ea202fe`)

- 기존: 레벨 5행 + 광고 + AI 분석 = 7행. 레벨에 몰빵, Sub1·Sub2·Sub3 같은 내부 용어 노출
- 신규: 사용자 가치 중심 7행 + 잡스 스타일 미니멀 디자인
- `compareRows`: 일일 연습 횟수 / 이용 가능 레벨(맛보기·기초·전체) / 약점 음표 분석 / AI 학습 코치 / 광고 / 기록·통계 / 신기능 우선 이용
- UI: 둥근 모서리·Premium 컬럼만 강조(✨ + `bg-primary/5`)·행 호버 효과·미니멀 보더
- ko·en 양쪽 적용

### 디버그 기록

- **30분 디버그: 구독 관리 버튼 무반응** (`7f18178`)
  - 1차 진단: 버튼 DOM·onClick 정상 → 함수 진입 확인 위해 console.log 단계별 추가
  - 2차 진단: env URL 정상·session 정상 → fetch URL 정상 → response 404 "Paddle customer not found"
  - 3차 진단: `profile.paddle_customer_id` NULL 확인 → webhook 누락
  - fix: webhook에 `profiles` UPDATE 추가 + Paddle API key 권한 추가
  - 학습: 단계별 console.log로 어느 지점에서 멈추는지 추적이 가장 빠른 진단 방법

### 누적 commit (2026-05-19)

- `38c2c58`: feat(payment) Customer Portal redirect
- `fb437bb`: refactor(db) stripe→paddle 컬럼명 변경
- `1cb5a8c`: fix(payment) webhook profile.paddle_customer_id 동기화
- `7f18178`: debug(payment) handleManageSubscription 단계별 console.log
- `4556985`: feat(seo) robots.txt 정리 + sitemap.xml 자동 생성
- `830b75c`: fix(build) robots.txt 빌드 후 강제 복사
- `63e36da`: i18n(checkout) CheckoutSuccess·CheckoutFailed 다국어 적용
- `ea6986b`: content(about) About 페이지 작성
- `3b9ee72`: content(contact) Contact 페이지 작성
- `a384165`: content(faq) FAQ 8개 추가
- `ea202fe`: refactor(pricing) 비교표 정리 + 잡스 스타일 UI

### 출시 일정 갱신

- 기존 5/31 마감 → 6월 첫째주 출시로 1주 연기
- 5/24(일) AdSense + Paddle Production 심사 신청 예정
- 심사 거절 시: 출시 강행 후 재심사 진행 (사용자 결정)

### 사용자 정서 메모

- 2일 누적 작업으로 피곤 누적
- 새벽 1시 작업 종료
- 결제 시스템 100% 완성 + 콘텐츠 4개 페이지 + Pricing 정리 = 큰 진전

---

## 2026-05-17 — 대시보드 회귀 fix 3건 + 전날 회귀 fix 2건 (reviewer + 페이지 제목)

### 완료
- ✅ **Fix 2: 페이지 제목 "Playground" → "Dashboard"** (strings.ts)
  - KO: `"플레이그라운드"` → `"대시보드"`, subtitle `"오늘의 연습과 진행 상황"` → `"오늘의 연습과 진행 영역"`
  - EN: `"Playground"` → `"Dashboard"`
- ✅ **Fix 1: reviewer NewUserView 회귀** (Dashboard.tsx + migration)
  - `isNewUser` 조건에 `!hasAnyProgress` 게이트 추가 (`user_sublevel_progress` fallback)
  - `user_sessions` RLS가 막혀도 level progress 존재 시 신규 사용자 아님으로 처리
  - `supabase/migrations/20260516_reviewer_sessions_rls.sql` 생성 (user_sessions RLS 보강 + last_practice_date 트리거)
- ✅ **작업 1: KPI 카드 상태별 메시지 분기 정합** (`4fa8e0f`)
  - 상태 2 스트릭 서브텍스트: `streakTodayFirst` → `streakStartFresh` ("Start fresh today")
  - 상태 2 정답률·속도: `"첫 세션 이후 표시"` → `kpiNoDataToday` ("No data today")
  - 상태 2 XP: `"첫 세션 이후 표시"` → `kpiNotYet` ("Not yet started")
  - strings.ts 3키 추가: `streakStartFresh` · `kpiNoDataToday` · `kpiNotYet` (KO·EN)
- ✅ **작업 2: MasteryHeroCard 대시보드에서 제거** (`4fa8e0f`)
  - Dashboard.tsx에서 MasteryHeroCard·MasteryHeroCardSkeleton·computeMasteryScore 의존 전체 제거
  - `useLevelProgress` 단순화: `progress: levelProgress`만 유지 (getProgressFor·progressLoading 제거)
  - MasteryHeroCard 컴포넌트 파일 자체는 유지 (LevelSelect 등 단계 선택 영역에서 사용)
- ✅ **작업 3: 마지막 활동 카드 LastActivityCard 노출 강화** (`4fa8e0f`)
  - `lastActivityData` fallback 추가: `user_sessions` 없을 때 `dailyStats30d`에서 마지막 연습일 데이터 활용
  - reviewer 또는 RLS 문제로 세션 조회 실패 시에도 카드 노출

### 검증
- 794/794 PASS (타입 에러 0, 빌드 성공)

### 짚힌 영역
- ⚠️ `supabase/migrations/20260516_reviewer_sessions_rls.sql` → Supabase Dashboard SQL Editor에서 수동 실행 필요
  - user_sessions RLS SELECT·INSERT 정책 + last_practice_date 트리거 보강
- ⚠️ MasteryHeroCard 단계 선택 화면(LevelSelect)에는 여전히 적용된 있음 — 대시보드 제거 영역만

---

## 2026-05-16 — 대시보드 전면 단순화 sprint (탭 제거 + 3 상태 분기 + Top 5)

### 완료
- ✅ **대시보드 전면 재설계** (`702a8a4`)
  - 탭 영역 (Diagnosis/Rhythm/Activity) 자체 제거
  - 단일 페이지 미니멀 구성 완료
  - 3 상태 분기:
    1. 신규 사용자 (세션 X + lastPracticeDate null) → NewUserView (큰 CTA) + AI 카드만
    2. 오늘 활동 X → EmptyTodayNotice + KPI 비활성 + LastActivityCard + 음표 + AI
    3. 오늘 활동 O → KPI 정상 + 음표 + AI
  - KPI 4 카드: 스트릭·정답률·속도·오늘 XP
  - 비교 기준: 어제 → 마지막 활동 데이터 (자동 fallback, "vs 최근")
  - formatDelta 함수: ±0 노이즈 회피, 방향 화살표 (↑/↓)
- ✅ **WeakSlowNotesCards 신규** (`702a8a4`)
  - Top 3 → Top 5
  - 옥타브 정확 표시: C4·F#3 (note_key + octave 통합 key)
  - 색상: Top 1 빨강 (#E24B4A), Top 2~5 노랑 (#EF9F27)
  - 5+ 시도 영역만 완료
- ✅ **i18n dashboard 섹션 재작성**
  - 신규 키: emptyToday·newUser·vsLast·lastActivity·aiFeedbackSubtitle·daysAgo·yesterday·today
  - 폐기 키 영역은 유지 (호환성 — 출시 후 AI 보고서 도입 시 재활용 가능)
- ✅ **컴포넌트 archive 이동**
  - DiagnosisTab → src/components/_archive/DiagnosisTab.tsx
  - BatchAnalysisSection → src/components/_archive/BatchAnalysisSection.tsx
  - 향후 AI 보고서 도입 시 재활용 가능

### 제거된 영역 (AI 보고서로 이동 — 출시 후 PENDING)
- 일별 정답률 그래프 (XpBarChart, Daily accuracy)
- 평균 반응 시간 추이 (AccuracyReactionChart)
- 공식 학습 분석 (BatchAnalysisSection)
- 취약점 분석 테이블
- XP Trend 그래프 (Rhythm 탭)
- Weakest Notes Top 10 (Top 5로 통합)
- LEAGUE 카드 (Activity 탭)

### 검증
- 794/794 PASS (Dashboard.test.tsx 6 tests 신규 영역 정합)
- `npx tsc --noEmit` 에러 X
- `npm run build` 성공

### 짚힌 영역
- ⚠️ reviewer 정책 (작업 0) = 이전 commit 2968a18에서 적용됨 — 검증 통과 (이번 sprint 재확인 X)
- ⚠️ 스트릭 정책 (작업 3) = 현재 calendar day 유지 + "오늘 박으면 N+1일째" 동기 메시지 완료

---

## 2026-05-16 — 대시보드·티어·차트 6개 영역 통합 fix (reviewer 정책 갈음)

### 완료
- ✅ **작업 0: reviewer Premium 잠금 우회 제거** (`2968a18`) ⭐ 가장 중요
  - Dashboard aiReportTier: `isReviewer || tier === pro` → `tier === pro`
  - reviewer = Free tier 동등 잠금 (AI Feedback blur·CTA 적용됨)
  - ComingSoonGate·Index isPrivilegedRole = 유지 (게임 영역 접근 우회)
  - 이유: Paddle 심사관이 결제 흐름 시나리오 검증 기록할 영역
- ✅ **작업 2: 탭 순서 Diagnosis → Rhythm → Activity** (`f604d56`)
  - VALID_TABS·기본 탭·handleTabChange URL fallback 정합
  - Dashboard.test.tsx EN default 정합 + async findByText 완료
- ✅ **작업 3·4: 옥타브 + 색상 + Formal 최하단** (`e7ada20`)
  - stats key = note_key + octave (예: C4·F#3)
  - Top 1 빨강·Top 2·3 노랑 완료 (음표 라벨 + bar 색상 정합)
  - BatchAnalysisSection = DiagnosisTab 최하단 (무거운 분석 영역)
- ✅ **작업 5·6: 정확도·속도 그래프 X축 + 계산 진단** (`354934e`)
  - slotDates 영역 완료 (왼쪽 = 오래된, 오른쪽 = 오늘)
  - 가중 평균 정합: accAvg = overallAccuracy (단순 일별 평균 → 전체 정답/전체 시도)
  - 반응 시간: Latest/Avg/Min(가장 빨랐던 날) 완료
  - 빈 슬롯도 X축 라벨 완료 (시간 흐름 인지)
- ✅ **작업 7: 활동 탭 LEAGUE 제거 + 순서** (`676c38b`)
  - 4 카드 → 3 카드 (Current Streak → Longest Streak → Today XP)
  - grid-cols-1 sm:grid-cols-3
  - league strings 영역 유지 (출시 후 재활용)

### 짚힌 영역
- ⚠️ 정확도 계산 진단 결과: 사용자 "84%가 안 맞다" 짚음 = 단순 일별 평균 적용된 영역에서 가중 평균으로 정합 완료
  * 이전 = sum(daily accuracy) / day count → 적은 데이터 날·많은 데이터 날 동등 가중
  * 신규 = sum(correct) / sum(attempts) → 정확한 가중 평균 (KPI Accuracy와 정합)
- ⚠️ reviewer 완료 시나리오: Premium 카드 blur 적용됨 + UpgradeModal 노출 → 결제 흐름 검증 기록할 영역

### 검증
- 794/794 PASS (NoteGame.consecutive flaky 1건 단독 실행 시 9 PASS)
- `npx tsc --noEmit` 에러 X

---

## 2026-05-16 — 대시보드·게임 다이얼로그 통합 fix 5건 (i18n 전수·차트·순서·잠금·음표별 비교)

### 완료
- ✅ **통합 fix 1+3+4: Diagnosis 탭 i18n + 차트 + 순서** (`2463998`)
  - strings.ts: `diagnosis` 섹션 40+ 키 (KO·EN) + `aiCoachingDetail` 6 키
  - DiagnosisTab·BatchAnalysisSection 전수 useT() 분기
  - 차트 X축 영역 슬롯 완료 (7d=7, 30d=30) — 데이터 1개도 자연스러움
  - 핵심 숫자 강조 (최근·평균·최고 text-2xl)
  - 순서 재배치: KPI → 약점 Top 3 → 느린 Top 3 → 공식 학습 분석 → 취약점 → 차트
- ✅ **통합 fix 2: AI Feedback 프리미엄 잠금 검증** (`d20b96d`)
  - §5.4 영역 그대로 적용되어 있음 (회귀 X) 검증
  - PremiumBlurCard blur-layer에 `pointer-events-none` 추가 완료 (잠금 우회 차단)
- ✅ **통합 fix 5: 음표별 비교 분석** (`ef074f1`)
  - 신규 `src/lib/noteComparison.ts`: 최근 30 vs 이전 120 비교, ±0.1초·±2%p 노이즈 회피
  - 신규 `src/components/AICoachingDetail.tsx`: 4 카테고리 (빠른·느린·정확도 ↑·↓) Top 2씩
  - Guest = 박지 말 것 (useAuth 분기), 신규 음표·데이터 부족 영역 = 렌더링 X
  - SublevelPassedDialog·GameOverDialog 안에 완료

### 검증
- 794/794 PASS (각 fix 후 회귀 X)
- `npx tsc --noEmit` 에러 X

### 짚힌 영역
- ⚠️ `responseLinePoints` ref 영역 제거 (사용 안 함) — 출시 후 cleanup
- ⚠️ noteComparison의 currentWindow/previousWindow = 30/120 (조정 가능 영역, 출시 후 사용자 피드백)

---

## 2026-05-16 — §5.4 회귀 fix 3건 (런타임 에러·한·영 혼재·로딩 인지)

### 완료
- ✅ **회귀 fix 1: historicalAccuracy null 가드** (`6a5a12e`)
  - 원인: MasteryHeroCard `avgReactionRatio.toFixed(2)` 호출 시 DB null 통과해 crash
  - MasteryHeroCard: `!== undefined` → `!= null` (null·undefined 모두 covers)
  - Dashboard.tsx: `prog?.avg_reaction_ratio ?? undefined` (null → undefined 정합)
- ✅ **회귀 fix 2: 게임 결과 다이얼로그 한·영 혼재** (`cbaddad`)
  - strings.ts: `gameDialogs` 섹션 신규 (18 키, KO·EN)
  - GameOverDialog·SublevelPassedDialog: hardcoded KO → useT() + formatI18n
  - 테스트 23개 EN default 정합 (GameOver 6 + SublevelPassed 17)
- ✅ **회귀 fix 3: Mastery 카드 Skeleton UI** (`e6ef454`)
  - MasteryHeroCardSkeleton 신규 export (실제 카드 형태 회색 박스 + animate-pulse)
  - Dashboard: progressLoading && !currentMastery → Skeleton 완료
  - 로딩 완료 후 자연스럽게 실제 카드 전환

### 검증
- 794/794 테스트 PASS (각 fix 후 회귀 X)
- `npx tsc --noEmit` 에러 X
- 시나리오: 신규 사용자 대시보드 진입 → 런타임 에러 X, Skeleton 노출 → 데이터 로드 후 실제 카드

---

## 2026-05-16 — §5.4 사용자 대시보드 부분 잠금 sprint (5개 영역)

### 완료
- ✅ **작업 1: Mastery Score → Mastery 이름 변경** (`ab42e61`)
  - MasteryScoreCard·MasteryHeroCard 사용자 노출 텍스트 (KO·EN)
  - 변수명·컴포넌트명은 유지 (영향 범위 안전 영역)
- ✅ **작업 5: "Premium으로 보기" → "프리미엄 혜택 보기 →"** (`5a5e33b`)
  - PremiumBlurCard·MasteryScoreCard 모두 정합
  - EN: "View Premium Benefits →" (UpgradeModal과 동일)
- ✅ **작업 4: 대시보드 영어 번역 누락 전수 적용** (`6c466c8`)
  - `strings.ts`: dashboard 섹션 신규 (60+ 키, KO·EN)
  - Dashboard.tsx: hardcoded KO 모두 useT() 분기
  - formatDateTime → ko-KR/en-US locale 분기
  - date-fns formatDistanceToNow → ko/enUS locale 분기
  - DAY_LABELS → t.dashboard.dayLabels (S·M·T·W·T·F·S / 일·월·화·...)
  - Dashboard.test.tsx: EN default 정합 (6 tests)
- ✅ **작업 3: AI 분석 보고서 프리미엄 잠금 + blur** (`f08f341`)
  - aiReportTier 계산: admin·reviewer·pro → premium (풀), 그 외 → free (blur)
  - AI 피드백 카드 리포트 그리드 PremiumBlurCard 완료
  - handleOpenUpgrade → ?upgrade=1 쿼리 + UpgradeModal 자동 노출
  - 카드 헤더 정상 노출 (어떤 영역인지 인지)
- ✅ **작업 2: AI Coaching 게임 결과 다이얼로그 정합** (`81c622a`)
  - aiCoaching.ts: `historicalAccuracy` 옵션 + comparisonPrefix(up/flat/down, KO·EN)
  - ±2%p 이내는 유지 완료 (노이즈 회피)
  - SublevelPassedDialog·GameOverDialog: useAuth + useLevelProgress 완료
  - 사인인 + 이전 시도 ≥5 영역만 비교 완료
  - Guest = 현재 세션 분석만 (기존 그대로)

### 검증
- 794/794 테스트 PASS — 모든 작업 후 회귀 X
- `npx tsc --noEmit` 에러 X
- 5개 영역 각 별도 commit + push

### 짚힌 영역
- ⚠️ Note-level 비교 분석 (음정별 기록 있음 vs 새 음정 분기) = 출시 후 PENDING (간단 비교부터 완료)
- ⚠️ Dashboard 주석 영역(`/* AI 피드백 */` 등) 한국어 유지 — 사용자 노출 X

---

## 2026-05-16 — 블로그 6편 추가 + cover image 시각 정합

### 완료 — 블로그 신규 6편 (한·영 12파일)
- ✅ **§1-13 초견과 작곡·즉흥연주** (`83649e6`) — Sloboda 1985, "초견의 정석"
  - 내부 사운드 라이브러리 + 3가지 연결 고리 + 즉흥 브릿지 훈련법
- ✅ **§7-80 일·주·월 진단 시스템** (`c3a4459`) — Kruger & Dunning 1999 DOI 검증, "뮤직 테크 & 미래"
  - 자기평가의 한계 + 세 시간 단위 진단 프레임워크
- ✅ **§3-42 단계별 난이도 설계** (`ab76d0a`) — Karpinski 2000, "실전 연습 가이드"
  - 틀린 입력 반복의 위험 + 3원칙 (범위→정확도→속도)
- ✅ **§4-50 즉각 음표 인식** (`e7faded`) — Chase & Simon 1973 DOI 검증, "초견의 정석"
  - 이미지 1개: Treble_clef_and_Bass_clef.svg (curl 200 확인)
  - 체스 고수 패턴 인식 연구 → 악보 청크 인식 적용
- ✅ **§1-3 학습 정체 5가지 패턴** (`e05da5d`) — Wan & Schlaug 2010 DOI 검증, "초견의 정석"
  - 5패턴 진단표 + 패턴별 처방
- ✅ **§3-36 같은 악보 vs 새 악보** (`a1ee536`) — Roediger & Butler 2011 DOI 검증, "실전 연습 가이드"
  - spaced retrieval 원리 + 실전 비율 제안 (새 50~60%, 재방문 30%)

### 이미지·DOI 검증 결과
| 항목 | URL/DOI | 결과 |
|---|---|---|
| Treble_clef_and_Bass_clef.svg | Wikimedia Commons (Chrome UA) | ✅ 200 |
| Kruger & Dunning 1999 | DOI 10.1037/0022-3514.77.6.1121 | ✅ 302→APA |
| Chase & Simon 1973 | DOI 10.1016/0010-0285(73)90004-2 | ✅ 302→Elsevier |
| Wan & Schlaug 2010 | DOI 10.1177/1073858410377805 | ✅ 302→Sage |
| Roediger & Butler 2011 | DOI 10.1016/j.tics.2010.09.003 | ✅ 302→Elsevier |

### 누적 현황 (5/16 기준)
- KO 46 + EN 46 = **92편** (이전 40+40 = 80편, +12편)
- 빌드 에러 X

---

## 2026-05-16 — 블로그 cover image 시각 정합 (그라데이션 아이콘 박스)

### 완료
- ✅ **cover image → 카테고리별 그라데이션 패턴 교체** (`a8f12bb`)
  - 신규 `src/lib/categoryStyle.ts` — KO+EN 10개 카테고리 → gradient·icon·textColor 매핑
  - 신규 `src/components/blog/CategoryCover.tsx` — `variant="card"` (w-16 h-16 아이콘) / `variant="hero"` (aspect-video)
  - `Blog.tsx`: coverImage `<img>` → `<CategoryCover variant="card" />` 교체 (모든 글 통일)
  - `BlogPost.tsx`: `<figure>` + figcaption → `<CategoryCover variant="hero" />` 교체
  - frontmatter coverImage 데이터 보존 (출시 후 재활용 가능)
- ✅ **카테고리 cover 크기 축소** (`b33280d`) — aspect-[16/10] 큰 박스 → w-16 h-16 아이콘 박스
  - 카테고리 텍스트 제거 (우측 라벨 중복 제거)
  - Blog.tsx 카드: `flex-row items-start` 직결 (모바일도 좌측 아이콘 + 우측 텍스트)

### 카테고리별 색상 매핑
| 카테고리 | 색상 | 아이콘 |
|---|---|---|
| 음악 이론 & 화성학 / Theory & Harmony | amber | 📚 |
| 초견의 정석 / Sight-Reading Lab | amber | 📚 |
| 실전 연습 가이드 / Practice Hub | emerald | 🎵 |
| 직군별·학습과학 등 | emerald | 🎵 |
| 뮤직 테크 & 미래 / Music Tech | sky | 🎧 |
| 악기별 / Instrument | violet | 🎹 |
| 미매핑 fallback | stone | 🎼 |

- ✅ **글 상세 hero 영역 제거** (`a4b6c0b`) — 중복 카테고리 표시 제거, 본문 바로 시작
  - `BlogPost.tsx`: `<CategoryCover variant="hero" />` + import 제거
  - 카테고리 cover = 목록 카드(w-16 h-16)에만 유지

### 검증
- 794/794 테스트 PASS — 회귀 X
- `npx tsc --noEmit` 에러 X
- `npm run build` 성공

---

## 2026-05-15 — SEO fix + Paddle reviewer + UI 정비 + 블로그 D+A 이미지 정책

### 완료

#### SEO 색인 fix
- ✅ **canonical 태그 임시 제거** (`27d94aa`) — 모든 페이지가 `https://www.noteflex.app/`을 canonical로 가리켜 Google이 블로그 글을 홈 중복으로 판단 → 색인 0건 → 전체 canonical 제거 (임시 옵션 B)
- ⏳ **동적 SEO (옵션 A)** = react-helmet-async 라우트별 canonical·title·description·OG → 출시 후 PENDING

#### Paddle 심사관 reviewer 흐름 (4 Stage)
- ✅ **Stage 1: DB 마이그레이션** (`14c5302`) — `profiles.role` CHECK 확장 (`reviewer` 추가), `is_reviewer()` RPC, `forpaddle@noteflex.app` 계정 (role='reviewer', nickname='paddle_reviewer')
- ✅ **Stage 2: /api/reviewer-login Serverless Function** (`fff32b9`) — 이메일 화이트리스트 + REVIEWER_ACCESS_CODE (timing-safe compare) + IP rate limit 5/min + admin.generateLink → verifyOtp → {access_token, refresh_token}
- ✅ **Stage 3: AuthModal + ComingSoonGate 우회** (`6992240`) — `isPrivilegedRole = admin || reviewer`, GAME_ENABLED bypass
- ✅ **Stage 4: 운영 가이드** (`d9ed1c5`) — `docs/reviewer/SETUP.md`
- ✅ **/reviewer-login 별도 URL** (`0462f2d`, `feb212c`) — ComingSoonGate 없는 독립 진입 경로

#### UI 정비 sprint (commits `20df266`~`c1d4428`)
- ✅ 언어 자동 감지: `detectAutoLang()` — timezone Asia/Seoul → ko, 그 외 → en
- ✅ 헤더 LangToggle 제거 (ProfilePage 표시 언어 설정으로 통합)
- ✅ "Practice Dashboard" → "Dashboard" 단어 통일
- ✅ 헤더 Profile 버튼 삭제 + displayName 스마트 노출 (자동닉네임 → 이메일 prefix + Tooltip)
- ✅ displayName chip 스타일 (inline-flex rounded-full px-3 py-1.5) + 조건부 Tooltip (자동닉네임만)
- ✅ UpgradeModal EN 번역 + "View Premium Benefits" testid
- ✅ LockedByProgressDialog 신규 — ESC·backdrop 막힘, 티어 영역 첫 미통과 단계로 이동
- ✅ LevelSelect 잠금 우선순위: subscription → progress → daily limit
- ✅ ProfilePage 전체 EN 번역 + 표시 언어 토글 fix (setLang() 호출 누락 정정)
- ✅ Index/PlayPage GAME_ENABLED 우회 (admin·reviewer)

#### 블로그 D+A 이미지 정책 sprint
- ✅ **IMAGE_POLICY.md** (`bfc27ad`) — D+A 정책 완료 (HISTORY_THEORY = Wikimedia 2개, PRACTICAL_GUIDE = 1개)
- ✅ **80편 전수 점검** (`8feb072`~`f9f1f84`) — PRACTICAL_GUIDE 이미지 1개 축소 + 후크 위치 이미지 제거
- ✅ **본문 출처 섹션 정리** — PRACTICAL_GUIDE 44편 이미지 출처 섹션 제거 (`a9a8c43`), HISTORY_THEORY 36편 이미지 출처 h3→h2 + References 통합 (`0b3ce5e`)
- ✅ **DOI 404 fix** — Cepeda `0033-295X` → `0033-2909` 오타 정정, Hallam 1997 DOI URL 제거
- ✅ **cover image 렌더링 추가** (`bf3442f`) → 무관 이미지 문제 발견 → 그라데이션 정책 전환

### 짚힌 영역
- ⚠️ Vercel env vars `SUPABASE_SERVICE_ROLE_KEY`, `REVIEWER_ACCESS_CODE` 설정 필요 (Paddle 심사 전)
- ⚠️ Supabase Dashboard에서 `20260515_reviewer_role.sql` 적용 필요
- ⚠️ www → non-www 301 = Vercel Dashboard에서 설정 (코드 영역 X)

### 검증
- 794/794 테스트 PASS (누적)
- 빌드 에러 X

---

## 2026-05-14 — Termly 약관 4종 완성 + KO 번역 + 14세 정책 정합

### 완료
- ✅ **Cookie Policy 생성** (Termly Pro 사이트 스캔)
  - rc::h (reCAPTCHA), test_cookie (DoubleClick) 자동 감지
- ✅ **Terms of Service 생성** + 2개 영역 수정
  - ⚠️ §17 Binding Arbitration = Termly default "European Arbitration Chamber (Belgium)" → **KCAB Seoul** 완료
  - §8 USER GENERATED CONTRIBUTIONS 잔여 조항 정리 (사용자 콘텐츠 X 정합)
- ✅ **Refund Policy 생성** + 디지털 SaaS 영역 재작성
  - 한국 7일 청약철회 (전자상거래법 §17) + EU/UK 14일 cooling-off 완료
  - Paddle 자동 환불 흐름 완료
- ✅ **4종 약관 KO 번역 완료** (Termly 한국어 미지원 → Claude 직접 완료)
  - privacy.ko.md: §1~§18 글로벌 + **§19 PIPA 특칙** 풀버전
  - PIPA 정합 조항: 처리 목적·항목·보유 기간·제3자 제공·위탁업체 7곳·정보주체 권리·14세 미만·안전성·처리책임자·권익침해 구제 4기관
- ✅ **14세 정책 정합** (Termly default 18세 → 14세 갱신)
  - terms.en.md·terms.ko.md 도입부
  - privacy.en.md·privacy.ko.md §11
  - privacy.ko.md §19.7 PIPA (기존 14세 적용됨)
- ✅ **8개 파일 src/content/legal/ 완료 + push 완료**

### 짚힌 영역
- ⚠️ Termly 영문판 Terms §17 Arbitration 영역 다음 갱신 시 KCAB로 기록하는 영역 (현재 .md만 수정 적용됨)
- ⚠️ EU GDPR 16세 미만 부모 동의 영역 — 14세로 적용된서 EU 일부 회원국 영역 불완전
- ⚠️ 시스템(가입 흐름 만 14세 동의) ↔ 약관 14세 정합 확인 필요

### 결정 적용됨
- Termly Pro 1개월 박고 4종 생성 후 self-hosted .md 통합
- 한국 사업자 등록 완료(5/13): Donofear / 367-45-01000 / 통신판매업 제 2026-서울서초-1624호 / 06640
- 미취학~13세 시장 진입 = Family Plan (출시 후 6~8주)

---

## 2026-05-12 — Auth 인증 흐름 마라톤 + Resend SMTP + Search Console + hard_delete 정정

### 작업 누적
- **Resend SMTP 연동 완료**
  - 도메인 noteflex.app 검증 (DKIM·SPF·MX·DMARC)
  - 리전 = us-east-1 (영어 기본 출시 전략에 맞춤, ap-northeast-1 → us-east-1 전환)
  - Supabase Custom SMTP 설정 (smtp.resend.com:465, Sender: noreply@noteflex.app)
- **Supabase Email Templates 정정**
  - Confirm Signup = "가입을 완료" + "가입하기 / Sign Up" 버튼 (한·영 동시)
  - Magic Link = "계속하세요" + "계속하기 / Continue" 버튼 (한·영 동시)
  - 자체 발송 시스템 = 출시 후 PENDING
- **Auth Sprint 1 (7 commits, ba17423~3876c65)**
  - Magic Link only 전환 (OTP·비밀번호 제거)
  - Step 3 제거 (닉네임·생년월일·비밀번호 입력)
  - 가입 흐름 = 이메일 + TOS·만14세 동의 + 마케팅 (Step 1 통합)
  - 닉네임 = 자동 생성 (user_ + UUID 앞 8자리)
  - 마이페이지 = 생년월일·국적·마케팅 선택 입력
  - 탈퇴 = 이메일 OTP 재인증 → 매직링크 재인증으로 변경
  - /reset-password → 메인 redirect
- **Auth Sprint 2 (4 commits, fe979dc~642cbca)**
  - 30일 내 탈퇴 계정 복구 UX (복구 vs 새로 시작 모달)
  - check_email_exists v3 (is_deleted·deleted_at 반환)
  - restore_account·hard_delete_expired_accounts RPC
  - 탈퇴 시 닉네임·아바타 보존 + partial unique index
  - 매직링크 탭 동기화 (BroadcastChannel + localStorage event)
- **탈퇴 정정 (341a8c0)** — 매직링크 재인증으로 단순화 (OTP 풀 개발 X)
- **복구 UX 정정 (ad22e04)** — 복구 완료 화면 + 기존 탭 동기화
- **새 탭 닫기 정정 (fda734e)** — PC window.close + 모바일 navigate fallback
- **"새로 시작" 시나리오 구현 (769f833)** — hard_delete_account RPC + AuthModal 확인 모달 + 6 단위 테스트
- **hard_delete_account 시그니처 정정 (43ab239)** — `hard_delete_account(p_email TEXT)` 이메일 인수 버전
  - 마이그레이션 20260513_hard_delete_by_email.sql
- **hard_delete_account = auth.users도 삭제 (db3abcb)** — 진짜 신규 가입 처리 정합
  - 기존 = profiles만 삭제 → auth.users 그대로 → 옛 user_id 로그인 + trigger 미작동
  - 신규 = profiles + auth.users 모두 DELETE → 새 user_id + 새 닉네임 + 새 created_at
  - AuthModal: shouldCreateUser false→true + noteflex_consent localStorage 저장
  - 마이그레이션 20260513_hard_delete_with_auth.sql
- **Production 마이그레이션 적용 ✅**
  - 20260512_profile_completed_default.sql
  - 20260513_account_recovery.sql
  - 20260513_preserve_nickname.sql
  - 20260513_hard_delete_by_email.sql
  - 20260513_hard_delete_with_auth.sql
- **Google Search Console 인증 완료**
  - URL 접두사: https://noteflex.app
  - HTML 파일 인증 (public/google8962581177005031.html)
  - 메인·블로그 글 URL 색인 요청 (데이터 처리 중)
- **SEO 인프라 sprint (3 commits: 777946f·ea7e7f8·14f52ad)**
  - index.html 메타 태그 보강 (OG·Twitter Card·canonical·apple-mobile-web-app)
  - sitemap.xml 자동 생성 (vite-plugin-sitemap, 빌드 시점, 74 URLs)
  - robots.txt 완료 (공개 Allow + 보호 Disallow + Sitemap 위치)
  - PENDING: public/og-image.png (1200×630) 디자인

### 검증 결과
- 신규 가입 → 매직링크 → 자동 로그인 ✓
- 탈퇴 → 매직링크 → 탈퇴 완료 ✓
- 복구하기 → 옛 데이터 유지 ✓
- "새로 시작" → 데이터 삭제 + 신규 닉네임·가입일 (auth.users 삭제 정정 후 검증 예정)
- 단위 테스트 45/45 PASS (AuthModal), 19/19 PASS (AuthCallback), 20/20 PASS (ProfilePage)

### 정책 결정
- **이메일 발송 시스템**: 출시 = Supabase 표준 (한·영 동시 표기). 출시 후 1~2주 PENDING = 자체 발송 시스템 전환 (시나리오별·언어별 분기).
- **새 탭 자동 활성화**: PC = 브라우저 보안 제약으로 JS 해결 불가. 모바일 = 같은 탭이라 자연 처리. 매직링크 서비스 공통 한계.
- **hard_delete 전략**: profiles + auth.users 모두 DELETE. SECURITY DEFINER + search_path=public,auth. 30일 내 탈퇴 계정만 허용. 익명 호출 가능.
- **블로그 자동화 전략**: 지금 = 옵션 A 유지 (Claude Code 수동, Claude Pro/Max 구독 추가 비용 X). 출시 후 1주 이내 = 옵션 C 전환 (GitHub Actions + Anthropic API, ~$5/월). 옵션 B (로컬 cron) = 스킵 (PC 켜져있어야 함). 품질 게이트 (이미지·DOI·출처·글자 수) 자체 검증으로 무인 발행 안전성 확보.

### 다음 액션
1. "새로 시작" 시나리오 재검증 (auth.users 삭제 정정 후)
2. 누적 commit push
3. SEO sprint (sitemap·robots·메타 태그)
4. Pricing·Footer·About·Contact (Phase 2 잔여)
5. Apple OAuth = 출시 후 PENDING

---

## 2026-05-12 (화) — 13일차 블로그 3편 ✅

### Commits
- C1: `feat(blog): §5-65 취미 연주자 (ko·en)` (`c71917d`)
- C2: `feat(blog): §4-48 빠른 음표 인식 (ko·en) — 14일차 차용` (`9265b35`)
- C3: `feat(blog): §1-7 어른의 초견 (ko·en) — 14일차 차용` (`db1a06d`)
- C4: `docs: 13일차 블로그 3편 ✅`

### 완료 내역
- §5-65 취미 연주자 (Bonneville-Roussy et al. 2011 DOI:10.1177/0305735609352441). 이미지: Renoir «Young Girls at the Piano» (1892) + Adolph Menzel «Das Flötenkonzert Friedrichs des Großen» (1850-52). 둘 다 PD.
- §4-48 빠른 음표 인식 (Goolsby 1994 DOI:10.2307/40285757 + Rayner 1998 DOI:10.1037/0033-2909.124.3.372). 이미지: Reading Fixations & Saccades diagram + Wilhelm Wundt 초상. ← 14일차 차용.
- §1-7 어른의 초견 (Bugos et al. 2007 DOI:10.1080/13607860601086504 + Wan & Schlaug 2010 DOI:10.1177/1073858410377805). 이미지: Manet «Madame Manet au Piano» (1868) + Vermeer «The Music Lesson» (1662-65). ← 14일차 차용.
- 13일차 신규 작성 슬롯 = §5-65 단 1개. §3-43(12일차 차용)·§8-87(10일차 차용) advance write 적용되어 있어 14일차 §4-48·§1-7 두 개 차용.

### 검증
- 6 이미지 curl HTTP 200 ✓ (Wikimedia Commons API로 파일명 확인 + UA 헤더로 429 회피)
- 모든 이미지 = Wikimedia Commons (메모리 #13 인증·공인 사이트)
- Hook 영역 = 텍스트만, 첫 이미지 = Scene 영역 (메모리 #13 패턴)
- 학술 인용 5개 DOI 완료
- 누적 64편 (한 32 + 영 32)
- §1.1 표 13·14일차 ✅ 갱신, §6 v18 완료

### 다음 세션
- §X-1 검증 정정 sprint (autofill·Step 3 흐름·trigger·코드) — audit 문서 §6 정정 우선순위 기반
- Pro 업그레이드 + Resend SMTP 연동 (audit 문서 §5 검증 환경 권장)
- profile_completed 마이그레이션 drift 정정 (audit 문서 Bug #4)

---

## 2026-05-11 (월) — 검증 영역 5건 정정 sprint ✅

### Commits
- C1: `fix(auth): 모달·폼 state 열림/사용자 변경 시 초기화` (`1e188b4`)

### 검증 영역 발견 5건 → 정정

| # | 영역 | 버그 | 정정 |
|---|---|---|---|
| 1 | AuthModal | open 시 form state 초기화 X | open prop + useEffect 초기화 |
| 2 | 탈퇴 모달 | deletePw 재오픈 시 잔존 | showDeleteModal 변화 시 리셋 |
| 3 | Magic Link | 새 탭 열림, 원본 탭 미인식 | BroadcastChannel(noteflex_auth) + AuthBroadcastListener |
| 4 | Google OAuth | redirectTo = origin (callback 미통과) | redirectTo = /auth/callback |
| 5 | ProfilePage | 이전 사용자 비번 잔존 | user.id 변화 시 pw 필드 초기화 |

### 세부 내역
- **AuthModal `open` prop**: `false→true` 전환 시 모든 form state 초기화. `initialSignupStep` 변경 시에도 초기화 (BroadcastChannel 수신 후 Step 2→Step 3 전환 지원).
- **`isOAuthUser` prop**: Step 3 비번 필드 숨김 + `updateUser` 스킵 + `getUser`로 userId 획득.
- **Google OAuth `redirectTo`**: `window.location.origin` → `/auth/callback` 으로 변경 (profile_completed 분기 경유).
- **AuthCallback BroadcastChannel**: 인증 완료 → `postMessage({ type: 'AUTH_COMPLETE', profile_completed })` → `window.close()` 시도 → 실패 시 "이 탭을 닫아주세요" 안내 UI.
- **App.tsx `AuthBroadcastListener`**: `AUTH_COMPLETE` 수신 → `refreshSession()` → `/?complete_profile=1` 또는 `/` navigate.
- **ProfilePage 탈퇴 모달**: `showDeleteModal=true` 시 `deletePw` 초기화.
- **ProfilePage 비밀번호 폼**: `user?.id` 변경 시 `currentPw/newPw/confirmPw` 초기화.

### 검증
- 780/780 PASS (AuthModal +7, AuthCallback 8개 전면 교체, ProfilePage +2), tsc 0 errors

### PENDING
- BroadcastChannel Safari < 15.4 미지원 — 출시 후 fallback 검증 필요 (현재 안내 메시지로 커버)

---

## 2026-05-11 (월) — OTP → Magic Link 변경 ✅

### Commits
- C1: `feat(auth): OTP → Magic Link 변경` (`252a21c`)

### 완료 내역
- **AuthModal Step 2 교체**: 6자리 OTP 입력 폼 → "메일을 확인해주세요" 안내 화면 (magic-link-screen)
- **signInWithOtp emailRedirectTo 추가**: `${origin}/auth/callback` — Supabase Magic Link 방식
- **/auth/callback 신규 페이지**: getSession() → profile_completed 분기 → `/?complete_profile=1` 또는 `/` 리다이렉트
- **Index.tsx `?complete_profile=1` 감지**: useSearchParams + useEffect → showAuth=true + initialSignupStep=3 자동 오픈
- **App.tsx**: /auth/callback 라우트 등록 (ComingSoonGate 외부, reset-password와 동일 레벨)
- **백드롭·ESC 닫기**: Magic Link 단계에서는 모달 외부 클릭·ESC로 닫기 허용 (OTP 단계는 불가 → 이제 불필요)
- **재전송 cooldown**: 60초 setInterval, 재전송 버튼 disabled + "X초 후 재전송" 텍스트
- **테스트**: AuthModal 테스트 전면 교체 (OTP 12개 삭제 → Magic Link 6개 + AuthCallback 6개 신규) — 769/769 PASS, tsc 0 errors

### Supabase Dashboard 사용자 직접 완료 필요
- 메일 템플릿 "Confirm signup": `{{ .Token }}` → `{{ .ConfirmationURL }}` 교체 (Magic Link 방식 전환 필수)

### Apple 로그인 PENDING
- Apple OAuth = Apple Developer 계정($99/년) 등록 후, iOS 출시 시점에 완료

---

## 2026-05-11 (월) — §X-2 계정 설정 버그 정정 ✅

### Commits
- `fix(settings): 저장 버튼 활성화 + 비번 확인 검증` (`bfb8dac`)
- `docs: 계정 설정 버그 정정 ✅`

### 완료 내역
- **닉네임 저장 버튼 버그**: profile이 null로 마운트 후 로드될 때 formData가 `""`로 초기화 → `isDirty=true`이지만 `nicknameCheckInput=""`이라 hook이 `"idle"` 반환 → `canSave=false`. `profileSynced` ref + `useEffect`로 프로필 첫 로드 시 한 번만 동기화해 해결.
- **비번 확인 피드백**: `data-testid` 추가(pw-mismatch-error, pw-match-ok), 메시지 "일치하지 않습니다/일치합니다"로 통일.
- **테스트 2케이스 추가**: 현재+새+확인 충족 시 버튼 활성화 + 불일치 시 비활성화+피드백 (ProfilePage.test.tsx 총 24개 PASS).

---

## 2026-05-11 (월) — §X-2 로그인·세션·계정 sprint ✅

### Commits
- B2: `feat(auth): B2 비밀번호 재설정 흐름` (`8171627`)
- C1/C2/C3: `feat(auth): C1/C2/C3 비밀번호 변경·닉네임 23505·회원 탈퇴` (`99eb90e`)
- docs: `docs: §X-2 로그인·세션·계정 sprint ✅`

### 완료 내역
- **B2 비밀번호 재설정**: AuthModal forgot mode (헤더·이메일 폼·발송 확인 UI·푸터 분기) + /reset-password 페이지 (PASSWORD_RECOVERY 이벤트 수신 + 강도 미터 + 비밀번호 확인)
- **C1 비밀번호 변경**: ProfilePage에 현재 비밀번호 검증(signInWithPassword) → updateUser + strength meter
- **C2 닉네임 23505**: ProfilePage save 시 DB 23505 즉시 인라인 피드백 (기존 useNicknameAvailability도 유지)
- **C3 회원 탈퇴**: GDPR/PIPA soft delete — deleted_at/is_deleted/deletion_reason 컬럼 + request_account_deletion RPC(SECURITY DEFINER) + 비밀번호 재확인 모달
- **password.ts**: analyzePassword + strength constants 공용 라이브러리 분리 (AuthModal 하위 호환 re-export 포함)
- **테스트**: AuthModal.test.tsx B2 4개 추가(총 36개) + ProfilePage.test.tsx C1 5개·C2 1개·C3 5개 추가(총 22개). 전체 PASS.
- **Production Apply 필요**: `20260511_account_deletion.sql`
- 이메일 변경 = 읽기 전용 식별자 정책으로 구현 제외.

---

## 2026-05-11 (월) — 12일차 블로그 3편 ✅

### Commits
- C1·C2·C3: 12일차 블로그 6편 (ko+en)
- C4: docs 갱신

### 완료 내역
- §4-47 음정 인식의 신경과학 (Zatorre & Salimpoor 2013 DOI:10.1073/pnas.1301228110). 이미지: Helmholtz 초상 + Guido d'Arezzo 초상 (PD).
- §5-58 교회 반주자의 초견 (McPherson 1994 DOI:10.2307/3345701). 이미지: Praha St. Nicholas 파이프 오르간 (CC BY-SA 4.0) + BWV614 자필악보 (PD).
- §3-43 초견을 게임처럼 만들기 (Ryan & Deci 2000 DOI:10.1037/0003-066X.55.1.68). 이미지: Mozart Family Croce (PD) + Guidonian Hand (PD). ← 13일차 advance write.
- 이미지 6개 모두 curl HTTP 200 PASS. Wikimedia Commons API로 파일명 확인.
- 누적 58편 (한 29 + 영 29). ※PENDING 이력 "49편" = 52편 오기.
- §1.1 표 11·12일차 ✅ 갱신, §6 v16·v17 완료.

---

## 2026-05-10 (낮~저녁) — §X-1 가입+보안 sprint ✅ + 흐름 정정

### Supabase Dashboard 설정 (사용자 직접 완료)
- Confirm email = ON
- Secure email change = ON
- Email OTP expiration = 3600초
- Confirm signup 템플릿 = OTP 방식 ({{ .Token }})

### Commits
- `6d606d7` feat(auth): 이메일 OTP 가입 인증 + 6자리 코드 모달 (§X-1 C1 초기)
- `4731e67` feat(auth): 이메일 중복 검증 + 로그인 redirect 안내 (§X-1 C2)
- `606ce6b` feat(auth): 비밀번호 강도 검증 + 실시간 UI (§X-1 C3)
- `6b917a0` fix(rls): 전 테이블 RLS 정책 검증 + 정정 (§X-1 C4)
- `4670b58` fix(rls): RLS 마이그레이션 production 테이블만 완료
- `4eaa9e2` fix(auth): 가입 흐름 3단계 분리 — 이메일 검증 먼저 완료 (§X-1 C1 정정)

### 최종 가입 흐름 (정정 완료)
- **Step 1**: 이메일 입력 → checkEmailExists(v2) → signInWithOtp({ shouldCreateUser: true })
  - confirmed=true → 차단 + 로그인 CTA / confirmed=false → OTP 재전송 (미인증 통과)
- **Step 2**: 6자리 OTP 입력 → verifyOtp({ type: 'email' }) → 이메일 인증 완료
  - X 버튼(우상단) + "이미 가입했나요? 로그인" 링크 → switchMode('login')
  - backdrop·ESC = 닫기 X
- **Step 3**: 비밀번호(강도 검증) + 닉네임(중복 즉시 피드백) 입력 → updateUser + completeProfile
  - 23505(unique) → nicknameConflict 인라인 에러 → Step 3 유지

### 정합 정정 커밋
- `440dd0e` fix(auth): check_email_exists 미인증 분기 (RPC v2 + 마이그레이션)
- `37ad923` fix(auth): Step 3 nickname 중복 23505 즉시 피드백
- `e911e49` fix(auth): OTP 모달 닫기 버튼 + 로그인 복귀

### 검증
- 754/754 PASS, tsc 0 errors
- AuthModal 32 tests (analyzePassword 6·PW강도 5·이메일중복 4·OTP 8+4·프로필 3+1·OTP닫기 4)

### 마이그레이션 Production Apply 필요
- `20260510_rls_audit.sql` — is_admin() + RLS 9개 테이블
- `20260510_check_email_v2.sql` — check_email_exists v2 (user_exists, is_confirmed)

### RLS Production Apply 필요
- `supabase/migrations/20260510_rls_audit.sql` Supabase Dashboard > SQL Editor 실행
- is_admin() 함수 + 9개 테이블 정책 추가·보완

### RLS 마이그레이션 정정 (2026-05-10 오후)
- **커밋**: `4670b58` fix(rls): RLS 마이그레이션 production 테이블만 완료
- **원인**: production에 없는 테이블(payment_events 등)에 직접 DDL → 에러
- **정정**: optional 5개 테이블 `DO $block$ BEGIN ... EXCEPTION WHEN undefined_table THEN RAISE NOTICE; END $block$;` 패턴으로 감쌈
  - Core 4 (직접 DDL): profiles · user_note_logs · user_sublevel_progress · daily_sessions
  - Optional 5 (DO block): user_custom_scores · payment_events · device_change_events · user_scores · practice_logs
- **향후**: optional 테이블 생성 시 해당 마이그레이션에 RLS 함께 완료

### PENDING §X-2
- B2 비밀번호 재설정 · B4 Refresh token
- C1 비밀번호 변경 · C2 이메일 변경 · C4 탈퇴 (GDPR/PIPA 법적 의무 🔴)

### 다음 세션 시작점
- §X-2 로그인·세션·계정 sprint
- 또는 Group C (출시 직전 다른 영역)

---

## 2026-05-10 (야간) — 12 .md 파일 첫 이미지 위치 정정 sprint ✅

### 작업 내용
- 6편 × 한+영 = 12 .md 파일 본문 첫 이미지 위치 이동
- Hook 영역(첫 1~2 단락) = 텍스트 전용으로 정정
- Figure 1 → Scene·Insight 섹션 (첫 번째 H2 마지막 단락 직후) 이동

### 이동 결과 (6쌍 × 2언어)
| 포스트 | 이동 전 | 이동 후 |
|--------|---------|---------|
| §3-37 초견 실수 | 본문 첫 줄 | `## 🎼 Where Errors Concentrate` 마지막 줄 |
| §2-24 쉼표 읽기 | 본문 첫 줄 | `## 🎼 What Rests Are` 마지막 줄 |
| §8-87 21단계 | 본문 첫 줄 | `## 📐 Why 7 Levels and 21 Stages` 마지막 줄 |
| §3-38 약점 음표 | 본문 첫 줄 | `## 🎼 Why Weak Notes Don't Disappear` 마지막 줄 |
| §5-56 피아노 초견 | 본문 첫 줄 | `## 🎼 What Makes Piano Sight-Reading Different` 마지막 줄 |
| §7-79 가중치 학습 | 본문 첫 줄 | `## 💡 The Science of Frequency and Spacing` 마지막 줄 |

### Commits (C1–C6 + C7 docs)
- `aa983f1` §3-37 sight-reading-mistake-patterns (EN+KO)
- `3aa9b5a` §2-24 reading-rests-musical-silence (EN+KO)
- `27793f4` §8-87 seven-level-twenty-one-stage-system (EN+KO)
- `e961de0` §3-38 weakness-note-practice (EN+KO)
- `55a2ff6` §5-56 piano-sight-reading-guide (EN+KO)
- `c9d7904` §7-79 weighted-practice-algorithm (EN+KO)

### 다음 세션 시작점
- Group C (§X 사용자 등록·관리 Phase C) 또는
- /admin/staff-preview 시각 검증

---

## 2026-05-10 (새벽) — BlogPost coverImage 자동 렌더링 영역 조사 ✅

### 사용자 검증 발견
- 이미지가 글 시작 직후 적용된 영역 → 원인 조사 의뢰

### 조사 결과
컴포넌트 자동 렌더링 없음. **원인 = .md 파일 본문 첫 줄 이미지 (Case 2)**

- `BlogPost.tsx`: coverImage 관련 `<img>` 렌더링 없음. `<MarkdownContent>{post.content}</MarkdownContent>` 단순 패스스루
- `MarkdownContent.tsx`: ReactMarkdown 그대로 렌더링. 이미지 특별 처리 없음
- `markdownLoader.ts`: parseFrontmatter = frontmatter 제거 후 나머지 전체가 content. .md 파일 첫 줄 `![]()` = 그대로 body에 렌더링됨

### 사용자 결정
- C1 컴포넌트 정정 = 불필요 (자동 렌더링 없음)
- .md 파일 기록한 부분 정정 = **낮에 한 번에 완료 (PENDING)**
  - 12 .md 파일 본문 첫 이미지 위치 조정 (Scene·Insight 섹션 이후로 이동 또는 제거)

### Commits
- 코드 변경 없음 (컴포넌트 정정 불필요)
- (docs 커밋만)

### 다음 세션 시작점
- 12 .md 파일 이미지 위치 정정 (낮)
- Group C (§X 사용자 등록·관리 Phase C, ~5h)
- /admin/staff-preview 시각 검증

---

## 2026-05-10 (저녁) — 블로그 이미지 전수 정정 sprint ✅

### 작업 내용
- 10일차(3편) + 11일차(3편) = 6편 × 한+영 = 12 .md 파일 이미지 전량 교체
- Pexels/Unsplash 완전 제거 → Wikimedia Commons Public Domain 이미지로 대체
- 24개 이미지 모두 직접 인증 출처 (Wikimedia Commons, 공공 도서관)
- frontmatter 5개 필드 신규: `coverImage`, `coverImageAlt`, `coverImageSource`, `coverImageLicense`, `coverImageCredit`
- 본문 이미지 캡션 + 글 끝 출처 섹션 전면 갱신

### 이미지 쌍 (6쌍 × 2언어)
| 포스트 | Figure 1 | Figure 2 |
|--------|----------|----------|
| §3-37 초견 실수 | Bach BWV1001 자필악보 (PD) | Danhauser «피아노 앞의 리스트» (PD) |
| §2-24 쉼표 읽기 | Beethoven Pathétique 악보 (PD) | Beethoven Op.90 자필 1814 (PD) |
| §8-87 21단계 | Czerny Op.337 악보 (CC0) | Carl Czerny 초상 c.1820 (PD) |
| §3-38 약점 음표 | Bach BWV56 bass aria 1726 (PD) | Beethoven Op.101 스케치 1816 (PD) |
| §5-56 피아노 초견 | Beethoven Op.109 자필 1820 (PD) | Childe Hassam «At the Piano» (PD) |
| §7-79 가중치 학습 | 에빙하우스 망각 곡선 (CC BY-SA 3.0) | Ebbinghaus 초상 사진 (PD) |

### curl 검증
- HTTP 200 직접 확인: 10개 URL
- MediaWiki API 파일 존재 확인: 2개 (에빙하우스 파일 — IP rate-limit 429)

### Commits (6 blog + 1 docs)
- `928a841` §3-37 초견 실수 패턴 이미지 교체
- `f2cec52` §2-24 쉼표 읽기 이미지 교체
- `f5e10d5` §8-87 21단계 시스템 이미지 교체
- `3629081` §3-38 약점 음표 이미지 교체
- `45199fa` §5-56 피아노 초견 이미지 교체
- `69d20b4` §7-79 가중치 학습 이미지 교체
- (docs commit 예정)

### 이미지 정책 갱신 (Memory #13)
- 금지: Pexels, Unsplash, Pixabay 완전 금지
- 허용: Wikimedia Commons, LoC, Met Museum, BnF, NYPL, IMSLP, PLOS ONE, Frontiers, PMC

### 다음 세션 시작점
- Group C (§X 사용자 등록·관리 Phase C, ~5h) 또는
- /admin/staff-preview 시각 검증 (keySig × scale 5레벨 140조합)

---

## 2026-05-10 (오후) — 11일차 블로그 3편 ✅

### 기록한 주제
- §3-38 약점 음표 집중 학습법 (Ericsson et al. 1993, DOI: 10.1037/0033-295X.100.3.363)
- §5-56 피아노 학습자 초견 가이드 (Karpinski 2000 + Lehmann & McArthur 2002)
- §7-79 가중치 학습 알고리즘 (Cepeda et al. 2006, DOI: 10.1037/0033-2909.132.3.354)

### Commits
- `7d40212` §3-38 약점 음표 (ko·en)
- `2896e78` §5-56 피아노 초견 (ko·en)
- `3e3a9bb` §7-79 가중치 학습 (ko·en)

### 검증
- 6 .md 파일 frontmatter 정확
- 이미지 6개 curl HTTP 200 ✓ (4087991·1552252·4709822·3823039·4088009·7095517)
- 학술 인용 3건 (DOI 2건 + 학술 서적 2건) ✓
- 722/722 PASS, tsc 0 errors

### 누적
- 11일차 49편 (10일차 46편 + 3편)

### 다음 세션 시작점
- Group C (§X 사용자 등록·관리 Phase C, ~5h) 또는
- §0-3.13·14·15 모달 애니메이션 fix

---

## 2026-05-10 (낮~오후) — 조표 SVG anchor point 정정 ✅

### 사용자 검증 발견
- treble clef 2 sharps에서 F#(line 5)이 staff line과 정렬 안 됨
- 원인: keySigFontSize * 0.28 = 17.9px 아래로 내려 적용된 잘못된 offset

### 사용자 결정
- Bravura SMuFL 설계 원칙: glyph baseline = stave position → offset 제거
- G-clef/F-clef 렌더링 패턴과 일관 (둘 다 extra offset 없음)

### Commits
- `1e73baf` fix(staff): 조표 SVG anchor point 정정 — keySigFontSize*0.28 offset 제거

### 검증
- 자동 테스트 722 PASS (676 → +46, stepToY/stave position y 좌표 검증)
- sim:test 0 violations (9984 games)

### 갱신 docs
- PENDING §0.4.10 갱신 (anchor point 정정 내용 추가) ✅
- GAP §3.20 신규 ✅
- session-log §19 신규 ✅

### 다음 세션 시작점
- /admin/staff-preview 시각 검증 — keySig 모든 조합(1~7 sharps/flats × treble/bass × scale 5단계) 확인
- 사용자 직접 검증: F# treble line 5 정확 적용됐는지 확인

---

## 2026-05-10 (낮) — 조표 위치 표준 음악 표기 정정 ✅

### 사용자 검증 발견
- bass clef 조표(#·♭)가 모두 오선보 위쪽에 떠있음 — 시각적으로 완전히 틀림
- 원인: SHARP_KEY_POS.bass / FLAT_KEY_POS.bass 값이 treble - 7 (1옥타브 오류) → treble - 14 (2옥타브)가 맞음

### 사용자 결정
- 표준 음악 표기 기준으로 bass # 위치: F=-4, C=-7, G=-2, D=-6, A=-9, E=-5, B=-8
- 표준 음악 표기 기준으로 bass ♭ 위치: B=-8, E=-5, A=-9, D=-6, G=-10, C=-7, F=-11
- SHARP_KEY_POS, FLAT_KEY_POS export 추가 → 28 단위 테스트 직접 검증

### Commits
- `c63b04a` fix(staff): 조표 위치 표준 음악 표기 완료 — flat/sharp 각 stave position

### 검증
- 자동 테스트 676 PASS (648 → +28, treble/bass × sharp/flat 각 7개 위치)
- sim:test 0 violations (9984 games)

### 갱신 docs
- PENDING §0.4.10 신규 ✅
- GAP §3.19 신규 ✅

### 다음 세션 시작점
- /admin/staff-preview 시각 검증 — bass clef 조표 위치 직접 확인
- 5/10 블로그 11일차 + 사용자 dashboard·등록·관리 sprint

---

## 2026-05-10 (새벽) — Phase 2 게임 UI 미세 정정 (첫 음표 위치) + S2/S3 마무리 ✅

### 사용자 검증 발견
- 첫 음표가 음자리표·조표와 너무 떨어진 영역 (segmentWidth × 0.5 배치)

### 사용자 결정
- segmentWidth × 0.5 → 0.25 완료 (등분 1/4 위치, 거리 절반)
- 모든 음표 왼쪽으로 segmentWidth × 0.25 이동, 음표 간 간격 그대로

### Commits
- `37d1fcd` fix(staff): 첫 음표 위치 1/4 정정 — segmentWidth × 0.5 → 0.25
- `5877c78` docs: S1·S2 완료 기록 (§0.4.6·§0.4.7 + §3.16·§3.17)
- `3ac2d1b` feat(S2): PlayPage 분리 — 게임 화면 h-screen 전용 라우트
- `bfd2431` feat(S1): GrandStaffPractice Uniform Scale (오선 간격 비율 보정)
- `1a4d971` feat(admin): staff-preview scale/viewport/grand-staff toggle

### 검증
- 자동 테스트 648 PASS (44 files), tsc 0 errors
- retry 9 invariants 무손상 (npm run sim:test 0 violations, 9984 games)
- S2: /play 직접 URL → NavOnlyRoute redirect ✅, h-screen 스크롤 X ✅
- 신규 시나리오:
  - M=3·5·7·10 모두 첫 음표 x = rawStart + segmentWidth × 0.25 ✅
  - 마지막 음표 잘림 X (effectiveWidth 안) ✅
  - 음표 간 간격 segmentWidth 그대로 ✅

### 갱신 docs
- PENDING §0.4.4 정정 (0.5→0.25) + §0.4.9 신규 ✅
- PENDING §0.4.6·§0.4.7·§0.4.8 신규 (S1·S2·S3) ✅
- GAP §3.16 (S1 Uniform Scale) + §3.17 (S2 PlayPage) + §3.18 (0.25 정정) ✅
- 메모리 #16 갱신: segmentWidth × (slotIdx+0.5) → (slotIdx+0.25) ✅

### 다음 세션 시작점
- /admin/staff-preview 시각 검증 (scale·viewport·grand-staff 토글)
- 5/10 일요일 11일차 블로그 + 사용자 dashboard·등록·관리 sprint

---

## 2026-05-09 (밤~) — Phase 2 GrandStaffPractice UI Sprint ✅

### 목표
§0.4 (UI 음표 history·색깔·N-등분·잘림 방지) + §6.4 (admin/staff-preview) 완료
→ C1: M-등분 고정 슬롯 정책 버그 정정 추가 (음표 왼쪽 밀림)

### 커밋
| 커밋 | 내용 |
|---|---|
| `3faec95` | F1: /admin/staff-preview 신규 (14 tests) |
| `bfa0d94` | F2: getNoteColor 헬퍼 + batch/history 색깔 통합 (5 tests) |
| `ee73501` | F3: visibleNoteCount 도입 + batch 모드 accumulation 중단 (4 tests) |
| `8c56e46` | F4: N-등분 배치 정책 구현 — resolveStyle(visibleN) (6 tests) |
| `42cf4a8` | C1: M-등분 고정 슬롯 정책 — 음표 왼쪽 밀림 버그 정정 (12 tests) |
| `ab66b2d` | C2: StaffPreview totalSets·showSlotIdx·maxVisibleN·meta-M 갱신 (18 tests) |

### 핵심 변경
- **NoteRole + getNoteColor()**: "target"(빨강) | "answered"(회색) | "waiting"(검정) — batch/history 두 경로 통일
- **visibleNoteCount = answeredNotes.length + currentBatch.length**: history mode N=history+1, batch mode N=batchSize (answeredNotes=0 항상)
- **M-등분 고정 슬롯 정책 (C1 정정)**: M = stage 시작 고정값. batchSize=1→totalSets, ≥3→batchSize, final-retry→batch.len. 기존 visibleN(가변) 사용으로 인한 왼쪽 밀림 버그 해결.
  - `computeMaxVisibleN()` export, `getNoteScaleForM(M)`, `resolveStyle(…, maxN?)` 4th param
  - NoteGame: maxVisibleN 계산 → GrandStaffPractice maxVisibleN prop 전달
- **StaffPreview (C2)**: totalSets toggle(1~10) + showSlotIdx + maxVisibleN={M} + meta-M·visibleN·emptySlots 패널
- **exports**: resolveStyle, ResolvedStyle, SVG_W, STAFF_X1, STAFF_X2, getNoteColor, NoteRole, computeMaxVisibleN

### 수치
- **624/624 PASS** (vitest) / **tsc 0** / **sim:test 9 invariants 위반 0건**

---

## 2026-05-09 (자정~) — Group D 패스트트랙 (영역 B-0 마무리) ✅

### 사용자 결정
- Q1: AND 조건 (accuracy≥0.99 + avg_reaction≤0.5 + 첫 세션 + premium·admin + sublevel≥2)
- Q2: 즉시 다음 sublevel 자동 진입 (5초 카운트다운)
- Q3: SublevelPassedDialog 배지 + 메시지 완료
- Q4: 현재 단계 mastery_score = 100% 강제
- Q5: 메시지 옵션 A — "이미 충분합니다. 다음 단계로." / "Already enough. Onto the next."
- UI 정비: 별도 sprint 영역 (UI 개발 AI 협업, 출시 전·후 결정)

### Commits

| Sub-step | 커밋 | 내용 |
|---|---|---|
| D1 DB + types | 8a2f1bf | fast_track 컬럼 + RPC 분기 + get_mastery_score 100 강제 |
| D2 클라이언트 | 7ace91b | Index.tsx fastTrack 전달 |
| D3 Dialog + coaching | 1148637 | SublevelPassedDialog 5초 카운트다운 + aiCoaching 분기 |
| D4 docs | 현재 | — |

### 검증

579/579 PASS, tsc 0 errors

**시나리오**:
- Premium 첫 세션 + 조건 충족 → 패스트트랙 발동, 즉시 통과 ✓ (SQL 로직 정확)
- Premium 첫 세션 + 정답률 98% → 일반 판정 ✓
- Premium 두 번째 세션 → 일반 판정 ✓ (play_count=1)
- Premium Sub1 → 일반 판정 ✓ (sublevel < 2)
- Admin → 패스트트랙 발동 ✓ (role='admin' 조건)
- Free → 패스트트랙 발동 X ✓ (tier 미달)
- 5초 자동 진입 + "지금 바로" 즉시 + "레벨 선택" 취소 ✓
- 발동 sublevel mastery_score = 100% 표시 ✓ (computeMasteryScore fast_track 분기)

### 마이그레이션

Docker 오프라인 → `supabase/migrations/20260509_fast_track.sql` 작성 완료.
사용자가 Supabase 대시보드 또는 CLI로 production apply 필요.

### 영역 B-0 진척 (7/7 완료)

- ✅ Group A: 권한 매트릭스 (canAccessSublevel·getProgressGatePrev·Pricing)
- ✅ Group A: PASS_CRITERIA 정정 (20260509_pass_criteria_v2.sql)
- ✅ Group B: 일일 세션 한도 + Fix Sprint
- ✅ Group C: Mastery Score UI + AI Coaching + Fix Sprint
- ✅ Group D: 패스트트랙 (이번 sprint)

### 다음 세션 시작점

- 5/10 일요일 11일차 블로그 3편 (§3-38·§5-56·§7-79)
- 그 후 사용자 등록·관리 sprint Phase 1 또는 UI 정비 sprint (사용자 결정)

---

## 2026-05-09 (밤) — Group C Fix Sprint: Mastery UI 정정 + LevelSelect 정리 ✅

### 사용자 검증 발견 영역 4개

1. MasteryScoreCard 데이터 없을 때 "기록 없음" → 4지표 UI 안 보임 → blur 영역 인지 X
2. 펼치기 토글 default 접힘 → Free/Guest blur 영역 즉시 인지 X
3. LevelSelect "내 진도 단계" + "Pro 전 단계 이용중" 뱃지 = Header Premium 배지 중복
4. LevelSelect 하단 "메인으로 돌아가기" = 하단 배너 광고 영역 시각 충돌

### 사용자 결정

| 항목 | 결정 |
|---|---|
| 토글 default | 펼침 (A) — 첫 진입 시 blur 즉시 인지 |
| 데이터 없을 때 1계층 | "—" + "첫 세션을 시작해보세요" |
| 데이터 없을 때 4지표 | 0 값 그대로 노출 ("기록 없음" 텍스트 X) |
| blur 조건 | 무조건 (데이터·펼침 무관) |
| LevelSelect 뱃지 삭제 | 2개 모두 삭제 (Header 중복) |
| 메인 버튼 | 우측 상단 이동 (ghost + Home 아이콘) |

### Commits

| Sub-step | 커밋 | 테스트 |
|---|---|---|
| F1 MasteryScoreCard | 05d18dc | 14 → 19 |
| F2 MasteryHeroCard | 5b4b850 | 8 → 12 |
| F3 LevelSelect 정리 | ee66cb8 | 갱신 3개 + Dashboard mock |
| F4 docs 일괄 | 현재 | — |

**565/565 PASS, tsc 0 errors. Unhandled rejection 0건 (Dashboard mock 추가).**

### 신규 시나리오 검증

- Free 첫 진입 시 4지표 blur 즉시 노출 ✓ (default 펼침)
- Guest 첫 진입 시 blur 즉시 노출 ✓
- Premium 첫 진입 시 4지표 풀 노출 ✓ (blur 없음)
- 데이터 없을 때 "—" + "첫 세션을 시작해보세요" ✓
- 4지표 0 값 UI 그대로 (기록 없음 텍스트 X) ✓
- LevelSelect 뱃지 2개 삭제 ✓
- 메인 버튼 우측 상단 + 클릭 onBack 호출 ✓

### 다음 세션 시작점

- 5/10 일요일 11일차 블로그 3편 (§3-38·§5-56·§7-79)
- 그 후 Group D Quick Mastery Mode 또는 §X 사용자 등록·관리 sprint Phase 1

---

## 2026-05-09 (야간) — Group C: Mastery Score UI 블러 + AI Coaching 기본 ✅

### 완료 내용 (6 sub-step)

| Sub-step | 파일 | 커밋 | 테스트 |
|---|---|---|---|
| C1 PremiumBlurCard | `src/components/PremiumBlurCard.tsx` | e1ca34e | 9 |
| C2 get_mastery_score RPC | `supabase/migrations/20260509_mastery_score.sql` | e1ca34e | — (SQL) |
| C3 MasteryScoreCard + LevelSelect | `src/components/MasteryScoreCard.tsx` | e1ca34e | 14 |
| C4 aiCoaching + Dialog 통합 | `src/lib/aiCoaching.ts` + SPDialog + GODialog | 74d07de | 12 |
| C5 MasteryHeroCard + Dashboard | `src/components/dashboard/MasteryHeroCard.tsx` | a2a9cfa | 8 |
| C6 docs sync | PENDING_BACKLOG §B.6 ✅ + GAP §B.1.5 신규 + 세션 로그 | 현재 | — |

**총 43개 테스트 추가. 555/555 PASS, tsc 0 errors.**

### 핵심 결정

- **PremiumBlurCard**: premium/admin → 통과, guest/free → `blur(Xpx)` + `will-change: filter` (메모리 #29 GPU layer). CTA → /pricing (onUpgrade prop 미제공 시).
- **computeMasteryScore()**: 4-metric 25% 가중 평균 (accuracy/reaction/playCount/streak). pass criteria 달성 = exactly 100. 프론트·SQL 양쪽 동일 공식.
- **MasteryScoreCard 2-layer**: Layer 1 = big number + progress bar + toggle. Layer 2 = 4 metric rows in PremiumBlurCard. getCurrentSublevel = 접근 가능 + 미통과 첫 번째.
- **generateCoachingComment()**: 규칙 기반 (API 없음). passed: top/great/border 3분기. game_over: 정확도<0.70 / 연속<3 / 반응>0.50 / else 4분기.
- **MasteryHeroCard Dashboard 통합**: Free = 점수+CTA 1개. pro/premium/admin = 4지표+7일 LineChart. currentMastery useMemo로 단계 자동 감지.

### 시험 수정 (부산물)

- `LevelSelect.test.tsx` `getByText(/0/)` → `getByText(/내 진도:/, { selector: "p" })` + `.textContent` 검사 (MasteryScoreCard "0" 추가 노출로 getMultipleElementsFoundError).

---

## 2026-05-09 (저녁) — §X 사용자 등록·관리 영역 4 Phase 완료 (PENDING)

### 사용자 의도

출시 전까지 사용자 등록·관리 영역 다듬어야 함. 결제 시스템·약관과 함께 출시 신뢰의 기둥.

### 4 Phase 분할 (각 ~1일, 총 ~5일 sprint)

| Phase | 영역 | 핵심 항목 |
|---|---|---|
| **A 가입** | Phase 1 | A1 이메일 OTP / A3 이메일 중복 / A4 닉네임 중복 / A5 비밀번호 강도 / A2·B1 OAuth 사실 추적 |
| **B 로그인·세션** | Phase 2 | B2 비밀번호 재설정 / B4 refresh token 기간 검증 |
| **C 계정관리** | Phase 3 (§5.2 통합) | C1 비밀번호 변경 / C2 이메일 변경 / C4 탈퇴 (GDPR·PIPA) |
| **D 보안** | Phase 4 | D1 이메일 confirm 강제 / D2 전 테이블 RLS 검증 (§0-2.1 통합) |

### 출시 후 OK 영역
A6 onboarding · B3 세션 관리 · C3 닉네임 변경 · C5 학습 이력 다운로드 · D3 Auth events 로깅 · Apple OAuth (iOS).

### 우선순위 영역
- **C4 탈퇴** = GDPR·PIPA 법적 의무 (출시 전 필수)
- **A1 이메일 OTP** = 외부 이메일 가입자 abuse 차단 1차 영역
- **B2 비밀번호 재설정** = 사용자 신뢰 기본 영역
- **D2 RLS 검증** = 보안 기둥

### 의존성
- §0-2.1 스키마 표류 6개 테이블 → D2 RLS 검증과 통합
- §10.1 약관 4종 (Termly) → C4 탈퇴 정책 GDPR/PIPA 영역
- §3.5·§5.4·§1.1 결제·차등화 → C 영역 UI 통합

### docs 적용됨
- PENDING_BACKLOG §X 신규 추가 (§B-0과 §1 사이)
- §5.2·§5.3 → §X로 통합 마킹
- 변경 이력 v 완료

### 진행 시점
- 5/10 일요일 11일차 블로그 후 또는 Group C 후 진입
- 전체 5일 sprint 또는 phase별 분리 진행 결정 영역

### 출시 카운트다운

오늘 = 2026-05-09. 출시 = 2026-05-31. **22일 남음**.

---

## 2026-05-09 (오후~) — Group B Fix Sprint (LevelSelect 게이트 + 메시지 재작성)

### 사용자 검증 발견 영역

1. DailyLimitModal 표시 시 백그라운드 게임 진행 (마운트 게이트 의도와 어긋남) — audio context·timer state 초기화·진행
2. 보조 버튼 "나중에" 클릭 시 게임 가능 (escape hatch)
3. 메시지 컨텐츠 단순 — Free 영역 Premium 가치 후킹 부족

### Fix 설계

- **게이트 위치 이동**: NoteGame 마운트 → **LevelSelect 단계 클릭 시점**
- **NoteGame = 안전망**: 한도 도달 시 마운트 useEffect → `onLevelSelect()` 콜백 호출 + return (게임 진입 X)
- **DailyLimitModal 컨텐츠 재작성** (스티브잡스 스타일):
  - Guest: 가치 3개 (7회 무료·Lv1~Lv5·AI 분석)
  - Free: 가치 4개 (무제한·21단계·AI 풀 분석·광고 X) + 가격 ($2.99/mo·$24.99/yr 30% 절약)
  - Quick Mastery 영역 제거 (사용자 정정)
  - "모든 단계 열림" 표현 정정 — Premium=21단계 모두, Free=Sub1만

### Commits (F1·F2)

| commit | 내용 |
|---|---|
| `b58d873` F1+F3 | LevelSelect 단계 클릭 게이트 + NoteGame 안전망 패턴 (onLevelSelect 콜백) + DailyLimitModal 인라인 제거 + 6개 NoteGame.*.test.tsx useDailyLimit 모킹 + LevelSelect.dailyLimit 신규 7케이스 + NoteGame.dailyLimit 안전망 패턴 4케이스 |
| `fbe4d29` F2 | DailyLimitModal 컨텐츠 재작성 (가치 리스트·가격·title·countdown 영역 ko/en) + 단위 테스트 12→20 |
| (이 commit) F4 | docs 일괄 동기화 |

> F3 (NoteGame 안전망 패턴) = F1 commit에 통합 적용됨 (LevelSelect 테스트 격리 영역 필요).

### 검증

- **512/512 PASS, tsc 0 errors**
- 시나리오 (1)~(8) 회귀 X (메모리 #16·#26 일관)
- 신규 시나리오:
  - Guest 3회 도달 후 단계 클릭 → DailyLimitModal 노출, onSelectSublevel 호출 X ✓
  - Free 7회 도달 후 단계 클릭 → DailyLimitModal 노출, navigate X ✓
  - 보조 버튼 클릭 → onClose, LevelSelect 머무름 (navigate X) ✓
  - 한도 도달 후 NoteGame 직접 마운트 → onLevelSelect() 콜백, 게임 진입 X ✓

### 갱신 docs

- PENDING_BACKLOG §B.4 fix sprint 영역 추가 (백그라운드 게임 진행 차단)
- DESIGN_VS_CODE_GAP §B-0.2 정합 영역 갱신 (LevelSelect 메인 게이트 + NoteGame 안전망)

### 다음 세션 시작점

- **5/10 일요일 11일차 블로그 3편**: §3-38 약점 음표 + §5-56 피아노 학습자 + §7-79 가중치 학습 (14일차 차용)
- 그 후 **Group C** = Mastery Score UI 블러 + AI Coaching 기본 (~5h)

### 출시 카운트다운

오늘 = 2026-05-09. 출시 = 2026-05-31. **22일 남음**.

---

## 2026-05-09 (오후) — Group B 일일 세션 한도 시스템

### 사용자 결정 (CTO 권장 일관 OK)

- Q1: 일일 한도 reset 시점 = **UTC 자정** (글로벌 출시 일관)
- Q2: Guest 추적 = **localStorage 단순 적용**
- Q3: tier 컬럼 분리 = **daily_sessions 에 tier_snapshot 두지 않음** (tier는 profiles 자체 등급 영역)
- Q4: 카운트 시점 = **NoteGame 마운트 useEffect 시점** (handleStart 별도 함수 X 영역, 마운트 진입부에 가드)

한도: Guest = 3회/일 / Free = 7회/일 / Premium = 무제한 (RPC X)

### 진행 흐름 (Group B, 5 commits)

| commit | 내용 |
|---|---|
| `7167977` B1 | daily_sessions 테이블 + RLS + RPC 2개 (increment_daily_session·get_today_session_count) |
| `0cbd5ac` B2 | useDailyLimit 훅 (guest=localStorage / free=RPC / pro=Infinity 분기, 11/11 PASS) |
| `b81937e` B3 | DailyLimitModal (24h 카운트다운, ko/en strings, 메모리 #19 backdrop·ESC 닫기 X, 12/12 PASS) |
| `f4265df` B4 | NoteGame 마운트 게이트 + 모달 통합 + 통합 테스트 4 케이스 (497/497 PASS) |
| (이 commit) B5 | docs 일괄 동기화 |

검증: 497/497 PASS, tsc 0 errors. 시나리오 (1)~(8) 통과.

### 구현 핵심 영역

- **메모리 #16 카운트다운 동기화 영향 X**: 마운트 useEffect 진입부 가드만 추가, 통과 시 기존 calibration→swipe→countdown→첫 음표 흐름 무손상.
- **메모리 #19 모달 닫기**: backdrop·ESC 차단(preventDefault), CTA·close·X 버튼만으로 닫기.
- **DailyLimitModal 조건부 렌더**: `{showDailyLimitModal && <DailyLimitModal>}` — useNavigate 호출 회피로 기존 NoteGame 테스트 (MemoryRouter 미적용) 회귀 X.
- **recordSession fire-and-forget**: DB 실패해도 게임 진행 (메모리 #18 사용자 편의 최우선).
- **tier_snapshot 컬럼 두지 않음** (사용자 Q3 정정): tier는 profiles 자체 등급 영역.

### 갱신 docs

- **PENDING_BACKLOG.md**: §B.4 ✅ Group B 완료 (4 항목 모두 commit hash)
- **DESIGN_VS_CODE_GAP.md**: §B-0.2 daily_sessions 행 ❌→✅ + §B.1 ❌→✅
- **noteflex-session-log.md**: 본 영역 신규 추가

### 다음 세션 시작점

1. **5/10 일요일 = 11일차 = 주말 3편 블로그**: §3-38 약점 음표 + §5-56 피아노 학습자 + §7-79 가중치 학습 (14일차 차용)
2. **그 후 Group C = Mastery Score UI 블러 + AI Coaching 기본 (~5h)**:
   - `src/components/PremiumBlurCard.tsx` 신규
   - LevelSelect Mastery Score 블러 + CTA
   - 4지표 탭 UI (Premium 전용)
   - AI Coaching 결과 모달 1행 + 대시보드 카드 (Free 영역)

### 출시 카운트다운

오늘 = 2026-05-09. 출시 = 2026-05-31. **22일 남음**.

---

## 2026-05-09 (오전~) — Group A 실행 + 블로그 10일차

### 사용자 결정

- **Q1·Q2·Q3 (CTO 권장 그대로 OK)**:
  - Q1 = (a) A2 RPC + 클라이언트 = atomic commit
  - Q2 = (b) Free 순차 해금 = useLevelProgress 메모리 캐시 (UI 가드용 즉시 반응, RPC 이중 검증)
  - Q3 = (a) A2 마이그레이션 = 즉시 production apply
- **docs 갱신 패턴 v2 (Group B부터)**: sub-step별 file in-place ✅ 완료(commit X) + 마지막 docs 일괄 commit 1개. 코드 commit 사이에 docs commit 끼움 X.
- **세션 로그 1개 파일 누적 결정**: docs/sessions/noteflex-session-log.md 1개 파일 시간 역순 누적. 파일 분리 X. 토픽 분리 X.
- **블로그 10일차 = 토요일 3편 = 한+영 6 .md**: §3-37·§2-24·§8-87. §8-87 13일차 3편째 차용, 시프트 X.

### 진행 흐름

#### Group A (코드 적용, 4 commits)

| commit | 내용 |
|---|---|
| `e6ed7b2` A1 | canAccessSublevel 재작성 + getProgressGatePrev 신규 (avg_reaction_ratio 개칭 포함) |
| `b232dcd` A2 | 20260509_pass_criteria_v2.sql + useLevelProgress + NoteGame 순차 체인 (atomic) |
| `1848391` A3 | Pricing.tsx freeFeatures·compareRows 5/9 결정 반영 |
| `fbb4340` A4 | docs 동기화 (§B-0.2/B.1/B.2 ✅) |

검증: 470/470 PASS, tsc 0 errors.

#### 블로그 10일차 (콘텐츠, 4 commits)

| commit | 내용 |
|---|---|
| `05744b1` | §3-37 초견 실수 패턴 분석 (ko+en, ~1,700자 / ~880 words) |
| `60e8fb3` | §2-24 쉼표 읽기 (ko+en, ~1,700자 / ~870 words) |
| `d988676` | §8-87 21단계 시스템 (ko+en, ~1,850자 / ~900 words, 13일차 차용) |
| `8acd24e` | blog_topics_100.md §6 이력 6행 + §1.1 10일차 표 + v15 |

이미지 curl HTTP 200 검증 (6개 Pexels): pexels 164821·3756766·210764·1246437·1552617·995301 = 200 ✓

학술 인용:
- Kopiez & Lee (2008) DOI: 10.1080/14613800701871363
- Lehmann & McArthur (2002) Oxford University Press (§3-37)
- Margulis (2007) DOI: 10.1525/mp.2007.24.5.485
- Cooper & Meyer (1960) University of Chicago Press (§2-24)
- Vygotsky (1978) Harvard University Press
- Hattie & Timperley (2007) DOI: 10.3102/003465430298487 (§8-87)

거장 전통: Levitin + 음악 교육 / Copland + Bernstein / Levitin + 음악 교육.

### 갱신 docs

- **PENDING_BACKLOG.md**: §B-0.2·§B.1·§B.2 ✅ 표시 (commit fbb4340)
- **DESIGN_VS_CODE_GAP.md**: §B-0.2 코드 영향 범위 표 상태 열 추가 (commit fbb4340)
- **blog_topics_100.md**: §6 이력 6행 추가 + §1.1 10일차 행 완료 + v15. 누적 46편 (한 23 + 영 23).

### 다음 세션 시작점

1. **5/10 일요일 = 11일차 = 주말 3편**: §3-38 약점 음표 집중 학습 + §5-56 피아노 학습자 가이드 + §7-79 가중치 학습 (14일차 차용)
2. **그 후 Group B = 일일 세션 한도 시스템 (~4h)**:
   - `supabase/migrations/20260509_daily_sessions.sql` 신규
   - `src/hooks/useDailyLimit.ts`
   - `src/components/DailyLimitModal.tsx`
   - NoteGame.tsx 게임 시작 전 limit 체크 + 모달 트리거
   - commit 패턴 v2 적용 (sub-step별 in-place ✅ + 마지막 일괄 commit)

### 출시 카운트다운

오늘 = 2026-05-09. 출시 = 2026-05-31. **22일 남음**.

---

## 2026-05-08 밤 ~ 2026-05-09 새벽 — 영역 B-0 티어 매트릭스 결정 + 사실 추적

> **원본 전문**: 이 파일 하단 섹션 (구 세션 로그 형식) 에 적용됨. 아래 요약은 핵심 결정·사실·commit만 추출.

### 결정 요약 (D1~D7)

| 결정 | 내용 |
|---|---|
| D1 Guest | Lv1 Sub1만, 3회/일, 가입 유도 모달 |
| D2 Free | Lv1~5 Sub1 순차, 7회/일, 24h 카운트다운 모달 |
| D3 Premium | 전 21단계, 무제한, Quick Mastery 포함 |
| D4 DB PASS_CRITERIA | 20260509_pass_criteria_v2.sql (10회/85%/35%/5 연속) |
| D5 Quick Mastery Mode | Premium 전용, 오류율≤1% AND 반응시간≤타이머 50% → 첫 세션 즉시 통과 |
| D6 Mastery Score UI | Free/Guest = 블러 + CTA, Premium = 전체 노출 |
| D7 AI Coaching | Free = 기본 2종, Premium = 전체 |

### 코드 사실 추적 요약 (F1~F7)

| 사실 | 결과 |
|---|---|
| F1 canAccessSublevel 갭 | Guest Sub1~3 허용 → Sub1만으로 정정 필요 (→ A1) |
| F2 일일 세션 한도 | 완전 미구현 (→ Group B) |
| F3 Mastery Score | 부분 구현, 블러 미구현 (→ Group C) |
| F4 AI Coaching | 완전 미구현 (→ Group C) |
| F5 Quick Mastery Mode | 완전 미구현 (→ Group D) |
| F6 Pricing 카피 | 구 Free 범위 반영, 수정 필요 (→ A3) |
| F7 DB PASS_CRITERIA | play≥5/80% vs TS 10/85% 불일치 (→ A2) |

### commits

| commit | 내용 |
|---|---|
| `8c66a6c` | 세션 로그 신규 (구 파일명, 본 파일로 통합) |
| `5d95cd0` | package.json `npm run resume` 단축어 |
| `74f5200` | PENDING_BACKLOG §B-0/§B.1~B.6/§13.L/§0-1.1 |
| `5571a6e` | DESIGN_VS_CODE_GAP §5/§B-0/§B.1~B.2 |

---

<!-- ═══════════════════════════════════════════════════════ -->
<!-- 아래: 구 세션 로그 형식 (2026-05-08 밤, 상세 원문 보존) -->
<!-- ═══════════════════════════════════════════════════════ -->

---

## 1. 결정 개요

### D1 — Guest 티어 접근 범위 ✅ 확정

| 항목 | 결정값 |
|---|---|
| 접근 가능 레벨 | Lv1 Sub1만 |
| 일일 세션 한도 | 3회/일 |
| 한도 초과 시 | 가입 유도 모달 (광고 보상형 X) |

**배경**: 최대한 빠른 가입 전환 유도. 게스트에게 광고 보상형으로 더 주는 정책은 5/9 결정으로 폐기.

---

### D2 — Free 티어 접근 범위 ✅ 확정

| 항목 | 결정값 |
|---|---|
| 접근 가능 범위 | Lv1~5, 각 레벨 Sub1만 |
| 진행 방식 | 순차 (이전 Sub1 통과 후 다음 레벨 Sub1 해금) |
| 일일 세션 한도 | 7회/일 |
| 한도 초과 시 | 24시간 카운트다운 모달 (Premium 업그레이드 유도) |

**배경**: Sub2~Sub3는 Premium 전용. Free 사용자가 "더 하고 싶다"는 욕구가 생기는 지점을 Lv5 Sub1 통과 후로 설계.

---

### D3 — Premium 티어 접근 범위 ✅ 확정

| 항목 | 결정값 |
|---|---|
| 접근 가능 범위 | 전 21단계 (Lv1-1 ~ Lv7-3) |
| 진행 방식 | 순차 (Sub1→Sub2→Sub3 내 레벨 순차, 이전 Sub 통과 필요) |
| 일일 세션 한도 | 없음 |
| Quick Mastery Mode | 활성 (아래 D5 참조) |

---

### D4 — DB PASS_CRITERIA 정정 마이그레이션 ✅ 확정

| 항목 | TS PASS_CRITERIA (현재) | DB RPC 현재 | 결정 (정정 목표) |
|---|---|---|---|
| 수행 횟수 | 10회 | 5회 | **10회** (TS 기준) |
| 정답률 | 85% | 80% | **85%** (TS 기준) |
| 반응속도 | 타이머 35% 이내 | 미구현 | **추가** |
| 최대 연속 정답 | 5회 | 5회 | **5회** (동일) |

**결정**: DB RPC를 TS 기준에 맞게 정정.
**파일**: `supabase/migrations/20260509_pass_criteria_v2.sql` 신규 작성 필요.
**코드 영향**: `record_sublevel_attempt` RPC 파라미터 확장 (`avg_reaction_ratio` 추가) + 통과 체크 로직 정정.

---

### D5 — Quick Mastery Mode (패스트 트랙) 정책 ✅ 확정

| 항목 | 결정값 |
|---|---|
| 대상 등급 | Premium 전용 |
| 적용 범위 | Lv1 Sub2 ~ Lv7 Sub3 (Sub1은 제외) |
| 트리거 조건 | 첫 세션에서 오류율 ≤1% AND 평균 반응시간 ≤ 타이머의 50% |
| 발동 시 | 결과 모달에 "빠른 통과" 배지 + 즉시 해금 |
| 미발동 시 | 일반 통과 기준 (D4 기준) 적용 |

**배경**: 이미 해당 레벨을 충분히 숙지한 Premium 사용자가 불필요한 반복을 건너뛸 수 있도록.

---

### D6 — Mastery Score UI 노출 정책 ✅ 확정

| 등급 | UI 표시 |
|---|---|
| Guest / Free | 블러 처리된 카드 + "Premium으로 잠금 해제" CTA |
| Premium | 전체 노출 (단일 숫자 + 4지표 탭) |

**배경**: Mastery Score는 Premium 핵심 가치 중 하나. Free에게 블러로 노출해 업그레이드 유도.

---

### D7 — AI Coaching 정책 ✅ 확정

| 등급 | 제공 범위 |
|---|---|
| Free | 결과 모달 1행 코멘트 (유형 B) + 대시보드 히어로 카드 요약 (유형 C) |
| Premium | 전체 (유형 A~E: 상세 분석 + 다음 세션 추천 + 약점 음표 + 학습 곡선 + 목표 설정) |

**현황**: AI Coaching 전체 미구현. Group C (Mastery Score + AI Coaching) 작업에서 구현 예정.

---

## 2. 코드 사실 추적 결과 (read-only, 2026-05-09)

### F1 — `canAccessSublevel` (src/lib/levelSystem.ts:281-302) ❌ 불일치

```typescript
// 현재 코드
if (tier === "guest") { return level === 1; }  // Lv1 Sub1~3 모두 허용 ← 5/9 결정과 불일치
if (tier === "free") {
  if (level <= 2) return true;  // Lv1~2 Sub1~3 모두 허용 ← 5/9 결정과 불일치
  if ((level === 3 || level === 4) && sublevel === 1) return true;  // Lv3~4 Sub1
  return false;
}
```

**5/9 결정 기준 정정 내용**:
- `guest`: `level === 1 && sublevel === 1` 으로 변경 (Sub1만)
- `free`: `level <= 5 && sublevel === 1` + 순차 해금 조건 (이전 Sub1 통과 체크) 으로 재작성

**작업 파일**: `src/lib/levelSystem.ts`

---

### F2 — 일일 세션 한도 시스템 🔴 완전 미구현

- `daily_session_count` 컬럼: DB 없음
- `useLives` / `useDailyLimit` 훅: 없음
- `daily-reset` Edge Function: 없음
- `24h countdown` 모달 컴포넌트: 없음

**작업 범위 (Group B)**:
1. `supabase/migrations/20260509_daily_sessions.sql` — `daily_sessions` 테이블 (user_id, date, count)
2. `src/hooks/useDailyLimit.ts` — 오늘 세션 수 조회 + 초과 체크
3. `src/components/DailyLimitModal.tsx` — 24h 카운트다운 UI + Premium CTA
4. `NoteGame.tsx` — 게임 시작 전 daily limit 체크 훅 호출

---

### F3 — LevelSelect Mastery Score UI ⚠️ 부분 구현

- `LevelSelect.tsx`: Mastery Score 숫자 표시 있음 (단일 숫자)
- 4지표 탭 UI: 없음
- 블러 처리 (Free/Guest): 없음 — Premium 아닌 사용자도 그대로 노출
- `PremiumBlurCard` 컴포넌트: 없음

**작업 범위 (Group C)**: 블러 래퍼 컴포넌트 + tier 체크 + 4지표 탭 추가

---

### F4 — AI Coaching 컴포넌트 🔴 완전 미구현

- 결과 모달 1행 코멘트: 없음
- 대시보드 히어로 카드: 없음
- 분석 API 연동: 없음

**작업 범위 (Group C)**: 최소 구현 (Free용 결과 모달 1행 + 대시보드 카드)

---

### F5 — Quick Mastery Mode 🔴 완전 미구현

- 트리거 조건 체크 로직: 없음
- "빠른 통과" 배지: 없음
- 즉시 해금 플로우: 없음

**작업 범위 (Group D)**: `record_sublevel_attempt` RPC 확장 + 클라이언트 트리거 감지 + 결과 모달 배지

---

### F6 — Pricing.tsx 카피 ⚠️ 수정 필요

현재 `freeFeatures[5]`: `"광고 시청 후 이용"` — 5/9 결정으로 폐기된 정책.

수정 항목:
- `freeFeatures[5]` 삭제 또는 `"7회/일 세션 한도"` 로 교체
- `compareRows` Free 열 Lv3~5 Sub1 반영 (현재 Lv3~4 Sub1만)
- Guest 열 Lv1 Sub1만 반영 (현재 Lv1 전체)

**작업 범위 (Group A)**: `src/pages/Pricing.tsx` 수술적 카피 갱신

---

### F7 — DB 스키마 + 마이그레이션 ⚠️ PASS_CRITERIA 불일치

**`supabase/migrations/20260425_sublevel_system.sql` 확인 결과**:
- `record_sublevel_attempt` RPC 통과 기준: `play_count >= 5 AND accuracy >= 0.80`
- TS `PASS_CRITERIA` (levelSystem.ts:166-172): `MIN_PLAY_COUNT: 10, MIN_ACCURACY: 0.85`
- **실제 통과 기준은 DB** — TS 설정은 클라이언트에서만 체크 (DB가 override)

**결정**: 신규 마이그레이션으로 DB를 TS 기준에 맞게 정정
- `play_count >= 10`
- `accuracy >= 0.85`
- `avg_reaction_ratio <= 0.35` (avg_reaction_ms / timer_ms) — 컬럼 추가 필요
- `max_streak >= 5` (이미 일치)

---

## 3. 영역별 작업 그룹 분류

| 그룹 | 항목 | 예상 시간 | 우선순위 |
|---|---|---|---|
| **Group A** (~2h) | canAccessSublevel 정정 + DB 마이그레이션 + Pricing.tsx | 2h | 🔴 즉시 |
| **Group B** (~4h) | 일일 세션 한도 시스템 전체 | 4h | 🔴 출시 전 |
| **Group C** (~5h) | Mastery Score UI (블러) + AI Coaching 기본 | 5h | 🔴 출시 전 |
| **Group D** (~4h) | Quick Mastery Mode | 4h | 🔴 출시 전 |

---

## 4. 결정 보류 항목 (5/9 현재)

| 항목 | 이유 |
|---|---|
| 7일 무료 체험 (Premium Trial) | 결제 플로우 + Paddle 설정 필요 — 출시 후 |
| Lifetime 플랜 ($X 일시불) | 가격 정책 미결 — 출시 후 |
| 배치고사 → 레벨 자동 배정 | 배치고사 전체 미구현 — 출시 후 |
| 랭킹 등록 (Premium) | 랭킹 시스템 미구현 — 출시 후 |
| Free 사용자 스트릭 프리즈 | 스트릭 시스템 미구현 — 추후 |

---

## 5. 다음 세션 시작 우선순위

1. **Group A** (~2h): `canAccessSublevel` 정정 + `20260509_pass_criteria_v2.sql` + `Pricing.tsx` 카피 수술
2. **Group B** (~4h): 일일 세션 한도 시스템 (DB + 훅 + 모달)
3. **Group C** (~5h): Mastery Score 블러 UI + AI Coaching 기본
4. **Group D** (~4h): Quick Mastery Mode

---

## 6. 이번 세션 완료 항목

| 항목 | 상태 |
|---|---|
| 블로그 §1.4~1.5 작성 정책 갱신 | ✅ (2026-05-08 세션) |
| 블로그 9일차 4편 한+영 작성 | ✅ (2026-05-08 세션) |
| 영역 B-0 티어 매트릭스 결정 (D1~D7) | ✅ |
| 코드 사실 추적 7개 영역 | ✅ (read-only) |
| 세션 로그 완료 | ✅ |
| PENDING_BACKLOG.md 갱신 | ✅ |
| DESIGN_VS_CODE_GAP.md 갱신 | ✅ |

---

# 2026-05-17 — Noteflex DB 전수 조사 + 시스템 정합성 복구 (Phase 1·2·3)

## 배경

- 출시 마감 2026-05-31 임박
- 이전 sprint에서 회귀 4번 적용됨 (단순 INSERT 영역도 미설정 적용됨)
- 마이그 ≠ 실제 DB 의심
- 사용자 결정: 출시 박지 말고 DB 전수 조사 기록한 후 안전 기록할 영역에서 출시 완료

---

## Phase 1 — DB 전수 조사 + 문서화

### Phase 1 도구 분담

- Claude (채팅) — 조율·분석·결정
- Claude Code (Opus 4.7) — 문서 작성
- Cursor Pro (Opus 4.7) — 작성된 문서 검증
- 사용자 (Supabase Dashboard) — Production schema 추출

### Session 1 — README + 01_SCHEMA (커밋 `0613ba5`)

기록한 파일:
- `all_sch_doc/README.md` (187줄) — 진입점·ASCII 다이어그램·27 마이그 타임라인
- `all_sch_doc/01_SCHEMA.md` (1,272줄) — 16개 테이블 × 13항목

기록한 테이블 16개:
- **USER**: profiles
- **GAME**: user_sessions, user_sublevel_progress, user_note_logs
- **STATS**: user_stats_daily, note_mastery
- **LIMIT**: daily_sessions
- **PAYMENT**: payment_events
- **LEAGUE**: leagues, league_members
- **ADMIN**: admin_actions, daily_batch_runs
- **MISC**: user_custom_scores, user_scores, practice_logs, device_change_events

발견된 영역:
- ⚠️ 7개 테이블 = 마이그 X (Dashboard 직접 완료)

### Session 1 Cursor 검증 — 불일치 9건

1. `user_streaks` 테이블 누락 (17번째 테이블)
2. `check_nickname_available` RPC 마이그 X
3. profiles 7개 컬럼 출처 잘못 ("20260512" 적용됐지만 ALTER X)
4. note_mastery 6개 컬럼 출처 잘못 ("20260424" 적용됐지만 ALTER X)
5. `apply_payment_topup` 시그니처 인자 순서 잘못
6. admin_actions INSERT 위치 잘못 ("RPC 추정" → 실제 Edge Function)
7. profiles INSERT/UPDATE 표 누락 (record_game_session·admin-action)
8. `hard_delete_account` RPC doc §1.10 누락
9. Dashboard 직접 적용된 7개 테이블 = 재현 마이그 기록할 영역

### Session 2 — 02_RLS_POLICIES + 03_SQL_FUNCTIONS (커밋 `7b3bf58`)

기록한 파일:
- `all_sch_doc/02_RLS_POLICIES.md` (584줄) — 45개 정책 + 헬퍼 2개
- `all_sch_doc/03_SQL_FUNCTIONS.md` (563줄) — 22개 함수 + 4개 트리거

기록한 부분:
- 헬퍼 함수: `is_admin()`, `is_reviewer()`
- 21개 함수 + 1개 누락 (`check_nickname_available`)
- 4개 트리거

### Session 2 Cursor 검증 — 불일치 15건

1. `02_RLS_POLICIES.md` 라인 번호 ±1~30행 오차 (45개 정책)
2. practice_logs INSERT WITH CHECK EXISTS 절 누락
3. device_change_events UPDATE 정책 X → silent fail 확정
4. `apply_payment_topup` 시그니처 인자 순서 잘못
5. `apply_payment_topup` 호출 위치 잘못 ("Production 미적용됨 추정" → 실제 `verify-iap-receipt:475`)
6. SECURITY DEFINER 카운트 잘못 (17 → 실제 19)
7. SECURITY INVOKER 카운트 잘못 (4 → 실제 2)
8. GRANT anon 카운트 잘못 (3 → 실제 2)
9. `is_reviewer()` = dead 함수 (호출 0건)
10. 트리거 4개 라인 번호 오차
11. `record_sublevel_attempt` 영역 #6 호출 위치 인자 누락
12. 중복 정의 함수 6개 — Production 어느 버전 있는지 미확인
13. idempotent DROP+CREATE 패턴 누락 (daily_sessions·user_sessions·profiles·payment_events)
14. 마이그 X 적용된 8개 테이블 RLS 미확인 (subscriptions 신규 발견)
15. `hard_delete_account` Production 버전 미확인 (20260514 적용 적용됐으면 auth.users 잔존 위험)

### Session 3 — 04_DATA_FLOWS + 05_KNOWN_ISSUES (커밋 `c85b7b5`)

기록한 파일:
- `all_sch_doc/04_DATA_FLOWS.md` (1,192줄) — 12개 기능 × 10항목 + ASCII 다이어그램
- `all_sch_doc/05_KNOWN_ISSUES.md` (391줄) — 8개 카테고리 + Phase 3 우선순위

기록한 12개 기능:
- §1.1 게임 진행·종료 (최핵심)
- §1.2 회원가입 (Magic Link + OAuth)
- §1.3 로그인
- §1.4 계정 삭제·복구
- §1.5 프로필
- §1.6 일일 한도
- §1.7 결제
- §1.8 구독·Premium
- §1.9 레벨 잠금 해제
- §1.10 일괄 분석
- §1.11 사용자 환경 보정
- §1.12 관리자 작업

### Session 3 Cursor 검증 — 핵심 발견 6건

1. `useNoteLogger` 활성 사용 (Phase 1 deprecated 기록한 부분 = 잘못)
   - `NoteGame.tsx:1067, 1132, 1196` → `userNoteLogs.ts:117` INSERT
   - `WeakSlowNotesCards`·`AICoachingDetail`에서 SELECT 기록하는 영역
2. `supabase/functions/payment-webhook/` = 빈 폴더 (`index.ts` X)
3. `supabase/functions/create-checkout-session/` = 빈 폴더 (`index.ts` X)
4. `Pricing.tsx` = 단순 navigate (결제 호출 X)
5. note_mastery INSERT 진입점 어디에도 없음 — 데이터 0건 가능 우려
6. `AuthModal.tsx:269` = `handleFreshStart` (재가입), 실제 OTP 재전송은 `:289+` `handleResend`

### Phase 1 누적 — Phase 3 fix 영역 25건

- 🔴 위험 7건
- 🟡 중간 7건
- 🟢 낮음 11건

---

## Phase 2 — 검증 쿼리 완료 (Production Dashboard 직접 확인)

### 통합 진단 SQL 기록한 결과 (사용자가 Supabase SQL Editor 기록한 부분)

#### 1. note_mastery INSERT 진입점 확인
- row_count: **73건 적용됨** (Cursor 우려 = 해소)
- triggers: NONE (information_schema 기록한 부분)
- 추가 조사 기록한 후 발견: `on_session_complete` 트리거 적용됨 (`pg_trigger` 영역)

#### 2. hard_delete_account auth.users 삭제 확인
- ✅ `auth.users` 삭제 적용되어 있음
- Production 본문 기록한 부분에서 `DELETE FROM auth.users WHERE id = v_user_id` 확인
- Cursor 위험 영역 #4 (계정 영구 잠금) = 해소

#### 3. note_mastery INSERT 진입점 추적
- `handle_session_complete()` 함수가 INSERT 기록하는 영역 발견
- 함수 본문 = user_stats_daily UPSERT + profiles UPDATE + note_mastery UPSERT (note_attempts JSONB 순회)
- mastery_level 5단계 재계산 기록하는 영역

#### 4. on_session_complete 트리거 확인
- `AFTER INSERT ON user_sessions FOR EACH ROW` 적용된 영역
- `tgenabled='O'` (활성)
- `trg_update_profile_after_session` 트리거도 적용되어 있음 (마이그 20260516)

#### 5. record_game_session() RPC + 트리거 중복 적용됨 영역 확인
- RPC가 기록하는 영역: user_sessions INSERT + user_stats_daily UPSERT + profiles UPDATE
- 트리거가 기록하는 영역: user_stats_daily UPSERT + profiles UPDATE (XP) + note_mastery UPSERT
- 검증 결과 = sessions_count 일치 (2배 X 적용됨, 어떤 영역에서 미설정 기록하는 영역 미확인)
- `profiles.total_xp` = sessions의 `sum(xp_earned)` 정확히 일치 → 트리거만 기록하는 영역 추정

#### 6. 미설정 적용된 영역 발견 (신규)
- `league_groups` 테이블 (`league_members.group_id` 외래키)
- `get_my_league_group_id()` 함수 (`league_members` RLS 정책)
- user_streaks 컬럼 3개 추가 (`streak_freezes_available`·`freezes_used_this_month`·`freezes_reset_month`)
- `ai_reports` 테이블 (AI 보고서, row 0건)
- `marketing_metrics_daily` 테이블 (관리자 대시보드, row 0건)

#### 7. 중복 정의 함수 검증
- 모든 함수 Production 영역에서 1개씩만 적용되어 있음
- `record_sublevel_attempt` = 2개 (6개 인자 + 7개 인자)
  - 6개 인자 = dead (코드 영역 7개 인자만 호출)
  - 7개 인자 = 활성

#### 8. 미설정 적용된 테이블 3개 (Production 미설정 적용됨)
- `payment_events`
- `user_scores`
- `practice_logs`
- 마이그 적용되어 있는데 Production 영역에 미설정 적용된 영역

#### 9. 미설정 적용된 함수 2개 (Production 미설정 적용됨)
- `consume_scan_quota` (`analyze-sheet-music`에서 호출 기록하는 영역)
- `topup_scan_quota` (`apply_payment_topup` 내부에서 호출 기록하는 영역)
- 마이그 적용되어 있는데 Production 영역에 미설정 적용된 영역

#### 10. 미설정 적용된 함수 9개 추가 발견
- `finalize_weekly_leagues`
- `admin_trigger_batch_analysis`
- `calculate_is_minor`
- `handle_new_user` (`handle_new_user_profile`과 다른 영역)
- `handle_profile_updated_at`
- `handle_streak_update`
- `handle_xp_update`
- `sync_minor_status`
- `sync_premium_status`
→ Production 적용되어 있지만 마이그 X (SSoT 깨진 영역)

---

## Phase 3 — 시스템 정합성 복구

### Step 1-1 — Production schema 추출 SQL 완료 (커밋 `30ef37d`)

기록한 파일:
- `scripts/phase3/01_extract_production_schema.sql` (13개 섹션 A~M)
- `supabase/migrations/20260518_phase3_consolidation.sql` (골격, TODO 영역)
- `supabase/migrations/20260518_device_change_events_update_policy.sql` (완성)

### Step 1-2 — SSoT 마이그 작성 (커밋 `7db343c`)

기록한 부분 (561줄):
- 10개 테이블 `CREATE TABLE IF NOT EXISTS`:
  - `user_sessions`, `user_stats_daily`, `note_mastery`, `leagues`, `league_groups`, `league_members`, `admin_actions`, `daily_batch_runs`, `user_streaks`, `subscriptions`
- 19개 인덱스 (부분 인덱스 4개 포함)
- 20개 RLS 정책 (admin SELECT + own SELECT/INSERT)
- 3개 함수: `handle_session_complete`, `check_nickname_available`, `get_my_league_group_id` (TODO 임시 본문)
- 1개 트리거: `on_session_complete`
- 1개 DROP: `record_sublevel_attempt` 6개 인자
- 44개 DROP 영역 (중복 정책 정리)

원칙: idempotent (`IF NOT EXISTS`, `OR REPLACE`, `DROP→CREATE` 패턴)

### Step 1-3 — 함수 본문 정정 (커밋 `e2e596a`)

사용자 짚어주신 영역: 함수 3개 본문이 임시 placeholder 적용됐음. Production 정확본으로 정정.

기록한 부분 (655줄, +94):
- `handle_session_complete`: Production 정확본 완료 (~80줄, user_stats_daily UPSERT + profiles UPDATE + note_mastery UPSERT)
- `check_nickname_available`: Production 정확본 완료 (형식 검증 + 중복 검사)
- `get_my_league_group_id`: Production 정확본 완료 (`LANGUAGE sql STABLE`, 최근 가입 group_id)
- `GRANT EXECUTE` 완료 (anon·authenticated 권한)

검증: TODO·placeholder·임시 적용된 영역 = 0개

### Step 2-A — device_change_events UPDATE 정책 (Production 완료)

기록한 SQL (Supabase SQL Editor):

```sql
DROP POLICY IF EXISTS device_change_events_update_own ON public.device_change_events;
CREATE POLICY device_change_events_update_own
  ON public.device_change_events
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

기록한 후 확인: device_change_events 정책 4개 적용되어 있음 (UPDATE 정책 적용됨 ✅)

→ silent fail 해소 (`userEnvironmentOffset.ts:135` 정상 동작 기록할 영역)

### Step 2-B — record_sublevel_attempt 6개 인자 DROP (Production 완료)

기록한 SQL:

```sql
DROP FUNCTION IF EXISTS public.record_sublevel_attempt(
  integer, integer, integer, integer, integer, text
);
```

기록한 후 확인: 7개 인자 버전 1개만 적용되어 있음 ✅

### Step 3 — 중복 정의 함수 확인 (Production 기록한 부분 검증)

기록한 부분 = 모든 함수 Production에서 1개씩만 적용되어 있음:
- `check_email_exists`: 1
- `get_mastery_score`: 1 (호출 X = dead)
- `handle_new_user_profile`: 1
- `hard_delete_account`: 1 (`auth.users` 삭제 적용되어 있음 ✅)
- `request_account_deletion`: 1

→ Cursor 우려 영역 (어느 버전 있는지 미확인) = 모두 해소

### Step 4 — 6개 문서 19건 정정 (커밋 `acc8349`)

#### A. 01_SCHEMA.md 7건 (1272 → 1428줄)
- A1. `apply_payment_topup` 시그니처 정정 (`p_checkout_session_id` 2번째)
- A2. profiles 7개 컬럼 출처 정정 (Dashboard 직접)
- A3. note_mastery 6개 컬럼 출처 정정 (Dashboard 직접)
- A4. profiles §1.8 INSERT/UPDATE 표 보강 (`record_game_session` + `admin-action` + `handle_session_complete`)
- A5. `hard_delete_account` RPC §1.10 추가
- A6. admin_actions INSERT 위치 정정 (Edge Function)
- A7. 신규 §17·18·19 추가 (user_streaks·subscriptions·league_groups)

#### B. 02_RLS_POLICIES.md 5건 (584 → 624줄)
- B1. practice_logs INSERT WITH CHECK EXISTS 절 보강
- B2. device_change_events UPDATE 정책 추가 (Phase 3 해소)
- B3. idempotent DROP+CREATE 패턴 추가 (5개 마이그)
- B4. 통계 정정 (45 → 65 정책, 11 → 21 `is_admin` 정책)
- B5. 신규 §2.17·2.18·2.19 추가

#### C. 03_SQL_FUNCTIONS.md 11건 (563 → 620줄)
- C1. `apply_payment_topup` 시그니처 정정
- C2. `apply_payment_topup` 호출 위치 정정 (`verify-iap-receipt:475`)
- C3. `is_reviewer()` dead 함수 표기
- C4. `check_nickname_available` 추가
- C5. 통계 정정 (DEFINER 21 → 24, 트리거 4 → 5)
- C6. 트리거 4개 라인 번호 정정
- C7. `record_sublevel_attempt` 정정 (6개 인자 DROP 명시)
- C8. `is_reviewer()` Phase 3 영역 추가 정정
- C9. `handle_session_complete` 추가
- C10. `on_session_complete` 트리거 추가
- C11. `get_my_league_group_id` 추가

#### D. 04_DATA_FLOWS.md 3건 (1192 → 1219줄)
- D1. §1.1 `useNoteLogger` 추가 (`NoteGame.tsx:1067, 1132, 1196`)
- D2. §1.7 결제 영역 정정 (빈 폴더 명시·`Pricing` 호출 X)
- D3. §1.14 `AuthModal.tsx:269` 위치 정정

#### E. 05_KNOWN_ISSUES.md 4건 (391 → 411줄)
- E1. §1.8 #1 `user_note_logs` 활성 사용 정정 (deprecated X)
- E2. §1.3 device_change_events UPDATE Phase 3 해소 ✅
- E3. §2 우선순위 갱신 (🔴 7건 모두 해소)
- E4·E5. Session 2 누락 6건 추가 + Phase 3 완료 표기 ✅

#### F. README.md 1건 (187 → 225줄)
- F1. Phase 3 완료 표기

Cursor 검증 결과 (`acc8349`): 15/17 ✅ + 2/17 ⚠️ 부분 정정 (사용량 ↓ 기록한 부분에서 중단)

### Step 5 — Production 추가 작업 (Cursor 영역에서 미설정 적용된 영역)

기록한 부분 = Production 영역에 마이그 X 적용된 영역 발견됨. Supabase SQL Editor 기록한 부분으로 완료.

#### 미설정 적용된 테이블 3개 완료
- `payment_events` 완료 (CREATE TABLE + RLS + 정책)
- `user_scores` 완료 (CREATE TABLE + 트리거 + RLS + 정책)
- `practice_logs` 완료 (CREATE TABLE + RLS + 정책 + WITH CHECK EXISTS 절)

#### 미설정 적용된 함수 완료
- `apply_payment_topup` 완료
- `consume_scan_quota` 완료
- `topup_scan_quota` 완료

#### Supabase Data API GRANT 정책 변경 대응
- 공지: 2026/10/30부터 기존 프로젝트 영역 새 GRANT 정책 적용
- 적용된 영역: 모든 함수·테이블 GRANT 적용되어 있음 확인 (Supabase 자동 기록한 부분)
- 기록할 영역: 신규 환경 기록할 때 마이그에 GRANT 추가 기록할 영역 (출시 후)

#### 미설정 적용된 함수 9개 발견 (출시 후 영역)
- `finalize_weekly_leagues`
- `admin_trigger_batch_analysis`
- `calculate_is_minor`
- `handle_new_user`
- `handle_profile_updated_at`
- `handle_streak_update`
- `handle_xp_update`
- `sync_minor_status`
- `sync_premium_status`

### Step 6 — forpaddle@noteflex.app 게임 데이터 reset

기록한 이유: 대시보드 KPI 영역 "No data today" 적용되어 있는데 Weakest Notes는 적용되어 있어서 분기 로직 검증 기록할 영역

기록한 SQL (Supabase SQL Editor):
- `DELETE FROM` user_sessions·user_stats_daily·note_mastery·user_sublevel_progress·user_note_logs·daily_sessions·user_streaks·league_members·ai_reports
- profiles UPDATE: `total_xp=0`·`current_streak=0`·`longest_streak=0`·`last_practice_date=NULL`·`current_league='Novice'`

기록한 후 확인:
- 계정 유지 ✅ (role: reviewer)
- 모든 데이터 0 rows ✅
- profiles reset 완료 ✅

기록한 이유 추가: 대시보드 분기 로직 영역 신규 사용자 영역 기록한 부분 검증 기록할 영역

---

## Phase 3 통계

| 항목 | Phase 1 | Phase 3 |
|---|---|---|
| 적용된 테이블 | 16개 | 21개 (+5: user_streaks·subscriptions·league_groups·ai_reports·marketing_metrics_daily) |
| 적용된 RLS 정책 | 45개 | 65개 (+20) |
| 적용된 함수 | 21개 | 24개 + 9개 추가 (총 33개) |
| 적용된 트리거 | 4개 | 5개 (+`on_session_complete`) |
| 마이그 영역 X 적용된 테이블 | 8개 | 2개 (`ai_reports`·`marketing_metrics_daily` 출시 후 기록할 영역) |
| silent fail 해소 | — | 2건 (device_change_events·note_mastery) |
| 위험 영역 4개 검증 | — | 모두 해소 |

---

## 커밋 영역

- `30ef37d` — Phase 3 Step 1 골격
- `7db343c` — Phase 3 Step 1-2 마이그 완성
- `e2e596a` — Phase 3 Step 1-3 함수 본문 정정
- `acc8349` — Phase 3 Step 4 문서 19건 정정

---

## 기록한 부분 검증

- ✅ Phase 1 전수 조사 + Cursor 검증
- ✅ Phase 2 Production 직접 확인
- ✅ Phase 3 마이그 + Production 정합
- ✅ Phase 3 문서 정정
- ✅ 위험 영역 4개 모두 해소
- ⚠️ `ai_reports`·`marketing_metrics_daily` 마이그 미설정 (출시 후 기록할 영역)
- ⚠️ 미설정 적용된 함수 9개 마이그 미설정 (출시 후 기록할 영역)

---

## 2026-05-18 — Phase 4 Sentry 도입 + Paddle 결제 통합 + 블로그 카테고리 매핑 수정

### Phase 4 — Sentry 도입 완료

- Sentry React SDK 설치 및 초기화 (`af179f5`) — DSN: o4511405573013504
- Phase 4/1차: silent fail 5건 + 에러 23건 = 25건 logger 호출 추가 (`148ea6d`)
- Phase 4/2차: logger.info 13건 + logger.warn 2건 + logger.setUser 4건 = 19건 추가 (`e16aab8`)
- Phase 4/3차: `GameErrorBoundary` + `PaymentErrorBoundary` 도입 (`baf653a`)
- Vercel 환경변수: `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT` 설정
- production 동작 확인 완료

### Paddle 결제 시스템 통합 완료

- Sandbox 환경 설정 완료 (Monthly $2.99 / Yearly $19.99)
- `src/lib/paddle.ts`: `openCheckout` + `getPaddleLocale` 헬퍼 작성
- `Pricing.tsx`: `handleCta`에서 `openCheckout` 직접 호출 추가 (`156e44c`)
- `UpgradeModal` 복원 + Paddle Checkout locale 동적 적용 (`df053eb`)
- `UpgradeModal` onClose → navigate 호출 순서 수정 (무한 순환 해소) (`92332f6`)
- `/checkout/success`, `/checkout/failed` 페이지·라우트 확인 완료
- redirect 방식 결정 과정:
  - `eventCallback` v1 시도 (`0fccb16`) → 광범위 캐치 버전 시도 (`e617727`)
  - production에서 동작 불안정 → `settings.successUrl` 방식으로 복원 (`89f2db6`)
- `/pricing`, `/checkout/success`, `/checkout/failed`에서 `ComingSoonGate` 제거 (`edb16cd`)
  - 원인: `VITE_GAME_ENABLED=false` 환경에서 결제 완료 후 외부 redirect → `ComingSoonGate`가 메인으로 재redirect

### Paddle Webhook 강화

- `supabase/functions/paddle-webhook`: 서명 검증 + 멱등성(UPSERT) + 라이프사이클 분기 구성
- `subscription.past_due` 분기 추가 (`a26d551`) — 카드 잔액 부족 시 premium 자동 회수
- `adjustment.created` / `adjustment.updated` 분기 추가 (`033a726`)
  - `chargeback` action: `profiles.is_premium=false`, `premium_until=null` 즉시 업데이트
  - `refund` / `credit` / `chargeback_warning` / `chargeback_reverse`: 로깅만 처리
- Edge Function `verify_jwt = false` 설정 (`4cc387f`)
  - 원인: Paddle은 자체 서명만 사용하므로 Supabase 기본 JWT 검증이 모든 webhook 요청을 `401 UNAUTHORIZED_NO_AUTH_HEADER`로 거부
  - `supabase/config.toml`에 `[functions.paddle-webhook]` 섹션 추가
  - Paddle Dashboard에서 실패 이벤트 Resend 후 정상 처리 확인

### 결제 라이프사이클 검증

- 결제 → `/checkout/success` 진입 ✅
- `subscription.created` / `activated` → `is_premium = true` ✅
- `subscription.canceled` → `is_premium = false` ✅ (`sync_premium_status` 트리거 동작)
- 정책 결정: 취소는 Paddle 표준 동작에 위임 (기간 만료 시 자동 회수)
- 환불은 Paddle Dashboard에서 수동 처리 (abuse 방지)

### 블로그 카테고리 매핑 수정 (`f7d7d7a`)

- 2026-05-16~18 신규 18편의 카테고리가 `STYLE_MAP` 미등록 → 기본 아이콘(`🎼`)만 표시되는 문제
- 신규 카테고리 6종을 기존 `STYLE_MAP` 카테고리로 매핑:
  - 음악 이론 → 음악 이론 & 화성학 (EN: Music Theory → Theory & Harmony)
  - 학습 전략 / 학습 심리학 / 음악 교육 / 신경과학 → 학습 데이터·과학 (EN: Learning Science)
  - 악기별 초견 → 악기별 초견 전략 (EN: Instrument-Specific → Sight-Reading by Instrument)
  - 실전 응용 → 실전 연습 가이드 (EN: Practical Application → Practice Hub)
- 미매핑 카테고리 2건 추론 적용:
  - 학습 심리학 / Learning Psychology → 학습 데이터·과학 / Learning Science
  - 사용자별 초견 / Persona Reading → 악기별 초견 전략 / Sight-Reading by Instrument

### 학습 사항 (다음 세션 참조)

- 결제·인증 라우트 디버깅 시 `ComingSoonGate`, `NavOnlyRoute` 등 라우트 가드 선행 확인
- 결제·인증 SDK는 공식 문서 기준 방식 우선 적용, 비표준 대안은 동작 확인 후 도입
- Edge Function 배포 시 `--no-verify-jwt` 옵션 또는 `config.toml`에 `[functions.{name}] verify_jwt = false` 명시 필수 (외부 서비스 webhook 공통)
- 블로그 신규 카테고리는 `src/lib/categoryStyle.ts`의 `STYLE_MAP`에 먼저 등록 후 글 작성

### 커밋 목록 (2026-05-18)

- `af179f5` — Sentry SDK 도입
- `148ea6d` — Phase 4/1차 (silent fail + 에러 logger 25건)
- `e16aab8` — Phase 4/2차 (info + warn + setUser 19건)
- `baf653a` — Phase 4/3차 (GameErrorBoundary + PaymentErrorBoundary)
- `72851ee`, `b448f0b` — Vercel rebuild trigger
- `156e44c` — Pricing.tsx에 openCheckout 직접 호출 추가
- `df053eb` — UpgradeModal 복원 + Paddle Checkout locale 동적 적용
- `92332f6` — UpgradeModal onClose → navigate 순서 수정
- `f7d7d7a` — 블로그 18편 카테고리 STYLE_MAP 매핑 수정
- `0fccb16` — Paddle eventCallback v1
- `e617727` — Paddle eventCallback 광범위 캐치
- `89f2db6` — settings.successUrl 복원 (eventCallback 제거)
- `edb16cd` — /checkout/success·/failed·/pricing에서 ComingSoonGate 제거
- `a26d551` — paddle-webhook에 subscription.past_due 분기 추가
- `4cc387f` — Edge Function JWT 검증 비활성화 (verify_jwt = false)
- `033a726` — paddle-webhook에 adjustment.created/updated 분기 추가
- ⚠️ Cursor 검증 `acc8349` = 17건 중 15건 ✅ + 2건 ⚠️ 부분 (사용량 ↓ 중단)
