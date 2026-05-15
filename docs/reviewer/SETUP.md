# Paddle 심사관 reviewer 흐름 — 운영 가이드

> **목적**: Paddle 심사관이 결제 흐름 + 게임 영역 확인하도록 즉시 로그인 흐름 제공.
> **권한**: Free tier (Lv1~5 Sub1 + 7회/일 + 광고 박힘 + GAME_ENABLED 우회).
> **출시 후**: 환경변수 제거하면 즉시 비활성화.

---

## 1. Production 마이그레이션 적용

Supabase Dashboard > SQL Editor에서 다음 마이그레이션 실행:

```sql
-- 파일: supabase/migrations/20260515_reviewer_role.sql
-- 위 파일 내용 그대로 복사 → SQL Editor 실행
```

**검증 쿼리**:
```sql
SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'forpaddle@noteflex.app';
SELECT id, role, nickname, profile_completed FROM public.profiles WHERE role = 'reviewer';
```

각각 1행 반환 박혀야 함.

---

## 2. Vercel 환경변수 설정

**Vercel Dashboard → Settings → Environment Variables → Production** 영역에 박음:

| 변수명 | 값 | 비고 |
|---|---|---|
| `SUPABASE_URL` | `https://{project-ref}.supabase.co` | 기존 `VITE_SUPABASE_URL`과 동일 |
| `SUPABASE_ANON_KEY` | (Supabase Dashboard > Settings > API > anon public) | 기존 `VITE_SUPABASE_ANON_KEY`와 동일 |
| `SUPABASE_SERVICE_ROLE_KEY` | (Supabase Dashboard > Settings > API > service_role) | ⚠️ **클라이언트 노출 절대 X** |
| `REVIEWER_ACCESS_CODE` | 강력한 랜덤 문자열 | 예: `a3f7-b2e9-c8d1-x5y2` (16자리 + 구분자) |

**랜덤 코드 생성** (터미널):
```bash
node -e "console.log(crypto.randomBytes(12).toString('hex').match(/.{4}/g).join('-'))"
# 예: a3f7-b2e9-c8d1-x5y2c8d1
```

환경변수 박은 후 Vercel **Redeploy** 박음 (재배포 박혀야 환경변수 적용).

---

## 3. 검증 시나리오 (사용자 직접 박음)

### A. 영향 X 영역
- [ ] 일반 사용자가 메인 → 가입 → 매직링크 정상 흐름 박힘
- [ ] 일반 사용자가 로그인 → 매직링크 정상 흐름 박힘
- [ ] AuthModal Step 1·2·3 (가입·매직링크·복구 화면) 정상 박힘

### B. reviewer 흐름
- [ ] AuthModal 풋터 "Paddle Reviewer Access" 링크 박힘 (작은 텍스트)
- [ ] 클릭 → reviewer 패널 (이메일 + 액세스 코드 입력 폼) 박힘
- [ ] `forpaddle@noteflex.app` + 정확한 코드 → 즉시 로그인 박힘
- [ ] 로그인 후 게임 영역 진입 가능 (GAME_ENABLED 우회 박힘)
- [ ] 로그인 후 Lv1~5 Sub1만 접근 박힘 (Free tier 한도)
- [ ] 로그인 후 광고 노출 박힘 (일반 사용자 영역 정합)
- [ ] 로그인 후 Premium 업그레이드 버튼 → Paddle Sandbox checkout 박힘

### C. 보안 시나리오
- [ ] `forpaddle@noteflex.app` + 잘못된 코드 → 401 "Invalid credentials" 박힘
- [ ] 다른 이메일 + 정확한 코드 → 401 (화이트리스트 차단)
- [ ] 빈 이메일 또는 빈 코드 → 401
- [ ] Rate limit: 같은 IP에서 6회 연속 시도 → 429 "Too many requests"
- [ ] 환경변수 `REVIEWER_ACCESS_CODE` 제거 → 모든 요청 401

---

## 4. Paddle 심사관 전달 정보

**메일 또는 Paddle 심사 폼 영역에 박을 정보**:

```
Test Account for Paddle Review

Login URL: https://noteflex.app/reviewer-login
Email: forpaddle@noteflex.app
Access code: {REVIEWER_ACCESS_CODE 값 박음}

Steps:
  1. Open https://noteflex.app/reviewer-login
  2. Enter the email and access code above
  3. Click "Continue" → redirected to /play (the game area)

This account has Free tier permissions and can access the full sight-reading
game with limits (7 plays/day, Levels 1–5 Sub-stage 1). Premium upgrade
button leads to Paddle Sandbox checkout.
```

> ⚠️ 메인 페이지 (https://noteflex.app/) 는 출시 전 ComingSoonGate로 차단되어 있어
> AuthModal 풋터 링크가 노출되지 않음. 반드시 `/reviewer-login` 직접 URL 사용.

---

## 5. 출시 후 비활성화 절차

**방법 1 (권장)**: 환경변수 제거
1. Vercel Dashboard → Settings → Environment Variables
2. `REVIEWER_ACCESS_CODE` 삭제
3. Redeploy → 즉시 비활성화 (코드 비교 통과 X → 401)

**방법 2**: API 라우트 파일 삭제
1. `rm api/reviewer-login.ts` (사용자 직접 박음)
2. 또는 `git rm api/reviewer-login.ts && git push`
3. 다음 배포 시 404 박힘

**방법 3**: DB에서 reviewer 권한 제거 (계정은 유지, 권한만 박탈)
```sql
UPDATE public.profiles SET role = NULL WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'forpaddle@noteflex.app'
);
```

---

## 6. 보안 검토 체크리스트

- [x] `service_role_key`는 Vercel 환경변수에만, 코드·git에 노출 X
- [x] 이메일 화이트리스트 하드코딩 (env로 빼지 말 것 — 실수 방지)
- [x] 코드 비교 = timing-safe (Buffer + XOR)
- [x] Rate limiting (IP당 분당 5회)
- [x] 실패 시 구체 사유 노출 X (`"Invalid credentials"` 만 박음)
- [x] reviewer = Free tier 격리 (Premium 영역 침범 X)
- [x] reviewer가 다른 사용자 데이터 조회 X (RLS 그대로 박힘)
- [x] auth.users.email_confirmed_at 채워져 있어 verifyOtp 통과

---

## 7. 트러블슈팅

### "Invalid credentials" 박힘 (정확한 코드인데도)
- Vercel 환경변수 `REVIEWER_ACCESS_CODE` 박혀있는지 확인
- 환경변수 박은 후 Redeploy 박았는지 확인
- 코드 앞뒤 공백 없는지 확인

### "Server error" 박힘
- `SUPABASE_SERVICE_ROLE_KEY` 박혀있는지 확인
- `SUPABASE_URL` 박혀있는지 확인
- Vercel Function 로그 확인 (Vercel Dashboard > Functions)

### 로그인 박혔는데 게임 영역 진입 X
- `forpaddle@noteflex.app` 의 `profiles.role = 'reviewer'` 박혀있는지 확인:
  ```sql
  SELECT role FROM profiles WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'forpaddle@noteflex.app'
  );
  ```
- ComingSoonGate가 admin·reviewer 우회 박혀있는지 코드 확인
