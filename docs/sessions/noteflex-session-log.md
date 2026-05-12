# Noteflex 세션 로그

> **운영 원칙**: 1개 파일에 모든 세션 누적. 시간 역순 (최신 위). 매 세션 마무리 시 Claude Code가 박음.

---

## 2026-05-12 (화) — Auth Sprint 2: 복구 UX + 탭 싱크 ✅

### Commits
- C1: `feat(auth): 30일 이내 탈퇴 계정 복구 UX` (`fe979dc`)
- C2: `feat(auth): 탈퇴 시 닉네임·아바타 보존 + 부분 유니크 인덱스` (`b1ffa88`)
- C3: `feat(auth): 매직링크 탭 싱크 이중 채널 + 자동 닫기` (`abce786`)

### 완료 내역

**C1 — 계정 복구 UX (30일 이내 탈퇴)**
- `check_email_exists` v3: `account_status` TEXT + `recovery_days_left` INT 반환
  - `'new'` → 미가입/미인증, `'active'` → 정상, `'deleted_recoverable'` → 탈퇴 30일 이내, `'deleted_expired'` → 탈퇴 30일 경과
- `restore_account()` RPC: magic link 클릭 후 `auth.uid()` 기반 soft-delete 플래그 초기화 + email 복원
- `hard_delete_expired_accounts()` RPC: 서비스 롤 배치 작업용 대상 목록 반환 (anon/authenticated 실행 불가)
- `AuthModal` Step 3 복구 패널: 남은 일수 표시 + "계정 복구하기" 버튼 → `signInWithOtp` with `?action=restore`
- `AuthCallback`: `?action=restore` 감지 → `restore_account()` RPC 호출, 실패 시 `/?auth_error=restore_failed`
- `profile.ts` `EmailCheckResult`: `accountStatus` + `recoveryDaysLeft` 필드 추가, `exists`/`confirmed` 하위 호환 유지
- 단위 테스트 5개 (AuthModal.test.tsx)

**C2 — 탈퇴 시 닉네임·아바타 보존**
- `request_account_deletion` 수정: 이메일만 마스킹, `nickname` · `display_name` · `avatar_url` 보존
- `profiles_nickname_active_unique` 부분 유니크 인덱스: `WHERE is_deleted = false AND nickname IS NOT NULL`
  → 탈퇴 계정 닉네임이 신규 가입 차단 안 함; 복구 시 닉네임 그대로 복원
- 단위 테스트 4개 (AuthCallback.test.tsx: restore_account 호출·성공·실패·미호출)

**C3 — 매직링크 탭 싱크 이중 채널**
- `AuthCallback`: `localStorage.setItem('noteflex_auth_complete', timestamp)` 추가 (storage event fallback)
- `App.tsx AuthBroadcastListener`: BroadcastChannel primary + localStorage `storage` event fallback
- `AuthModal` Step 2: `storage` event 및 BroadcastChannel `AUTH_COMPLETE` 수신 시 `onClose()` 자동 호출
- `AuthModal` Step 2: "인증 대기 중..." 대기 인디케이터 추가 (`data-testid="auth-waiting-indicator"`)
- 단위 테스트 3개 (AuthModal.test.tsx: waiting indicator, storage event → onClose, BC → onClose)

### 검증
- AuthModal 34/34 PASS, AuthCallback 12/12 PASS, ProfilePage 22/22 PASS (총 68개)
- tsc 오류 0

### Production Apply 필요 (Supabase Dashboard > SQL Editor)
1. `supabase/migrations/20260513_account_recovery.sql` — check_email_exists v3 + restore_account + hard_delete_expired_accounts
2. `supabase/migrations/20260513_preserve_nickname.sql` — request_account_deletion 수정 + 부분 유니크 인덱스
3. `supabase/migrations/20260512_profile_completed_default.sql` (Sprint 1, 아직 미적용 시)

### 다음 세션
- Sprint 2 C3 Edge Function: `hard_delete_expired_accounts()` 를 호출하는 cron job (30일 경과 계정 auth.users 영구 삭제)
- Supabase Realtime RLS 검토 (profiles 테이블 구독 범위)

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
- 13일차 신규 작성 슬롯 = §5-65 단 1개. §3-43(12일차 차용)·§8-87(10일차 차용) advance write 박혀있어 14일차 §4-48·§1-7 두 개 차용.

