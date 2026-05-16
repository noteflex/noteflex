# 블로그 작업 로그

> **운영 원칙**: 블로그 관련 정책 결정·글 수 변동·이미지 정책·DOI 검증 결과를 이 파일에 누적.
> Claude Code가 블로그 작업 완료 시 자동 갱신.

---

## 정책 결정

### 커버 이미지 정책 (2026-05-16 확정 — 옵션 C)
- **결정**: 카테고리별 그라데이션 + 아이콘 박스 (실제 이미지 X)
- **이유**: PRACTICAL_GUIDE 글에 무관한 클래식 음악 이미지 박힘 문제 → 통일성 우선
- **구현**: `src/components/blog/CategoryCover.tsx` + `src/lib/categoryStyle.ts`
- **frontmatter `coverImage` 데이터**: 보존 (출시 후 이미지 정책 재검토 시 재활용 가능)
- **카테고리별 색상**:
  | 카테고리 | 색상 | 아이콘 |
  |---|---|---|
  | 음악 이론 & 화성학 / Theory & Harmony | amber | 📚 |
  | 초견의 정석 / Sight-Reading Lab | amber | 📚 |
  | 실전 연습 가이드 / Practice Hub | emerald | 🎵 |
  | 직군별·학습과학·뮤직 테크 | emerald / sky | 🎵 / 🎧 |
  | 악기별 / Instrument | violet | 🎹 |
  | 미매핑 fallback | stone | 🎼 |

### 본문 이미지 정책 (2026-05-15 D+A 감사 후 확정)
- **HISTORY_THEORY**: Wikimedia Commons 공개 도메인 이미지 2개 권장
  - 허용 출처: Wikimedia Commons, LoC, Met Museum, BnF, NYPL, Smithsonian, IMSLP, Mutopia
  - 본문 내 자연스러운 위치 (후크 X)
  - 이미지 출처 섹션: `## 이미지 출처` (h2, 본문 끝)
- **PRACTICAL_GUIDE**: 본문 이미지 0개 (그라데이션 커버만)
  - 예전에 박혀있던 이미지 출처 섹션 = 제거 완료 (5/15)
- **공통**: `curl -I` HTTP 200 검증 필수 (링크 박기 전)

### 출처 섹션 구조 (2026-05-15 확정)
- **HISTORY_THEORY** (KO):
  ```
  ## 이미지 출처
  - 이미지명: 출처 URL (공개 도메인)
  
  ## 참고 문헌
  - 인용1
  - 인용2
  ```
- **HISTORY_THEORY** (EN):
  ```
  ## Image Sources
  - Image name: Source URL (Public Domain)
  
  ## References
  - Citation1
  ```
- **PRACTICAL_GUIDE** (KO): `## 참고 문헌` 만
- **PRACTICAL_GUIDE** (EN): `## References` 만

### 학술 인용 원칙
- DOI URL 반드시 `curl -I` 200 또는 403(봇차단) 검증 후 박음
- 404 → DOI URL 제거, 인용 정보(저자·연도·제목·저널) 유지
- 블로그 작성 7가지 구조: Hook → Promise → Scene → Insight+Evidence → Three Acts → Specificity → Callback

---

## 누적 글 수

| 날짜 | KO | EN | 합계 | 비고 |
|---|---|---|---|---|
| 2026-05-15 | 40 | 40 | 80 | D+A 감사 + cover image 정책 박음 |
| 2026-05-16 | 40 | 40 | 80 | cover 그라데이션 교체 (글 수 변동 X) |
| 2026-05-16 | 46 | 46 | 92 | 신규 6편 추가 (§1-13·§7-80·§3-42·§4-50·§1-3·§3-36) |

