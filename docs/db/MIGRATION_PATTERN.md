# Supabase 마이그레이션 표준 패턴

> **최초 작성**: 2026-06-02
> **계기**: 2026-06-01 feedback 테이블 신규 추가 후 `/admin/feedback`에서 row가 0건만 응답된 사고. 원인은 RLS·GRANT 명시 누락. 다음번 신규 테이블에서 같은 함정 회피용 학습 기록.

---

## 1. Supabase 신규 테이블의 기본값 — 자주 빠지는 함정

Supabase에서 `CREATE TABLE public.<name> (...)` 만 실행하면 다음 상태가 된다:

| 항목 | 기본값 | 결과 |
|---|---|---|
| RLS | **ENABLED** (자동 활성) | 정책 없으면 모든 role(anon·authenticated 포함)이 SELECT/INSERT/UPDATE/DELETE 차단 |
| role grants | **부여 없음** | RLS off 상태로 두더라도 anon·authenticated 모두 권한 X — PostgREST가 빈 결과 또는 403 |
| Postgres owner | postgres (superuser) | 마이그레이션 실행 자만 접근 가능 |

즉 **"테이블만 만들어도 PostgREST로 조회 불가"** — RLS도 grants도 함께 명시해야 클라이언트가 본다.

### 두 layer가 동시에 작동
- **RLS off + GRANT 부여 ✓** → 모든 row 모두 보임 (가장 단순, 비민감 데이터에 적합)
- **RLS on + 정책 + GRANT 부여 ✓** → 정책 조건 통과한 row만 보임 (민감 데이터)
- **RLS off + GRANT 없음** ✗ → 빈 결과 (오늘 사고 패턴)
- **RLS on + 정책 ✓ + GRANT 없음** ✗ → 정책 통과해도 grant 없어서 차단

---

## 2. 표준 템플릿

### Case A — RLS OFF (간단, 비민감 데이터)

```sql
-- ═══════════════════════════════════════════════════════════════
-- Migration: YYYYMMDD_<name>.sql
-- ═══════════════════════════════════════════════════════════════
-- 목적: <한 줄>
-- 사용처: <컴포넌트·Edge Function·페이지>
-- RLS: 비활성 (사유: <비민감 / 운영 단순화 / 등>)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.<table> (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ...
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_<table>_created_at
  ON public.<table> (created_at DESC);

-- ★ RLS 비활성 (기본값 ENABLE 회피)
ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY;

-- ★ 권한 부여 (Supabase 기본값 = 부여 없음)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO anon, authenticated;
```

### Case B — RLS ON + 정책

```sql
-- (CREATE TABLE / INDEX 동일)

ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

-- INSERT: anon + authenticated
DROP POLICY IF EXISTS <table>_insert_all ON public.<table>;
CREATE POLICY <table>_insert_all
  ON public.<table>
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- SELECT: admin만 (is_admin() 사전 GRANT EXECUTE 필요 — 아래 §3 참고)
DROP POLICY IF EXISTS <table>_admin_select ON public.<table>;
CREATE POLICY <table>_admin_select
  ON public.<table>
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ★ 정책뿐 아니라 role grants도 명시 (정책은 row 단위 필터, grants는 table 단위 권한)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO anon, authenticated;
```

---

## 3. `is_admin()` 사용 시 EXECUTE 권한도 함께

20260510 rls_audit.sql에서 정의된 `public.is_admin()`은 GRANT EXECUTE이 `authenticated`만 가짐 (default). RLS 정책 평가 시 anon이 함수 호출하면 permission denied 발생 가능. **신규 테이블이 anon INSERT를 허용하는데 SELECT만 admin인 케이스**에서 호출 안전성 확보 위해:

```sql
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
```

선례: `supabase/migrations/20260601_premium_waitlist_rls_restore.sql` — 가오픈 직전 RLS 실패 사고 후 적용.

---

## 4. Case studies

### 사례 1: `premium_waitlist` (2026-05-31 가오픈 직전 RLS 실패)
- 초기 마이그레이션이 RLS ENABLE + 정책 작성했으나 `is_admin()` EXECUTE를 anon에 부여 안 함 + 정책에 `TO` 절 누락
- anon이 SELECT 시 정책 평가 중 함수 호출 거부 → 출시 직전 RLS 임시 비활성으로 대응
- 정상화 마이그레이션 (`20260601_premium_waitlist_rls_restore.sql`)에서 `GRANT EXECUTE` + 정책 `TO authenticated` 명시로 해결

### 사례 2: `feedback` (2026-06-01 디버깅)
- 초기 마이그레이션이 `DISABLE ROW LEVEL SECURITY`는 명시했으나 GRANT 누락
- `/admin/feedback`에서 row 0건 응답 (RLS off + grant 없음 = 빈 결과)
- 정상화 마이그레이션 (`20260602_feedback_rls_grants.sql`)에서 `GRANT ALL ON public.feedback TO anon, authenticated`로 해결

---

## 5. 체크리스트 (신규 테이블 마이그레이션 작성 시)

- [ ] 헤더 코멘트에 목적·사용처·RLS 정책 명시
- [ ] `CREATE TABLE IF NOT EXISTS` (idempotent)
- [ ] 자주 쓰는 컬럼 인덱스 (`CREATE INDEX IF NOT EXISTS`)
- [ ] **RLS 명시적 활성/비활성** (`ALTER TABLE ... ENABLE/DISABLE ROW LEVEL SECURITY`)
- [ ] **GRANT 명시적 부여** (`GRANT SELECT, INSERT, UPDATE, DELETE ON ... TO anon, authenticated`)
- [ ] RLS ON 시 정책 4종(SELECT/INSERT/UPDATE/DELETE) 모두 `TO <role>` 절 포함
- [ ] `is_admin()` 사용 시 `GRANT EXECUTE TO anon, authenticated` 사전 부여 확인
- [ ] 마이그레이션 끝에 검증 SQL 주석 (RLS 상태·정책·grants 조회)
- [ ] prod 적용 후 클라이언트 SELECT/INSERT 직접 검증

---

## 6. 검증 SQL (수동 실행, prod 적용 직후)

```sql
-- RLS 상태
SELECT relname, relrowsecurity
  FROM pg_class
  WHERE relname = '<table>' AND relnamespace = 'public'::regnamespace;

-- role별 grants
SELECT grantee, privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = '<table>'
  ORDER BY grantee, privilege_type;

-- 정책 + TO 절
SELECT polname,
       pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS check_expr,
       polcmd,
       ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(polroles)) AS roles
  FROM pg_policy
  WHERE polrelid = ('public.<table>')::regclass
  ORDER BY polname;

-- is_admin() EXECUTE 권한
SELECT grantee, privilege_type
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public' AND routine_name = 'is_admin';
```