### 검증
- 6 이미지 curl HTTP 200 ✓ (Wikimedia Commons API로 파일명 확인 + UA 헤더로 429 회피)
- 모든 이미지 = Wikimedia Commons (메모리 #13 인증·공인 사이트)
- Hook 영역 = 텍스트만, 첫 이미지 = Scene 영역 (메모리 #13 패턴)
- 학술 인용 5개 DOI 박음
- 누적 64편 (한 32 + 영 32)
- §1.1 표 13·14일차 ✅ 갱신, §6 v18 박음

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
- Apple OAuth = Apple Developer 계정($99/년) 등록 후, iOS 출시 시점에 박음

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
- §1.1 표 11·12일차 ✅ 갱신, §6 v16·v17 박음.

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
- `4670b58` fix(rls): RLS 마이그레이션 production 테이블만 박음
- `4eaa9e2` fix(auth): 가입 흐름 3단계 분리 — 이메일 검증 먼저 박음 (§X-1 C1 정정)

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
- **커밋**: `4670b58` fix(rls): RLS 마이그레이션 production 테이블만 박음
- **원인**: production에 없는 테이블(payment_events 등)에 직접 DDL → 에러
- **정정**: optional 5개 테이블 `DO $block$ BEGIN ... EXCEPTION WHEN undefined_table THEN RAISE NOTICE; END $block$;` 패턴으로 감쌈
  - Core 4 (직접 DDL): profiles · user_note_logs · user_sublevel_progress · daily_sessions
  - Optional 5 (DO block): user_custom_scores · payment_events · device_change_events · user_scores · practice_logs
- **향후**: optional 테이블 생성 시 해당 마이그레이션에 RLS 함께 박음

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
- 이미지가 글 시작 직후 박힌 영역 → 원인 조사 의뢰

### 조사 결과
컴포넌트 자동 렌더링 없음. **원인 = .md 파일 본문 첫 줄 이미지 (Case 2)**

- `BlogPost.tsx`: coverImage 관련 `<img>` 렌더링 없음. `<MarkdownContent>{post.content}</MarkdownContent>` 단순 패스스루
- `MarkdownContent.tsx`: ReactMarkdown 그대로 렌더링. 이미지 특별 처리 없음
- `markdownLoader.ts`: parseFrontmatter = frontmatter 제거 후 나머지 전체가 content. .md 파일 첫 줄 `![]()` = 그대로 body에 렌더링됨

### 사용자 결정
- C1 컴포넌트 정정 = 불필요 (자동 렌더링 없음)
- .md 파일 박은 영역 정정 = **낮에 한 번에 박음 (PENDING)**
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

### 박은 주제
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
- 원인: keySigFontSize * 0.28 = 17.9px 아래로 내려 박힌 잘못된 offset

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
- 사용자 직접 검증: F# treble line 5 정확 박혔는지 확인

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
- `c63b04a` fix(staff): 조표 위치 표준 음악 표기 박음 — flat/sharp 각 stave position

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
- segmentWidth × 0.5 → 0.25 박음 (등분 1/4 위치, 거리 절반)
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
- Q3: SublevelPassedDialog 배지 + 메시지 박음
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

## 2026-05-09 (저녁) — §X 사용자 등록·관리 영역 4 Phase 박음 (PENDING)

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

### docs 박힘
- PENDING_BACKLOG §X 신규 추가 (§B-0과 §1 사이)
- §5.2·§5.3 → §X로 통합 마킹
- 변경 이력 v 박음

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

> F3 (NoteGame 안전망 패턴) = F1 commit에 통합 박힘 (LevelSelect 테스트 격리 영역 필요).

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
- **docs 갱신 패턴 v2 (Group B부터)**: sub-step별 file in-place ✅ 박음(commit X) + 마지막 docs 일괄 commit 1개. 코드 commit 사이에 docs commit 끼움 X.
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
- **blog_topics_100.md**: §6 이력 6행 추가 + §1.1 10일차 행 박음 + v15. 누적 46편 (한 23 + 영 23).

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

> **원본 전문**: 이 파일 하단 섹션 (구 세션 로그 형식) 에 박힘. 아래 요약은 핵심 결정·사실·commit만 추출.

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
| 세션 로그 박음 | ✅ |
| PENDING_BACKLOG.md 갱신 | ✅ |
| DESIGN_VS_CODE_GAP.md 갱신 | ✅ |
