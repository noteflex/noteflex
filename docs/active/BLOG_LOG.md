# 블로그 작업 로그

> ⚠️ **DEPRECATED (2026-05-19)**: 이 파일은 더 이상 갱신하지 않는다. 블로그 메타데이터·정책·이미지 출처·DOI 검증 결과는 `docs/marketing/blog_topics_100.md` §7.8 (BLOG_LOG.md 통합)로 이전 관리한다. 이 파일은 2026-05-18 이전 이력 보존용으로만 유지한다.
>
> **이전 운영 원칙**: 블로그 관련 정책 결정·글 수 변동·이미지 정책·DOI 검증 결과를 이 파일에 누적.
> Claude Code가 블로그 작업 완료 시 자동 갱신.

---

## 정책 결정

### 새 글 prerender 워크플로 (2026-06-16 도입)
- **방식**: 로컬 puppeteer 본문 SSG 산출 → `prerendered/blog/{lang}/{slug}.html` 레포 커밋 → Vercel 빌드는 `cp -R prerendered/blog/. dist/blog/` 만 수행.
- **사유**: Vercel 빌드 컨테이너에서 puppeteer 번들 / @sparticuz/chromium 모두 libnss3.so 부재로 launch 불가. 로컬에서 산출하고 결과만 커밋하는 게 가장 단순·안정.
- **흐름**:
  1. `.md` 작성/수정 (ko + en)
  2. `npm run build` (vite 산출, ~15초)
  3. `npm run prerender:blog` (puppeteer 로컬 실행, ~5분, prerendered/blog 갱신)
  4. `git add prerendered/blog/{lang}/{slug}.html` + 작성한 `.md` + sitemap + BLOG_LOG
  5. 커밋·push → Vercel 자동 재빌드(15초, puppeteer 호출 0)
- **검증 체크**: 새 글의 `dist/blog/{lang}/{slug}.html` 가 #root 안에 본문 텍스트 포함 + `og:title`·canonical·hreflang 주입 + `adsbygoogle.push`/`Sentry.init`/`gtag('config')` 호출 0.
- **누락 방지(예정)**: prebuild hook 에서 `src/content/blog/*` 와 `prerendered/blog/*` mtime 비교해 stale 경고(PENDING).

### 글 상세 hero 영역 제거 (2026-05-16)
- **결정**: BlogPost.tsx의 CategoryCover variant='hero' 제거
- **이유**: 카테고리는 글 제목 위 라벨에 이미 적용됨 → hero 중복·빈 공간
- **현재 정책**: 카테고리 cover = **블로그 목록 카드에만** 완료 (w-16 h-16 아이콘 박스)
- `CategoryCover` variant='hero' 코드: 보존 (향후 재활용 가능)

### 커버 이미지 정책 (2026-05-16 확정 — 옵션 C)
- **결정**: 카테고리별 그라데이션 + 아이콘 박스 (실제 이미지 X)
- **이유**: PRACTICAL_GUIDE 글에 무관한 클래식 음악 이미지 적용됨 문제 → 통일성 우선
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
  - 예전에 적용되어 있던 이미지 출처 섹션 = 제거 완료 (5/15)
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
- DOI URL 반드시 `curl -I` 200 또는 403(봇차단) 검증 후 완료
- 404 → DOI URL 제거, 인용 정보(저자·연도·제목·저널) 유지
- 블로그 작성 7가지 구조: Hook → Promise → Scene → Insight+Evidence → Three Acts → Specificity → Callback

---

## 누적 글 수