### 카테고리별 분포 (EN 기준, 2026-05-16 신규 6편 추가 후)
| 카테고리 | 글 수 |
|---|---|
| Practice Hub (실전 연습 가이드) | 15 (+2: §3-42·§3-36) |
| Theory & Harmony (음악 이론 & 화성학) | 9 |
| Sight-Reading Lab (초견의 정석) | 11 (+3: §1-13·§4-50·§1-3) |
| Music Tech (뮤직 테크 & 미래) | 6 (+1: §7-80) |
| Sight-Reading by Role / Learning Strategies by Role | 2 |
| Instrument Guides / Sight-Reading by Instrument | 2 |
| Learning Science | 1 |

---

## DOI 검증 결과

### 2026-05-15 전수 검증 (30개 DOI URL)
| 결과 | 수 | 처리 |
|---|---|---|
| 200 정상 | 3 | 그대로 유지 |
| 403 봇 차단 (실제 존재) | 25 | 그대로 유지 |
| 404 진짜 문제 | 2 | fix 박음 |

**404 fix 상세**:
- Cepeda et al. 2006 — ISSN 오타 `0033-295X` → `0033-2909` 정정 (Psychological Bulletin)
- Hallam 1997 — DOI URL 404 → URL 제거, 인용 정보 유지

### 자주 박는 학술 인용 (검증된 영역)
- Bugos et al. 2007 (Aging & Mental Health) — 피아노 훈련·인지 기능
- Wan & Schlaug 2010 (The Neuroscientist) — 악기 훈련·신경가소성
- Goolsby 1994 (Music Perception) — 초견 안구 추적
- Rayner 1998 (Psychological Bulletin) — 읽기·안구 운동 리뷰
- Ericsson, Krampe & Tesch-Römer 1993 (Psychological Review) — 의도적 연습 원전
- Cepeda et al. 2006 (Psychological Bulletin `10.1037/0033-2909.132.3.354`) — 분산 연습
- Levitin 2006 (Your Brain on Music) — 음악 인지 일반서

---

## 진행 영역

- [ ] **PRACTICAL_GUIDE Pexels 보강** — 그라데이션 유지 or 실사 이미지 재도입 결정 (출시 후)
- [ ] **본문 인용 굵게 박는 패턴** — 신규 글 작성 시 default `**인용**` 스타일
- [ ] **DOI 자동 검증 스크립트** — CrossRef API 박음 (신규 글 PR 시 CI 통과 조건)
- [ ] **블로그 본문-인용 정합성 수동 검증** — 1편씩 읽으면서 내용-출처 일치 확인
- [ ] **신규 글 작성 재개** — 5/15 D+A sprint 정합 완료, 이제 추가 가능

---

## 작업 이력

| 날짜 | 작업 | 커밋 |
|---|---|---|
| 2026-05-15 | D+A 감사 보고서 | `b12c0fb` |
| 2026-05-15 | cover frontmatter 누락 영역 박음 | `b06fff3` |
| 2026-05-15 | PRACTICAL_GUIDE 이미지 1개 축소 | `8feb072` |
| 2026-05-15 | HISTORY_THEORY 후크 이미지 제거 | `f9f1f84` |
| 2026-05-15 | IMAGE_POLICY.md 박음 | `bfc27ad` |
| 2026-05-15 | PRACTICAL_GUIDE 출처 섹션 정리 | `a9a8c43` |
| 2026-05-15 | HISTORY_THEORY 출처 섹션 정리 | `0b3ce5e` |
| 2026-05-15 | cover image 렌더링 추가 | `bf3442f` |
| 2026-05-16 | 카테고리별 그라데이션 교체 | `a8f12bb` |
| 2026-05-16 | cover 크기 축소 (w-16 h-16) | `b33280d` |
| 2026-05-16 | §1-13 초견과 작곡·즉흥 | `83649e6` |
| 2026-05-16 | §7-80 일·주·월 진단 | `c3a4459` |
| 2026-05-16 | §3-42 단계별 난이도 | `ab76d0a` |
| 2026-05-16 | §4-50 즉각 음표 인식 (이미지 1개) | `e7faded` |
| 2026-05-16 | §1-3 학습 정체 5가지 패턴 | `e05da5d` |
| 2026-05-16 | §3-36 같은 악보 vs 새 악보 | `a1ee536` |
