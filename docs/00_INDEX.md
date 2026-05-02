# Noteflex 종합 설계 문서 — 인덱스

> **작성일**: 2026-04-28 (자동 생성 — 출근 전 일괄 작업)
> **대상**: 새 합류 개발자 / 운영자 / 출시 검토자
> **방법론**: 코드·DB·인프라 직접 분석 결과 (추측 아님). 확인 필요한 부분은 본문에 "(코드에서 확인 필요)"로 표기.

---

## 본 문서 셋

| # | 문서 | 한 줄 요약 |
|---|---|---|
| 01 | [01_OVERVIEW.md](./01_OVERVIEW.md) | 서비스 정체성, 비즈니스 모델, 기술 스택, 디렉토리 구조, 의존성, 환경변수 — **전체 그림** |
| 02 | [02_ARCHITECTURE.md](./02_ARCHITECTURE.md) | Provider 트리, 라우팅, 컴포넌트·hook 의존성 그래프, 데이터 흐름 시나리오 — **시스템 구조** |
| 03 | [03_GAME_LOGIC.md](./03_GAME_LOGIC.md) | 21단계, retry queue, 가중치 출제, 키사인, 스와이프, 라이프, XP — **게임 도메인 로직** |
| 04 | [04_DB_SCHEMA.md](./04_DB_SCHEMA.md) | 테이블·컬럼·RLS·SQL 함수·트리거·Edge Function — **Supabase 데이터 모델** |
| 04 | [04_RETRY_SYSTEM.md](./04_RETRY_SYSTEM.md) | RetryQueue 상태 머신, composeBatch/composeFinalRetryBatch, §0.1 dedup, lives, parity, 자동 검증 시스템 (Step B) — **§4 retry 명세** |
| 05 | [05_FEATURES.md](./05_FEATURES.md) | 인증·게임·분석·결제·관리자·법적·콘텐츠 카테고리별 기능 — **사용자 관점 카탈로그** |
| 06 | [06_TESTING.md](./06_TESTING.md) | 18개 테스트 파일, 통과 현황, 갭 분석, E2E 부재, CI/CD — **테스트 + 품질** |
| 07 | [07_DEPLOYMENT.md](./07_DEPLOYMENT.md) | Vercel·Porkbun·Supabase·Paddle·환경변수·출시 절차 — **배포 + 인프라** |

> **04 prefix 공존**: `04_DB_SCHEMA.md` (Supabase 스키마)와 `04_RETRY_SYSTEM.md` (§4 retry 명세)는 서로 다른 도메인. 파일명 충돌 없음 (Q-B4 결정 2026-05-02).

---

## 함께 보기

- 📋 [PENDING_BACKLOG.md](./PENDING_BACKLOG.md) — 미구현 백로그 24항목 + 4 기획서 종합 (출시 전 결정 필요 항목 포함)
- 📘 [`README.md`](../README.md) (프로젝트 루트) — 한 단락 소개
- 📘 [`README_IAP_TESTING.md`](../README_IAP_TESTING.md) (프로젝트 루트) — IAP 함수 로컬 테스트 가이드

---

## 빠른 진입 가이드

### "프로젝트를 처음 봅니다"
→ `01_OVERVIEW.md` → `02_ARCHITECTURE.md` → `05_FEATURES.md` 순으로 읽으면 1시간 내 전체 그림 잡힘.

### "게임 알고리즘이 궁금합니다"
→ `03_GAME_LOGIC.md` 단독으로 충분 (코드 라인 번호 다수 포함).

### "DB 스키마와 RLS를 확인하려 합니다"
→ `04_DB_SCHEMA.md`. 외부 정의 테이블 6개는 표시되어 있으니 Supabase Studio와 교차 확인 필요.

### "출시 직전 점검 중입니다"
→ `07_DEPLOYMENT.md §8` (출시 플로우) + `06_TESTING.md §9` (테스트 보강 우선순위) + `PENDING_BACKLOG.md §11` (환경변수 체크리스트).

### "테스트 작성을 추가하려 합니다"
→ `06_TESTING.md §5` (갭 분석) + `§9` (권장 보강 우선순위).

---

## 문서 갱신 정책

- 본 7개 문서는 **2026-04-28 시점의 코드 베이스**를 분석한 산출물이다.
- 코드 변경 시 자동 갱신되지 않음 — 마이그레이션·핵심 hook·구독 정책 변경 시 해당 문서 수정 필요.
- 새 항목 추가 시: `00_INDEX.md`에도 링크 갱신.
- 결정 보류·미구현은 `PENDING_BACKLOG.md`로 일원화.