| 날짜 | KO | EN | 합계 | 비고 |
|---|---|---|---|---|
| 2026-05-15 | 40 | 40 | 80 | D+A 감사 + cover image 정책 완료 |
| 2026-05-16 | 40 | 40 | 80 | cover 그라데이션 교체 (글 수 변동 X) |
| 2026-05-16 | 46 | 46 | 92 | 신규 6편 추가 (§1-13·§7-80·§3-42·§4-50·§1-3·§3-36) |
| 2026-05-22 | 64 | 64 | 128 | §5-63 시니어 초견 (ko+en) 추가 |
| 2026-05-24 | 65 | 65 | 130 | §6-70 관악기 초견 (ko+en) 추가, 이미지: Wikimedia+LoC |
| 2026-05-25 | 66 | 66 | 132 | §3-R1 리듬 초견 전략 (ko+en) 추가 |
| 2026-06-13 | 81 | 81 | 162 | §2-? 음정(intervals) 정의·도수·질 (ko+en) 추가. 검수 0 정책(2026-06-13) 적용 — 학술 인용 없음, 토픽 화이트리스트 부합. |
| 2026-06-14 | 82 | 82 | 164 | 빠르기말(tempo markings) Allegro·Andante·Adagio 의미와 BPM 범위 (ko+en) 추가. 검수 0 정책 — 학술 인용 없음, 화이트리스트(기호·악상) 부합. |
| 2026-06-16 | 83 | 83 | 166 | 장음계와 단음계(major and minor scales) — W-W-H-W-W-W-H 패턴·자연/화성/가락단음계·평행조/나란한조 (ko+en) 추가. 화이트리스트(음계) 부합, 학술 인용 없음. |
| 2026-06-17 | 84 | 84 | 168 | 이음줄과 붙임줄(slur vs tie) — 같은 곡선 모양·다른 지시(표현 vs 길이), 음높이로 한 번에 구분 (ko+en) 추가. 화이트리스트(기호 정의·규칙) 부합, 학술 인용 없음. 이미지 출처 IMSLP 크레딧으로 회전(Wikimedia 3편 연속 후). |
| 2026-06-18 | 85 | 85 | 170 | 반복 기호(repeat signs) — Da Capo·Dal Segno·Coda·Fine + 도돌이표·1·2번 괄호 일곱 가지 정의·결합 규칙(D.C./D.S. al Fine/Coda 4종) (ko+en) 추가. 화이트리스트(기호 정의·규칙) 부합, 학술 인용 없음. 이미지 출처 BnF Gallica + Wikimedia(diagram) 혼합 회전(IMSLP에서 전환). |
| 2026-06-20 | 86 | 86 | 172 | 셈여림(dynamics) — pp부터 fff까지 일곱 표준 단계 + 크레셴도·디크레셴도 헤어핀(<·>) + 순간 강세(sf·sfz·fp·rf)·차이코프스키 6번 pppppp 사례까지 음량 표기 전체 (ko+en) 추가. 화이트리스트(기호 정의·규칙) 부합, 학술 인용 없음. 이미지 출처 Wikimedia Commons 2종(Beethoven Sym.5 1807 자필 + jobu0101 다이내믹 차트). BlogPostCTA 마커("## 이미지 출처"/"## Image Sources") 정확 일치, prerendered ko·en 2편 생성·#root 본문·핵심 키워드 확인. |

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
| 404 진짜 문제 | 2 | fix 완료 |

**404 fix 상세**:
- Cepeda et al. 2006 — ISSN 오타 `0033-295X` → `0033-2909` 정정 (Psychological Bulletin)
- Hallam 1997 — DOI URL 404 → URL 제거, 인용 정보 유지

### 자주 기록하는 학술 인용 (검증된 영역)
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
- [ ] **본문 인용 굵게 기록하는 패턴** — 신규 글 작성 시 default `**인용**` 스타일
- [ ] **DOI 자동 검증 스크립트** — CrossRef API 완료 (신규 글 PR 시 CI 통과 조건)
- [ ] **블로그 본문-인용 정합성 수동 검증** — 1편씩 읽으면서 내용-출처 일치 확인
- [ ] **신규 글 작성 재개** — 5/15 D+A sprint 정합 완료, 이제 추가 가능

---

## 작업 이력

| 날짜 | 작업 | 커밋 |
|---|---|---|
| 2026-05-15 | D+A 감사 보고서 | `b12c0fb` |
| 2026-05-15 | cover frontmatter 누락 영역 완료 | `b06fff3` |
| 2026-05-15 | PRACTICAL_GUIDE 이미지 1개 축소 | `8feb072` |
| 2026-05-15 | HISTORY_THEORY 후크 이미지 제거 | `f9f1f84` |
| 2026-05-15 | IMAGE_POLICY.md 완료 | `bfc27ad` |
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
| 2026-05-16 | §M-1 조옮김 메커니즘 + 단계별 훈련 (ko+en) | `ab3eb00` |
| 2026-05-16 | §M-2 초견 슬럼프와 메타인지 (ko+en) | `ab3eb00` |
| 2026-05-16 | §M-3 오케스트라 첫 리허설 워크플로우 (ko+en) | `ab3eb00` |
| 2026-05-17 | §M-4 코드 진행을 화성으로 읽기 (ko+en) | `cf045cc` |
| 2026-05-17 | §M-5 작업 기억 4마디 한계 (ko+en) | `cf045cc` |
| 2026-05-17 | §M-6 현악 4중주 시청각 동기화 (ko+en) | `cf045cc` |
| 2026-05-18 | §M-7 정확도 vs 속도 vs 일관성 (ko+en) | (펜딩) |
| 2026-05-18 | §M-8 Suzuki vs 전통 교수법 비교 (ko+en) | (펜딩) |
| 2026-05-18 | §M-9 공연 24시간 전 워크플로우 (ko+en) | (펜딩) |
| 2026-05-24 | §6-70 관악기 초견 (ko+en) | (펜딩) |
| 2026-05-25 | §3-R1 리듬 초견 전략 (ko+en) | (펜딩) |
| 2026-06-13 | 음정 — 도수·질, 완전/장/단/증/감 (ko+en, slug `music-intervals-explained`). 이미지: Wikimedia Commons (BWV1001 + Mozart Piano Concerto No.23 자필). curl HTTP 200 PASS. 학술 인용 없음(2026-06-13 검수 0 정책). | (펜딩) |
| 2026-06-14 | 빠르기말 — Allegro·Andante·Adagio 의미와 BPM 범위 (ko+en, slug `tempo-markings-explained`). 이미지: Wikimedia Commons (Mozart Prague Symphony K.504 자필 + Chopin Polonaise Op.53). curl HTTP 200 PASS. 학술 인용 없음(검수 0 정책). | (펜딩) |
| 2026-06-16 | 장음계와 단음계 — W-W-H-W-W-W-H 패턴·세 단음계 형태·평행조/나란한조 (ko+en, slug `major-and-minor-scales`). 이미지: Wikimedia Commons (BnF 원본 Bach Goldberg Aria 1741 + Chopin Prelude Op.28 No.7). curl HTTP 200 PASS. 학술 인용 없음(검수 0 정책). | (펜딩) |
| 2026-06-16 | prerender 방식 전환 — Vercel 빌드에서 puppeteer/@sparticuz chromium 모두 libnss3.so 부재로 launch 실패 → 로컬 생성·git 커밋 방식으로 전환. 산출 디렉토리 `prerendered/blog/{lang}/{slug}.html`(git 추적). Vercel 빌드는 `cp -R prerendered/blog/. dist/blog/`로 서빙만, 브라우저 launch 0. 새 흐름: 글 작성·수정 → `npm run build && npm run prerender:blog`(로컬, ~5분) → `git add prerendered/blog` → 커밋·push. | (펜딩) |
| 2026-06-17 | 이음줄과 붙임줄 — 같은 곡선 모양·반대 지시(이음줄=표현·한 호흡/한 활/레가토, 붙임줄=길이 합산·마디선 넘김), 음높이로 한 번에 구분 (ko+en, slug `slur-vs-tie`). 이미지: IMSLP 크레딧 2점 (Anna Magdalena Bach 필사본 첼로 모음곡 1번 BWV 1007 + Klindworth-Scharwenka 편집 Chopin 야상곡 Op.9 No.2). curl HTTP 200 PASS. 출처 회전(Wikimedia 3편 연속 후 IMSLP). prerender ko·en 2편 생성, 키워드 grep 통과(이음줄 32·붙임줄 33 / Slur 16·Tie 10). 학술 인용 없음(검수 0 정책). 화이트리스트(기호 정의·규칙) 부합. | (펜딩) |
| 2026-06-18 | 반복 기호 — Da Capo·Dal Segno·Coda·Fine + 도돌이표·1·2번 괄호 일곱 가지, 결합 규칙 4종(D.C./D.S. al Fine/Coda), 페이지 끝 표지 읽는 3단계 (ko+en, slug `repeat-signs-explained`). 이미지: BnF Gallica 자필 베토벤 미뉴엣 Hess 88/33 + Wikimedia diagram (D.C. al Fine 표기 예시). curl HTTP 200 PASS. 출처 회전(IMSLP → BnF + Wikimedia 혼합). prerender ko·en 2편 생성, 키워드 grep 통과(반복 13·도돌이 14·Coda 22·Fine 39·세뇨 12·미뉴엣 11 / Repeat 10·Da Capo 10·Dal Segno 10·Coda 22·Fine 34·Beethoven 8·minuet 13). 학술 인용 없음(검수 0 정책). 화이트리스트(기호 정의·규칙) 부합. | (펜딩) |

## 2026-05-16~18 신규 9편 사용 이미지·인용 목록

| 슬러그 | 이미지 (Wikimedia) | 학술 인용 |
|---|---|---|
| transposition-explained | Bach Well-Tempered Clavier fugue (DwtkII-as-dur-fuga.jpg) | Wolf (1976) — *Journal of Psycholinguistic Research* — DOI 10.1007/BF01067255 |
| sight-reading-metacognition | Teaching rhythm in music education | Schraw & Dennison (1994) — DOI 10.1006/ceps.1994.1033 |
| orchestra-sight-reading | Small environment of studying Score KV265 | Wolf (1976) — DOI 10.1007/BF01067255 |
| chord-progression-reading | Sheet music | Sloboda (1985) — *The Musical Mind* — DOI 10.1093/acprof:oso/9780198521280.001.0001 |
| working-memory-music-reading | Reading Fixations Saccades | Furneaux & Land (1999) — DOI 10.1098/rspb.1999.0943 |
| string-ensemble-sight-reading | Bach Lute Suite (Bachlut1.png) | Buccino et al. (2001) — DOI 10.1111/j.1460-9568.2001.01385.x |
| sight-reading-metrics | Piano practice | Lehmann & Ericsson (1996) — DOI 10.1037/h0094082 |
| suzuki-vs-traditional-reading | Music class USA | McPherson & Gabrielsson (2002) — DOI 10.1093/acprof:oso/9780195138108.003.0007 |
| pre-performance-24hours | Beethoven Op.90 manuscript | Stickgold & Walker (2007) — DOI 10.1016/j.sleep.2007.03.011 |
