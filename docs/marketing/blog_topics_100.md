# Noteflex 블로그 주제 100선 + 작성 운영 가이드

> **타겟**: 악보를 읽는 모든 사람 (피아노 학습자·취미·재즈·가수·작곡가·음악 교사·교회 반주자·합창 단원 등)
> **핵심 키워드**: 초견(Sight-reading), 악보 읽기(Music reading), 음정 인식(Pitch recognition), 음표 학습(Note learning)
> **연계 전략**: 일반 정보 → 학습 방법 → Noteflex 기능 자연 연결
> **분량 권장**: 1편당 1500~2000자
> **갱신**: 작성 완료 글은 § 6에 누적 기록

---

## 0. 작성 사양 (사용자 결정, 2026-04-29)

### 0.1 작성 페이스

- **평일 (월~금)**: 하루 2편
- **주말 (토·일)**: 하루 3편
- **주간 누적**: 평일 10편 + 주말 6편 = **주 16편**
- **N일차 누적 30편 이상**: AdSense 심사 신청 가능 (사용자 진도에 따라 결정)

### 0.2 분량 + 구조

- **분량**: 1500~2000자 (한국어 기준)
- **구조**:
  - 서론·본론·결론을 글 안에 명시 ❌ (예: "서론:", "결론:" 같은 표현 금지)
  - 자연스러운 흐름으로 독자가 이해할 수 있도록 작성
  - 소제목 3~5개로 분할 (Markdown `##`)
  - 마지막 1~2단락에서 Noteflex 자연 연계 (광고 톤 X, "이 문제를 우리는 이렇게 해결한다" 톤)

### 0.3 화법 (절대 원칙)

- ❌ **AI식 과장된 표현 금지**:
  - "획기적인", "혁신적인", "놀라운", "압도적인"
  - "완벽하게", "절대적으로", "100% 보장"
  - "지금 당장 시작하세요!"
  - "이 글을 끝까지 읽으면..."
  - 느낌표 남발
  - 이모지 남발 금지 (헤더·강조 외 본문 문장 안 자제)
- ✅ **정확하고 객관적이고 확인된 정보 기반**:
  - 추측·과장 X
  - 출처 있는 사실 위주
  - "할 수 있다", "도움이 된다" 같은 단정 X — "할 수 있는 가능성이 있다", "도움이 된다는 연구 결과가 있다" 식
  - 자연스러운 문장 흐름
  - 친근하지만 정중한 톤

### 0.3-1 이모지 활용 (2026-05-01 사용자 결정)

**원칙**: 글의 학문적·정보성·논리적 톤 유지. 이모지로 가벼워지면 안 됨. 다만 딱딱함 완화를 위해 적절히 활용.

**활용 위치**:
- 섹션 헤더 옆 (예: `## 음자리표의 역사 🎼`)
- 핵심 포인트 강조 (예: `💡 핵심: ...`)
- 단계·순서 안내 (예: `1️⃣ 첫 단계`, `✅ 완료 조건`)

**빈도**: 글당 5~10개 적당. 과도하면 가벼워짐.

**금지**:
- 본문 문장 안 이모지 (헤더·강조 블록 외)
- 학술 자료 인용·참고 자료 섹션 (학술 톤 유지)
- 제목(title frontmatter) 안 이모지

### 0.4 SEO 키워드

각 글마다:
- **핵심 키워드 1개** (제목·첫 단락·소제목에 자연 포함)
- **보조 키워드 3~5개** (본문 중 자연 분포)
- 부자연스러운 키워드 반복 X
- frontmatter `keywords` 필드에 명시

### 0.5 광고 통과율 우선순위

AdSense 심사 통과율을 높이기 위해:
- 정보성 글 비중 ≥ 80%
- Noteflex 직접 언급 글은 균등 분포 (매주 1~2편 정도, 광고성으로 보이지 않게)
- 글 안에서 Noteflex 언급은 본문 80% 이후 1~2단락에 한정
- 외부 링크 포함 (위키피디아, 음악 학회, 공식 자료 등 신뢰성 높은 출처)

### 0.6 Noteflex 기능 자연 연계 위치

각 글에서 Noteflex를 언급할 때:
- 본문 끝부분 1~2단락에 위치
- "이런 학습 방법이 효과적이다" → "Noteflex는 이 방식을 적용했다" 흐름
- "더 알아보기" 같은 직접 CTA 대신 자연 언급
- 매 글마다 다른 기능 연계 (반복 회피)

### 0.7 학술 자료 활용 (2026-04-30 신규 — 2026-05-04 강화)

**필수 원칙**: 가짜 인용 절대 금지. 실제 검색 가능한 자료만 인용.

**인용 규칙 (2026-05-04부터 강화)**:
- **글당 논문·학회 자료 반드시 1개 이상** (기존: 권장 → 신규: 필수)
- 출처: Google Scholar, JSTOR, PubMed, 한국음악교육학회지 등 검증된 학술지
- 본문에서 인용 시: "(저자, 연도)" 형식 자연 삽입
- 글 하단 '참고 자료' 섹션에 전체 출처 명시 (APA 스타일)

**검증 가능한 자료만 사용**:
- Claude Code에 작업 시: "Google Scholar에서 검색 가능한 실제 자료만 인용. 검증 불가 시 인용 생략."
- Claude가 가짜 출처(hallucination) 만들면 사이트 신뢰도 ↓ + AdSense 위험
- 사용자 push 전 검증: 적어도 1편당 1개 출처 실제 존재 확인

**음악 교육·인지 분야 권위 있는 연구자 (참고용)**:
- Daniel Levitin — *This Is Your Brain on Music*
- Henkjan Honing — 음악 인지
- Gary McPherson — 음악 학습 발달
- Aaron Williamon — 연주자 인지
- Lehmann & McArthur — 초견 인지 모델

**참고 자료 섹션 형식**:
```markdown
## 참고 자료

1. Lehmann, A. C., & McArthur, V. (2002). Sight-reading. In R. Parncutt & G. E. McPherson (Eds.), *The Science and Psychology of Music Performance* (pp. 135-150). Oxford University Press.

2. Levitin, D. J. (2006). *This Is Your Brain on Music: The Science of a Human Obsession*. Dutton.

3. 한국음악교육학회. (2023). 초견 능력 향상을 위한 단계별 학습 모델. *음악교육연구*, 52(3), 45-67.
```

### 0.8 이미지 활용 (2026-04-30 신규 — 2026-05-04 강화)

**필수 원칙**: 출처 명확한 이미지만 사용. AI 생성 이미지 금지.

**사용 가능한 이미지 소스**:

1. **Wikimedia Commons** (https://commons.wikimedia.org)
   - public domain 또는 CC-BY/CC-BY-SA 라이선스
   - 음악사 인물·악보·악기·도해
   - 상업적 사용 가능, 출처 표기 의무

2. **IMSLP** (https://imslp.org) — 악보 전문
   - public domain 클래식 악보 (저작권 만료)
   - 음악 교육 사이트 신뢰도 ↑↑
   - "Beethoven Piano Sonata 첫 마디 초견 분석" 같은 글에 직접 활용

3. **Unsplash·Pexels** (https://unsplash.com, https://pexels.com)
   - 무료 사진 (피아노 건반, 악보 페이지 등)
   - 분위기 사진 적합, 학술적 정확성 X
   - 라이선스: 상업적 사용 OK, 출처 표기 권장

4. **자체 제작 이미지** (가장 안전)
   - Noteflex 게임 화면 스크린샷
   - 자체 작성 데이터 차트 (Recharts, matplotlib)
   - VexFlow 등으로 생성한 악보 (저작권 100% 안전)

**사용 금지**:
- AI 생성 이미지 (Stable Diffusion·DALL-E·Midjourney 등) — Google이 표시 의무화 추세, 음악 교육 권위성 ↓
- 라이선스 불명 이미지
- 저작권 보호된 이미지 (구글 검색 → 마음대로 사용 X)

**이미지 출처 표기 (블로그 글 안)**:

```markdown
![음자리표 도해](path/to/image.svg)
*그림 1: 음자리표 종류. 출처: Wikimedia Commons / Public Domain*
```

또는 글 하단 '참고 자료' 섹션에 통합:

```markdown
## 참고 자료

### 이미지 출처
- 그림 1: Wikimedia Commons / Public Domain
- 그림 2: IMSLP / Ludwig van Beethoven, Piano Sonata No. 14, op. 27 no. 2 (Public Domain)
- 그림 3: Noteflex 자체 제작
```

**SEO 최적화**:
- 파일명에 키워드 포함: `sight-reading-practice.jpg`, `treble-clef-notation.svg`
- alt 태그 명시: `![treble clef notation diagram](image.svg)`
- 이미지 크기·압축 (페이지 로딩 속도)

**글당 필수 이미지 수 (2026-05-04부터 강화)**: 최소 2개 이상 (기존: 권장 → 신규: 필수)
- 이미지 1: 글 시작 부분 (독자 시선 유도)
- 이미지 2+: 본문 안 1개 이상 (내용 보조·E-E-A-T 강화)
- 5/3까지 작성된 6편은 기존 정책 유지 (출시 후 보강 X)

**⚠️ 이미지 검증 절차 (2026-05-01 엄격화 — 504 오류 사고 후 추가)**:

Claude Code가 이미지 URL을 글에 삽입하기 전 반드시:
1. `curl -I "{URL}"` 실행
2. `HTTP/2 200` 응답 확인
3. 200 아닐 경우 다른 URL 재선정 후 재검증
4. 검증 결과 보고서 형식으로 사용자에게 보고 (URL / 응답코드 / OK 여부)
5. 200 확인된 URL만 글에 삽입

**절대 금지**: 검증 없이 Wikimedia URL fabricate — 사이트 신뢰도 ↓, AdSense 위험

### 0.9 카테고리 — STYLE_MAP 기준 전체 카테고리 (2026-05-19 갱신)

> **갱신 사유 (2026-05-19)**: 기존 §0.9의 4개 클러스터 외에 `src/lib/categoryStyle.ts` `STYLE_MAP`에 직군별·악기별·학습 데이터·과학 카테고리가 추가되어 실제 운영 카테고리가 더 다양해졌다. 2026-05-18 직전 18편의 카테고리 매핑 오류(미등록 카테고리 사용 → 기본 🎼 아이콘만 노출)를 정정하면서, 이 절을 단일 기준점으로 삼는다.

#### 0.9-A 사용 가능한 카테고리 목록 (절대 기준)

**한국어 카테고리 (8종)**:
- 음악 이론 & 화성학
- 초견의 정석
- 실전 연습 가이드
- 직군별 학습 전략
- 학습 데이터·과학
- 뮤직 테크 & 미래
- 악기별 가이드
- 악기별 초견 전략

**영어 카테고리 (9종)**:
- Theory & Harmony
- Sight-Reading Lab
- Practice Hub
- Learning Strategies by Role
- Sight-Reading by Role
- Learning Science
- Music Tech
- Instrument Guides
- Sight-Reading by Instrument

#### 0.9-B 작성 규칙

- **위 카테고리 외의 새 카테고리 생성 금지.** 신규 카테고리가 필요하면 `src/lib/categoryStyle.ts`의 `STYLE_MAP`에 먼저 등록한 뒤 이 절 목록에 추가하고, 그 후에 글 작성.
- 신규 글 작성 시 반드시 위 목록 중 하나의 카테고리만 사용.
- 한국어 글은 한국어 카테고리, 영어 글은 영어 카테고리를 사용 (혼용 금지).
- 한국어·영어 같은 글이면 매칭되는 카테고리 쌍을 사용 (예: 음악 이론 & 화성학 ↔ Theory & Harmony).

#### 0.9-C 카테고리별 운영 의도

| 한국어 | 영어 | 핵심 가치 |
|---|---|---|
| 음악 이론 & 화성학 | Theory & Harmony | 악보 읽기 기초·조표·임시표·화성 지식 |
| 초견의 정석 | Sight-Reading Lab | 초견 정의·인지 심리·음표 매칭 분석 |
| 실전 연습 가이드 | Practice Hub | 학습 루틴·단계별 훈련·일반 연습 |
| 직군별 학습 전략 | Learning Strategies by Role | 교사·반주자·합창·재즈·취미·시니어 등 |
| (해당 없음) | Sight-Reading by Role | 직군별 초견 특화 (영어 전용 보조 카테고리) |
| 학습 데이터·과학 | Learning Science | 신경과학·인지·학습 측정·메타인지 |
| 뮤직 테크 & 미래 | Music Tech | AI·정밀 데이터·앱 기반 학습·미래 |
| 악기별 가이드 | Instrument Guides | 악기별 일반 가이드 |
| 악기별 초견 전략 | Sight-Reading by Instrument | 악기·앙상블별 초견 특화 |

---

### 0.10 다국어 운영 (2026-04-30 신규 — 글로벌 출시 전략)

**사용자 결정 (2026-04-30)**: Noteflex는 처음부터 글로벌 서비스. 한국 타겟 X.

**5/31 출시 시 = 한국어 + 영어 (2개 언어)**:
- 일본어·중국어는 출시 후 1~2주 안에 추가 (점진 확장)
- 5/1부터 블로그는 한+영 동시 작성

**작성 방식**:

매일 한국어 + 영어 두 언어 작성. 1일차 분량 (평일 2편, 주말 3편)이 각 언어별로 적용:
- 평일: 한 2편 + 영 2편 = 총 4편
- 주말: 한 3편 + 영 3편 = 총 6편

작성 시간: 한 글당 5분 → 평일 약 20분, 주말 약 30분.

**4/30 작성 글 처리** (이미 한국어 only로 push 완료):
- src/content/blog/2026-04-30-sight-reading-basics.md (한국어)
- src/content/blog/2026-04-30-musical-staff-principle.md (한국어)
- 5/1 작업 시 영어 버전 2편 추가 작성 (총 6편 = 4/30 영어 2 + 5/1 한국어 2 + 5/1 영어 2)

**파일 구조**:

```
src/
  content/
    blog/
      ko/
        2026-04-30-sight-reading-basics.md
        2026-04-30-musical-staff-principle.md
        2026-05-01-...md
      en/
        2026-04-30-sight-reading-basics.md  ← 5/1에 추가
        2026-04-30-musical-staff-principle.md  ← 5/1에 추가
        2026-05-01-...md
```

**URL 구조**:
- 한국어: `noteflex.app/ko/blog/sight-reading-basics`
- 영어: `noteflex.app/en/blog/sight-reading-basics`

**slug 규칙**:
- 한+영 같은 글은 같은 slug 사용 (예: `sight-reading-basics`)
- frontmatter `slug` 필드 동일

**번역 품질**:
- Sonnet 자동 번역 (영어 거의 native 수준)
- 사용자 빠른 검수 가능 시 수정
- 학술 자료·이미지 출처는 양쪽 동일 (검증된 자료라면 영어권에서도 권위 인정)

**카테고리 영문 표기**:
- "초견의 정석" / "Sight-Reading Lab"
- "실전 연습 가이드" / "Practice Hub"
- "음악 이론 & 화성학" / "Theory & Harmony"
- "뮤직 테크 & 미래" / "Music Tech"

frontmatter `category` 필드: 한국어 글 = 한국어 카테고리, 영어 글 = 영어 카테고리.

**일·중 추가 (출시 후)**:
- 출시 후 1~2주: 일본어 추가 (`src/content/blog/ja/`, `noteflex.app/ja/*`)
- 출시 후 2~4주: 중국어 추가 (`src/content/blog/zh/`)
- 사용자 피드백 보면서 점진 진행

---

### 0.11 이미지·인용 다양화 정책 (2026-05-12 신규)

**배경**: 12일차까지 모든 블로그 이미지가 Wikimedia Commons에서만 나옴. 단조로움 + SEO·AdSense E-E-A-T 신뢰도 영역에서 다양성 필요. §0.8(이미지 활용) §0.7(학술 자료)와 결합되는 보강 정책.

#### 이미지 출처 다양화

**원칙**: 매 글마다 1~2개 사이트만 사용. **3편 연속 동일 출처 금지**.

**우선순위 풀** (글 주제별 자연스러운 매칭):

| 풀 | 사이트 | 적합한 주제 |
|---|---|---|
| **박물관·미술관** | Wikimedia Commons · Metropolitan Museum (metmuseum.org Open Access) · BnF Gallica (gallica.bnf.fr) · NYPL Digital Collections · Smithsonian Open Access (si.edu) · British Library (bl.uk) | 음악사·작곡가 초상·악기 회화·역사 자료 |
| **음악·악보 전문** | IMSLP (imslp.org) · Mutopia Project · CPDL · OpenScore | 악보·악기 영역, 자필 원고, 클래식 분석 |
| **학술 도표** | PLOS · PMC · Frontiers · eLife · Scientific Reports | 학습·인지·교육·신경과학 연구 도표 |
| **역사 자료** | Library of Congress (loc.gov) · Internet Archive (archive.org) | 현대 음악·녹음·문서 자료 |

**주제별 자연 매칭**:
- 악보·악기 영역 → **IMSLP · Mutopia · Met · British Library**
- 음악사·작곡가 영역 → **Wikimedia · LoC · NYPL · BnF Gallica**
- 학습·인지·교육 영역 → **PLOS · PMC · Frontiers** (학술 도표)
- 종교 음악 영역 → **CPDL · BnF Gallica · Wikimedia** (자필 원고)
- 현대 음악·녹음 영역 → **Smithsonian · LoC · NYPL**

**한 글 안에서의 다양성**: 2개 이미지면 서로 다른 출처 권장 (예: 커버 = Wikimedia 회화, 본문 = IMSLP 자필 악보).

**완전 금지** (메모리 #13 그대로 유지): Pexels · Unsplash · Pixabay · 일반 스톡 포토.

#### 학술 인용 다양화

**원칙**: 매 글마다 다른 저자·저널·연구 분야. **3편 연속 동일 저자 금지**.

**저자 풀 예시** (음악 학습·인지·교육):

| 분야 | 저자 |
|---|---|
| **음악 학습 일반** | Ericsson · Cepeda · Karpinski · Lehmann & McArthur · Sloboda · Levitin · Huron · Hasty · Gjerdingen · Gordon · Suzuki · Feierabend · Bernstein · Copland · Rosen |
| **신경과학** | Schlaug · Münte · Patel · Zatorre · Bugos · Wan |
| **인지·학습** | Bjork · Roediger · Dunlosky · Rayner · Goolsby |
| **동기·실행** | Ryan & Deci · McPherson · Bonneville-Roussy |

**저널 풀**:
- *Journal of Research in Music Education*
- *Music Perception*
- *Psychology of Music*
- *Music Education Research*
- *Frontiers in Psychology*
- *PLOS ONE*
- *Cognitive Psychology*
- *Memory & Cognition*
- *Aging & Mental Health*
- *The Neuroscientist*
- *Proceedings of the National Academy of Sciences (PNAS)*

**규칙**:
- 글 주제에 가장 적합한 저자·저널 선택. 단, 직전 3편에서 사용했으면 다른 저자 우선.
- **DOI 필수** (검증 가능한 자료만).
- peer-reviewed 학술 자료 우선. 책·매거진은 보조.

#### history 추적

매 글 작성 시 직전 3편의 이미지·인용 history 확인:

```bash
# 직전 3편 .md frontmatter에서 coverImageSource 확인
grep -h "coverImageSource\|coverImageCredit" src/content/blog/ko/2026-05-*.md | tail -10

# 직전 3편 학술 인용 확인 (참고 문헌 섹션)
grep -A 5 "## 참고 자료\|## References" src/content/blog/ko/2026-05-*.md | tail -30
```

또는 session-log §의 "완료 내역" 섹션에서 기록된 출처·저자를 확인.

#### 블로그 sprint 통합 메시지 추가 줄

다음 sprint부터 매 블로그 작성 명령 통합 메시지에 다음 줄 추가:

> 직전 3편의 이미지 출처·학술 인용 저자를 확인하고, 이번 글에서는 다른 출처·저자를 사용. 다양화 정책(§0.11)을 따름.

#### 12일차까지 편중 영역 회고

- **Wikimedia 편중**: 12일차까지 작성된 58편 중 이미지 출처는 대부분 Wikimedia Commons. 다른 인증 사이트(Met·BnF·IMSLP·PLOS) 활용 거의 없음.
- **정정 방향**: 13일차 이후 글부터 위 정책 적용. 12일차 이전 글 소급 적용 X (출시 후 검토 별도).

---

## 1. 작성 우선순위 (광고 통과율 + 다양성 균형)

### 1.1 작성 순서 (실제 날짜·요일 기반 — 2026-05-03 갱신)

> **갱신 배경 (2026-05-03)**: 기존 N일차 표는 평일·주말 구분이 모호해 5/2 토요일 3편째 처리 시 차용 결정이 즉석에서 필요했음. §0.1 정책("평일 2편 / 주말 3편")과 명시적으로 정합되도록 1단계(첫 주)는 실제 날짜·요일 기반으로 재배치. 8일차 이후 2~4단계는 일단 N일차 표 유지(추후 동일 방식으로 시간 두고 재배치 예정).
>
> **운영 원칙**:
> - 평일(월~금) 2편 / 주말(토·일) 3편 (§0.1)
> - **한+영 동시 작성** (§0.10): 평일 한 2 + 영 2 = 4편 / 주말 한 3 + 영 3 = 6편
> - 평일에 비는 "3편째 자리"가 있을 때 다가오는 주말의 3편째 글을 **미리 차용** 가능. 차용한 자리는 그대로 비워두고 시프트 없음.
> - 못한 날은 다음 작업일에 그 날부터 이어감. 일정 압박 X.
> - 광고 심사 신청 목표: **누적 30편 이상** (한국어·영어 어느 쪽 기준이든).

**1단계: 정보성 위주 (4/30 목 ~ 5/6 수, 첫 주) — 누적 18편 (광고 통과율 최고)**

| 날짜 | 요일 | 평일/주말 | N일차 | 글 1 | 글 2 | 글 3 (주말) | 비고 |
|---|---|---|---|---|---|---|---|
| 4/30 | 목 | 평일 | 1 | §1-1 초견이란 무엇인가 | §2-16 오선지의 원리 | — | 한 only (영어는 5/1에 추가) |
| 5/1 | 금 | 평일 | 2 | §1-2 5가지 영향 | §2-17 음자리표 완벽 정리 | — | 한+영 + 4/30 영어 추가 |
| 5/2 | 토 | 주말 | 3 | §3-31 7가지 핵심 원칙 | §2-18 그랜드 오선지 | §8-86 Noteflex 문제 *(차용)* | 한+영, 3편째 6일차 자리 차용 |
| **5/3** | **일** | **주말** | **4** | **§1-9 "악보를 읽는다" 진짜 의미** | **§2-19 덧줄 읽기** | **§7-78 망각 곡선·N+2 *(차용)*** | **한+영, 3편째 7일차 자리 차용** |
| 5/4 | 월 | 평일 | 5 | §1-15 초견 측정 방법 | §2-20 임시표의 모든 것 | — | 한+영 |
| 5/5 | 화 | 평일 (어린이날) | 6 | §3-32 매일 5분 루틴 | §3-33 청크 단위 인식 | *(자리 5/2에 차용됨)* | 한+영, 어린이날이지만 평일 패턴 |
| 5/6 | 수 | 평일 | 7 | §2-21 조표 읽는 법 | §4-46 음표 인식 속도 | *(자리 5/3에 차용됨)* | 한+영 |

> 첫 주 누적 = 글 9개 × (한+영 평균 약 2개 언어) = 한 9 + 영 9 = **18편 누적**.

**2단계: 학습 방법론 + 직군 가이드 (8~14일차) — 누적 32편**

| 일차 | 1편 | 2편 | 3편 (주말만) |
|---|---|---|---|
| 8일차 | §3-34 시간 분배 | §2-22 박자표 | — |
| 9일차 | §3-35 자동화의 중요성 | §2-23 음표 길이 | — |
| **10일차 (5/9 토, 주말)** | **§3-37 초견 실수 패턴 분석 ✅** | **§2-24 쉼표 읽기 ✅** | **§8-87 21단계 시스템 ✅ (차용, 13일차)** |
| **11일차 (5/10 일, 주말)** | **§3-38 약점 음표 집중 학습 ✅** | **§5-56 피아노 학습자 가이드 ✅** | **§7-79 가중치 학습 ✅ (차용, 14일차)** |
| **12일차 (5/11 월)** | **§4-47 음정 인식의 신경과학 ✅** | **§5-58 교회 반주자 ✅** | **§3-43 게임처럼 만들기 ✅ (차용, 13일차)** |
| **13일차 (5/12 화)** | **§3-43 게임처럼 만들기 ✅ (12일차 차용)** | **§5-65 취미 연주자 ✅** | **§8-87 21단계 시스템 ✅ (10일차 차용)** |
| **14일차 (주말)** | **§4-48 빠른 음표 인식 ✅ (13일차 차용)** | **§1-7 어른의 초견 ✅ (13일차 차용)** | **§7-79 가중치 학습 ✅ (11일차 차용)** |

**3단계: 직군 + 악기별 + Noteflex 기능 (15~21일차) — 누적 48편**

| 일차 | 1편 | 2편 | 3편 (주말만) |
|---|---|---|---|
| 15일차 | §5-57 합창 단원 초견 | §6-66 피아노 vs 다른 악기 | — |
| 16일차 | §5-59 재즈 연주자 | §6-69 보컬 초견 | — |
| 17일차 | §3-44 학습 일지 | §6-67 바이올린 초견 | — |
| 18일차 | §3-45 듀오링고 방식 학습 | §7-76 데이터 분석의 가치 | — |
| 19일차 | §1-13 작곡·즉흥에 주는 효과 | §7-80 일·주·월 진단 | — |
| 20일차 (주말) | §3-42 단계별 난이도 | §4-50 즉각 인식 | §8-89 N+2 재출제 로직 |
| 21일차 (주말) | §1-3 학습 정체 5가지 패턴 | §3-36 같은 악보 vs 새 악보 | §1-12 초견의 3가지 핵심 요소 |

**4단계: 누적 30편 이상이면 AdSense 심사 신청 가능 — 추가 작성 (22일차~)**

22일차부터는 카테고리 5·6·7·8·9 위주로 균형 있게 작성. 사용자 진도에 따라 30~50편 더 누적 가능.

| 일차 | 1편 | 2편 | 3편 (주말만) |
|---|---|---|---|
| 22일차 | §5-60 작곡가의 초견 | §7-77 학습 곡선 | — |
| 23일차 | §6-68 기타 악보 vs 피아노 | §7-81 스트릭의 효과 | — |
| 24일차 | §5-61 음악 교사 지도법 | §7-82 게이미피케이션 | — |
| 25일차 | §5-62 어린이 학습 | §6-70 관악기 초견 | — |
| 26일차 | §5-63 시니어 학습 | §6-71 첼로·콘트라베이스 | — |
| 27일차 (주말) | §1-4 초견과 청음 | §1-5 초견 실력 4단계 | §8-88 같은 음표 연속 안 나옴 |
| 28일차 (주말) | §1-6 두뇌에 미치는 영향 | §1-8 일반 곡 연습과 차이 | §8-90 데이터 분석 |
| 29일차 | §1-10 타고남 vs 학습 | §3-39 메트로놈 활용 | — |
| 30일차 | §1-11 절대음감과 초견 | §3-40 시각 추적 | — |
| 31일차 | §1-14 합주에서 초견 | §3-41 정체기 극복 3대 적 | — |
| 32일차 | §4-49 반응속도와 정확도 | §6-72 이조 악기 | — |
| 33일차 | §4-51 시각 패턴 | §6-73 드럼 초견 | — |
| 34일차 (주말) | §4-52 덧줄 읽는 7가지 트릭 | §4-53 조표 변화 적응 | §8-91 듀오링고 방식 |
| 35일차 (주말) | §4-54 음역대별 인식 | §4-55 인지 부하 | §8-92 Lv5+ 스와이프 |
| 36일차 | §5-64 입시생 단기 전략 | §6-74 하프·마림바 | — |
| 37일차 | §6-75 편곡자·지휘자 | §7-83 정확도 vs 속도 | — |
| 38일차 | §7-84 마스터리 측정 | §7-85 학습 앱의 미래 | — |
| 39일차 | §2-25 셈여림 기호 | §2-26 이음줄·붙임줄 | — |
| 40일차 | §2-27 페달 기호 | §2-28 옥타브 기호 | — |
| 41일차 (주말) | §2-29 셋잇단음표·여린박자 | §2-30 악센트·스타카토 | §8-93 0.0001초 정밀도 |
| 42일차 (주말) | §9-96 매일 5분의 약속 | §9-97 정체기 극복 | §8-94 21단계 설계 |
| 43일차 | §9-98 자기효능감 | §9-99 디지털 음악 학습 | — |
| 44일차 | §9-100 슬로건의 의미 | §8-95 출시 후 로드맵 | — |

총 100편 = 약 44일차 분량.

### 1.2 분포 검증 (총 100편 기준)

| 카테고리 | 편수 | 비중 |
|---|---|---|
| 1. 초견 기초·이론 | 15 | 15% |
| 2. 악보 읽기 기초 | 15 | 15% |
| 3. 학습 방법론 | 15 | 15% |
| 4. 음표 인식·반응속도 | 10 | 10% |
| 5. 직군별 가이드 | 10 | 10% |
| 6. 악기별 초견 | 10 | 10% |
| 7. 학습 데이터·과학 | 10 | 10% |
| 8. Noteflex 기능 연계 | 10 | 10% |
| 9. 동기·심리·라이프스타일 | 5 | 5% |

→ 정보성 88% / Noteflex 직접 10% / 브랜딩 2% — AdSense 심사 안전 비율

### 1.3 누적 일정 가이드

- 1~5일차 (정보성 집중): 누적 10편
- 6~7일차 (주말 6편): 누적 16편 — 1단계 완료
- 8~12일차: 누적 26편
- 13~14일차 (주말 6편): 누적 32편 — 2단계 완료
- 15~19일차: 누적 42편
- 20~21일차 (주말 6편): 누적 48편 — 3단계 완료
- 22~30일차: 누적 60~70편 (AdSense 심사 신청 시점은 사용자 결정)

→ 1단계(7일차)에 16편이라 일찍 시작이라 일찍 누적 가능.

### 1.4 글쓰기 방법론 — 음악 분야 거장 학습 (2026-05-08 신규)

음악 교육·비평·인지 분야 거장들의 방식을 학습해 블로그 글 품질에 적용한다.

**A. 음악 전문 기자**
- Alex Ross (*The New Yorker*, *The Rest Is Noise*) — 클래식 음악 비평: 문학적 깊이 + 일반 독자 접근성
- Anthony Tommasini (NYT 클래식 비평가) — 정확한 음악 용어 + 친근한 설명
- Ben Ratliff (NYT 재즈·팝 비평가) — 듣기 경험 묘사
- Will Crutchfield (오페라·성악 비평) — 역사·기법 깊이
- Jeremy Eichler (Boston Globe) — 음악과 역사·문학 연결

**B. 음대 교수**
- Robert Levin (Harvard) — 학술 + 실연 통합
- Christopher Hasty (Harvard, 리듬 이론) — 박자·리듬 인지
- David Huron (Ohio State, *Sweet Anticipation*) — 음악 인지·기대
- Daniel Levitin (McGill, *This Is Your Brain on Music*) — 신경과학 + 음악
- Robert Gjerdingen (Northwestern) — 역사적 양식 패턴
- Steven Laitz (Juilliard) — 화성·시창청음

**C. 음악 교육 현직자**
- Edwin Gordon (Music Learning Theory)
- Shinichi Suzuki (스즈키 메소드)
- John Feierabend (어린이 음악 교육)
- Eric Bluestine (*The Ways Children Learn Music*)
- Lucinda Geoghegan (Kodály 교수법)

**D. 초견·시창청음 전문가**
- Michael Hewitt (*Music Theory for Computer Musicians*)
- Gary Karpinski (시창청음 표준 교재)
- William Westney (*The Perfect Wrong Note*)

**E. 작곡가·연주자 글쓰기**
- Aaron Copland (*What to Listen for in Music*)
- Leonard Bernstein (*The Joy of Music*, Young People's Concerts) — 가장 알기 쉬운 음악 설명의 정수
- Charles Rosen (*The Classical Style*)
- Glenn Gould (에세이)

**알기 쉬운 설명 방법론 — 5거장 전통**

| 전통 | 핵심 기법 |
|---|---|
| **Bernstein 전통** | 추상 개념 → 언어·이야기 변환. "박자 = 심장 박동". 반복 + 점진적 깊이 |
| **Copland 전통** | 음악 듣기 3단계(감각·표현·순수). 점진적 전개. 구체적 작품 예시 |
| **Levitin 전통** | 음악 현상 → 뇌·인지 사실. 학술 + 일상 비유. "왜" 질문에서 시작 |
| **Ross 전통** | 음악 → 시대·인물·장소 맥락. 분석 + 역사 통합 |
| **음악 교육 전통** | 모방 → 이해 → 응용. 단계별. 어린 학습자 방식 = 어른에게도 유효 |

**7가지 구조적 기준**

1. **Hook** — 구체적 음악적 순간 (추상 X)
2. **Promise** — 본문 자체가 약속 ("이 글에서는" 표현 X)
3. **Scene/Example** — 구체적 장면·일상 비유
4. **Insight + Evidence** — 통찰 + 학술 인용 + DOI
5. **Three Acts** — 시작·발전·해결 (음악 형식처럼)
6. **Specificity** — 작곡가·작품·음표·박자 명시
7. **Callback/Echo** — 끝이 처음으로 호응

> §6 작성 이력에 매 글마다 적용 거장 전통 명시 (예: "Bernstein + Levitin 전통").

---

### 1.5 10레벨 조사·분석 기준 (2026-05-08 신규)

**조사·분석**
- 1차 자료 우선 (편지·원전·학술 논문)
- 2차 자료 = 음악 전문 출판사 (Cambridge·Oxford·Norton)
- 온라인 = JSTOR·Grove Music Online·Oxford Music Online
- 블로그·위키 = 보조만

**이미지**
- Wikimedia Commons PD·CC-BY 우선
- 1200px+ 가로 고화질
- 음악 내용과 직접 관련 (악보·악기·연주·역사)
- AI 생성 금지
- curl HTTP 200 필수 (§0.8 절차 준수)
- 라이선스 명시

**학술 자료**
- DOI 포함 필수
- Peer-reviewed 저널만
- 저자 전문 분야 = 음악 인지·음악 교육·음악 심리·신경과학
- 인용 50회 이상 (Google Scholar) 우선
- 최신 + 고전 균형
- 직전 14편과 저자 중복 최소화

---

### 1.6 못 쓴 날 처리

- N일차에서 멈추면 다음 작업일에 N일차부터 이어가기
- 일정 압박 X. 누적이 목표
- 다만 1~7일차 (1단계) 분량은 완료해야 안전한 분포 (정보성 위주)

---

## 2. Claude Code 자동 작성 명령 템플릿

매일 출근 전 또는 작업 시간에 Claude Code에 다음 메시지 입력. **N일차 자리만 매일 바꾸시면** 됩니다.

### 2.1 매일 사용할 명령 (평일·주말 공통)

```
오늘 블로그 글 작성 (N일차 분량). 

작업 사양: docs/marketing/blog_topics_100.md §0 + §1.1 그대로 따름.
오늘 작성 분량은 docs/marketing/blog_topics_100.md §1.1에서 N일차 행 확인. 평일 2편 / 주말 3편.

작업 도구: Sonnet 4.6 (블로그 작성은 단순 콘텐츠 생성이라 Sonnet 충분, Opus 사용량 절약).
/model로 Sonnet 전환 후 시작.

작업 후:
1. src/content/blog/ko/{오늘날짜}-{slug}.md (한국어) + src/content/blog/en/{오늘날짜}-{slug}.md (영어) 파일 동시 생성. 오늘 날짜는 작업 시점 한국 시간 (date 명령어로 확인). 형식 YYYY-MM-DD. 같은 글은 한+영 slug 동일.
2. docs/marketing/blog_topics_100.md §6 작성 이력 테이블에 추가 (날짜·일차·번호·제목·slug·카테고리·자수·핵심 키워드)
3. 작업 보고: 파일 경로 + 자수 + 핵심 키워드 + 한 줄 요약

커밋·push는 사용자가 직접. 작업 완료 후 멈춤.

원칙 (메모리에 기록):
- AI식 과장 표현 절대 금지 (혁신적·놀라운·완벽하게·지금 당장 등)
- 정확하고 객관적이고 확인된 정보
- 서론·본론·결론 명시 표현 금지, 자연 흐름
- Noteflex 자연 연계는 본문 80% 이후 1~2단락만
- 외부 신뢰성 출처 (위키·논문·공식 자료) 가능 시 인용
- **학술 자료 인용** (§0.7 참조): Google Scholar에서 검색 가능한 실제 자료만. 가짜 인용 절대 금지. 검증 불가 시 인용 생략. 글당 1~2개. APA 스타일.
- **이미지 활용** (§0.8 참조): Wikimedia Commons / IMSLP / Unsplash 중에서. 출처·라이선스 명시. AI 생성 이미지 금지. 글당 1~2장.
- **'참고 자료' 섹션 필수**: 글 하단에 추가. 학술 자료 + 이미지 출처 통합.
- **카테고리** (§0.9): "초견의 정석" / "실전 연습 가이드" / "음악 이론 & 화성학" / "뮤직 테크 & 미래" 중 1개. frontmatter `category` 필드. 영어 글은 "Sight-Reading Lab" / "Practice Hub" / "Theory & Harmony" / "Music Tech".
- **다국어 작성** (§0.10 참조): N일차마다 한국어 + 영어 두 언어 동시 작성. 평일 2편 → 한 2 + 영 4편 / 주말 3편 → 한 3 + 영 3 = 6편. 같은 글은 한국어·영어 같은 slug 사용 (frontmatter `slug` 동일).
- **파일 위치** (§0.10 참조): 한국어 글 = `src/content/blog/ko/{날짜}-{slug}.md`, 영어 글 = `src/content/blog/en/{날짜}-{slug}.md`. 폴더 분리.

파일 frontmatter 형식 (Markdown 파일 최상단):
---
title: "글 제목"
date: YYYY-MM-DD
description: "메타 설명 (150자 이내)"
keywords: ["키워드1", "키워드2", "키워드3"]
slug: "url-slug"
category: "초견의 정석" 또는 "실전 연습 가이드" 또는 "음악 이론 & 화성학" 또는 "뮤직 테크 & 미래"
day: N
---

```

**매일 바꿀 부분**: `N일차` 한 곳만 (예: `1일차`, `2일차`).

### 2.2 작성 이력 자동 갱신

§6 작성 이력 테이블에 작업한 글 정보를 Claude Code가 자동 추가. 사용자가 수동 갱신 안 해도 됨.

다음 N일차에 작성 시 §6 이력 보고 어디까지 진행됐는지 자동 파악. 못 쓴 날 있어도 N일차 누적 자동 추적.

### 2.3 사용자 추가 옵션 (필요 시 선택)

매일 명령에 추가 가능한 옵션:

- **"이 카테고리만 우선"**: 특정 카테고리 위주로 글 선택
- **"N편만 작성"**: 일정표보다 적게/많이
- **"광고 친화 우선"**: 광고 통과율 더 높은 주제로 변경
- **"Noteflex 직접 언급 글로"**: 카테고리 8 글로 변경

이런 옵션 없이 그냥 "N일차"만 입력하면 일정표대로 작성됨.

---

## 3. 100개 주제 — 4개 클러스터 매핑

각 주제를 4개 클러스터 중 하나에 매핑. 각 글의 frontmatter `category` 필드에 사용.

### 3.1 초견의 정석 (Sight-Reading Lab) — 약 35편

초견의 정의, 인지 심리학적 원리, 음표 매칭의 기술적 분석.

**핵심 영역**:
1. 초견이란 무엇인가 — 단순한 악보 읽기와 무엇이 다른가
2. 초견 능력이 음악 활동에 미치는 5가지 영향
3. 초견을 못해서 생기는 학습 정체 — 흔한 5가지 패턴
4. 초견과 청음의 차이 — 두 능력은 어떻게 함께 자라는가
5. 초견 실력의 4단계 — 입문·중급·숙련·전문가
6. 초견 연습이 두뇌에 미치는 영향 (인지과학 관점)
7. 어른이 되어 초견을 배우는 것 — 늦지 않은 이유
8. 초견 연습과 일반 곡 연습의 차이 — 시간 배분
9. "악보를 읽는다"는 것의 진짜 의미 — 글 읽기와의 비교
10. 초견 능력은 타고나는가 학습되는가
11. 초견과 절대음감 — 절대음감 없어도 초견 잘 할 수 있는 이유
12. 초견의 3가지 핵심 요소 — 시각·인지·운동의 통합
13. 초견 연습이 작곡·즉흥연주에 주는 효과
14. 합주·앙상블에서 초견이 중요한 이유
15. 초견 측정 방법 — 본인의 현재 수준을 객관적으로 알기

46. 음표 인식 속도 — 1초 vs 0.5초의 차이
47. 음정 인식의 신경과학 — 뇌는 음표를 어떻게 처리하는가
48. 빠른 음표 인식 트레이닝 — 단계별 가이드
49. 반응속도가 초견에 미치는 영향
50. "보자마자 안다" — 즉각 인식 능력 키우기
51. 음표 인식의 시각 패턴 — 모양으로 익히기
52. 덧줄 음표 빠르게 읽는 7가지 트릭
53. 조표 변화에 빠르게 적응하는 법
54. 음역대별 인식 속도 차이 — 왜 가운데가 빠른가
55. 인지 부하 관리 — 한 번에 처리할 수 있는 정보량

96. 매일 5분의 약속 — 작은 습관이 만드는 큰 변화
97. 초견 정체기 극복 — 답답함을 푸는 법

### 3.2 실전 연습 가이드 (Practice Hub) — 약 35편

학습 루틴, 단계별 훈련법, 악기별·직군별 가이드.

**학습 방법론** (15편):
31. 초견을 빠르게 늘리는 7가지 핵심 원칙
32. 매일 5분 초견 연습 — 효과적인 루틴 만들기
33. 한 음씩 천천히 읽기의 함정 — 청크 단위 인식 ✅ 작성 완료 (2026-05-28, chunking-music-reading)
34. 초견 연습 시간 — 얼마나, 어떻게 분배해야 하나
35. 초견에서 "자동화"가 중요한 이유
36. 같은 악보 반복 vs 새 악보 — 어느 것이 효과적인가
37. 초견 실수 패턴 분석 — 어떤 음을 자주 틀리는지 아는 법
38. 약점 음표 집중 학습법 — 데이터 기반 접근
39. 초견 연습에서 메트로놈 활용법
40. 초견 연습과 시각 추적 — 눈은 어떻게 움직여야 하나
41. 초견 연습의 3대 적 — 정체기 극복하기
42. 단계별 난이도 설정 — 너무 쉽지도 어렵지도 않게
43. 초견을 게임처럼 만드는 방법 — 동기 유지 비결
44. 초견 학습 일지 쓰기 — 진도 시각화의 효과
45. 듀오링고 방식의 음악 학습 — 짧고 자주 vs 길고 가끔

**직군별 가이드** (10편):
56. 피아노 학습자를 위한 초견 가이드
57. 합창 단원의 초견 — 성부 라인 빠르게 읽기
58. 교회 반주자의 초견 — 즉석 코드 변경 대응
59. 재즈 연주자의 초견 — 코드 차트와 멜로디 라인
60. 작곡가의 초견 — 자기 곡 검토와 협업
61. 음악 교사를 위한 초견 지도법
62. 어린이의 초견 학습 — 발달 단계별 접근
63. 시니어의 초견 학습 — 늦은 시작이 갖는 강점
64. 입시생의 초견 — 시험 대비 단기 전략
65. 취미 연주자의 초견 — 즐기면서 늘리는 법

**악기별** (10편):
66. 피아노 초견 vs 다른 악기 초견
67. 바이올린 초견의 특징 — 피아노와 다른 점
68. 기타 악보 vs 피아노 악보 — 두 세계의 차이
69. 보컬 초견 — 가사와 멜로디를 동시에
70. 관악기 초견 — 호흡과 시각의 결합 ✅ 작성 완료 (2026-05-24, wind-instrument-sight-reading)
71. 첼로·콘트라베이스 — 낮은음자리표 위주의 초견
72. 클라리넷·트럼펫 — 이조 악기의 초견
73. 드럼 초견 — 리듬 패턴 빠르게 읽기
74. 하프·마림바 — 다성부 악기의 초견
75. 편곡자·지휘자 — 풀스코어 초견의 도전

### 3.3 음악 이론 & 화성학 (Theory & Harmony) — 약 15편

악보를 더 빨리 읽기 위한 화성학 지식, 조표·임시표 분석.

16. 오선지의 원리 — 왜 5줄인가
17. 음자리표(높은음자리표·낮은음자리표) 완벽 정리
18. 그랜드 오선지의 이해 — 피아노 악보의 구조
19. 덧줄 읽기 — 어려운 이유와 극복법
20. 샵·플랫·내추럴 — 임시표의 모든 것
21. 조표 읽는 법 — 처음부터 끝까지
22. 박자표 — 4/4·3/4·6/8의 차이와 의미
23. 음표 길이 — 온음표부터 32분음표까지 정리
24. 쉼표 읽기 — 음표만큼 중요한 침묵의 표기
25. 셈여림 기호 — pp부터 fff까지
26. 이음줄·붙임줄 — 두 곡선의 결정적 차이 ✅ 작성 완료 (2026-05-29, slur-and-tie-difference)
27. 페달 기호 — 피아노 악보의 작은 표시들
28. 옥타브 기호 — 덧줄을 줄이는 약속
29. 셋잇단음표·여린박자 — 리듬의 변형
30. 악센트·스타카토 — 표현 기호 한눈에

### 3.4 뮤직 테크 & 미래 (Music Tech) — 약 15편

AI·정밀 데이터·Noteflex 기능·음악 교육의 미래.

**학습 데이터·과학** (10편):
76. 음악 학습에서 데이터 분석의 가치
77. 학습 곡선 — 초견 실력 성장의 모양
78. 망각 곡선과 N+2 복습 — 잊기 전에 다시 만나기
79. 가중치 학습 — 약점에 집중하기
80. 일간·주간·월간 진단의 의미
81. 학습 동기 유지의 심리학 — 스트릭의 효과
82. 게이미피케이션과 음악 학습
83. 정확도 vs 반응속도 — 우선순위와 균형
84. 음표별 마스터리 측정 — 진도의 객관화
85. 음악 학습 앱의 미래 — AI와 데이터 기반 개인화

**Noteflex 기능 연계** (10편):
86. Noteflex가 풀려는 문제 — 초견 정체기
87. Noteflex의 7레벨 21단계 시스템 — 점진적 난이도 설계
88. 같은 음표가 연속으로 안 나오는 이유 — 학습 알고리즘
89. N+2 재출제 로직 — 과학적 시간 간격
90. Noteflex의 데이터 분석 — 약점 진단
91. 게임 형식의 초견 학습 — Noteflex가 듀오링고에서 배운 것
92. Lv5+ 스와이프 인터랙션 — 샵·플랫 입력 방식
93. Noteflex의 정밀도 — 0.0001초 단위 반응속도 측정
94. 초견 학습의 표준화 — 21단계 설계
95. Noteflex 로드맵 — 출시 후 추가 기능

**브랜딩·라이프스타일** (3편):
98. 음악 학습과 자기효능감 — 작은 성취의 누적
99. 디지털 음악 학습의 시대 — 종이 악보에서 화면으로
100. The First Step to Musical Freedom — 슬로건의 의미

---

## 6. 작성 이력 (자동 갱신)

이 섹션은 Claude Code가 글 작성 후 자동 갱신.

| 날짜 | 일차 | 번호 | 제목 | slug | 카테고리 | 자수 | 핵심 키워드 | 거장 전통 |
|---|---|---|---|---|---|---|---|---|
| 2026-04-30 | 1 | §1-1 | 초견이란 무엇인가 (ko) | sight-reading-basics | 초견의 정석 | ~1600자 | 초견, sight-reading | — |
| 2026-04-30 | 1 | §1-1 | What Is Sight-Reading (en) | sight-reading-basics | Sight-Reading Lab | ~1500 words | sight-reading, music reading | — |
| 2026-04-30 | 1 | §2-16 | 오선지의 원리 (ko) | musical-staff-principle | 음악 이론 & 화성학 | ~1600자 | 오선지, 음자리표 | — |
| 2026-04-30 | 1 | §2-16 | The Musical Staff (en) | musical-staff-principle | Theory & Harmony | ~1500 words | musical staff, clef | — |
| 2026-05-01 | 2 | §1-2 | 초견 능력의 5가지 영향 (ko) | sight-reading-five-impacts | 초견의 정석 | ~1700자 | 초견, 합주, 초견 효과 | — |
| 2026-05-01 | 2 | §1-2 | Five Ways Sight-Reading Shapes Musical Life (en) | sight-reading-five-impacts | Sight-Reading Lab | ~1400 words | sight-reading, ensemble | — |
| 2026-05-01 | 2 | §2-17 | 음자리표 완벽 정리 (ko) | clef-guide | 음악 이론 & 화성학 | ~1600자 | 음자리표, 높은음자리표, 낮은음자리표 | — |
| 2026-05-01 | 2 | §2-17 | Treble Clef and Bass Clef Guide (en) | clef-guide | Theory & Harmony | ~1300 words | treble clef, bass clef | — |
| 2026-05-02 | 3 | §3-31 | 초견 7가지 핵심 원칙 (ko) | sight-reading-7-principles | 실전 연습 가이드 | ~1700자 | 초견, 초견 연습, 연습 방법 | — |
| 2026-05-02 | 3 | §3-31 | Seven Core Principles of Sight-Reading (en) | sight-reading-7-principles | Practice Hub | ~1500 words | sight-reading, music practice | — |
| 2026-05-02 | 3 | §2-18 | 그랜드 오선지 — 피아노 두 줄 사용 이유 (ko) | grand-staff-explained | 음악 이론 & 화성학 | ~1800자 | 그랜드 오선지, 피아노 악보 | — |
| 2026-05-02 | 3 | §2-18 | The Grand Staff Explained (en) | grand-staff-explained | Theory & Harmony | ~1600 words | grand staff, piano notation | — |
| 2026-05-02 | 3 | §8-86 | Noteflex가 풀려는 문제 (ko) — 토요일 3편째 (§1.1 6일차 차용) | noteflex-mission | 뮤직 테크 & 미래 | ~1900자 | Noteflex, 악보 독보 | — |
| 2026-05-02 | 3 | §8-86 | What Noteflex Is Trying to Solve (en) | noteflex-mission | Music Tech | ~1700 words | Noteflex, score reading | — |
| 2026-05-03 | 4 | §1-9 | "악보를 읽는다"의 진짜 의미 (ko) | reading-music-real-meaning | 초견의 정석 | ~1900자 | 악보 읽기, 초견, 음악 인지 | — |
| 2026-05-03 | 4 | §1-9 | What "Reading Music" Actually Means (en) | reading-music-real-meaning | Sight-Reading Lab | ~850 words | reading music, sight-reading, music cognition | — |
| 2026-05-03 | 4 | §2-19 | 덧줄 읽기가 어려운 이유 (ko) | reading-ledger-lines | 음악 이론 & 화성학 | ~1800자 | 덧줄, 악보 읽기, 음표 인식 | — |
| 2026-05-03 | 4 | §2-19 | Why Ledger Lines Are Hard to Read (en) | reading-ledger-lines | Theory & Harmony | ~890 words | ledger lines, sight-reading, music notation | — |
| 2026-05-03 | 4 | §7-78 | 망각 곡선과 N+2 복습 (ko) — 일요일 3편째 (§1.1 7일차 §7-78 차용) | forgetting-curve-and-spaced-repetition | 뮤직 테크 & 미래 | ~2100자 | 망각 곡선, Ebbinghaus, 간격 반복 | — |
| 2026-05-03 | 4 | §7-78 | The Forgetting Curve and N+2 Review (en) | forgetting-curve-and-spaced-repetition | Music Tech | ~860 words | forgetting curve, spaced repetition, Ebbinghaus | — |
| 2026-05-04 | 5 | §1-15 | 초견 실력은 어떻게 측정할까 (ko) | how-to-measure-sight-reading-skill | 초견의 정석 | ~1360자 | 초견 측정, 정확도, 아이-핸드 스팬 | — |
| 2026-05-04 | 5 | §1-15 | How to Measure Sight-Reading Skill (en) | how-to-measure-sight-reading-skill | Sight-Reading Lab | ~730 words | sight-reading measurement, eye-hand span | — |
| 2026-05-04 | 5 | §2-20 | 임시표(♯·♭·♮)의 모든 것 (ko) | accidentals-explained | 음악 이론 & 화성학 | ~1460자 | 임시표, 올림표, 내림표, 조표 | — |
| 2026-05-04 | 5 | §2-20 | Accidentals Explained: Sharps, Flats, and Naturals (en) | accidentals-explained | Theory & Harmony | ~830 words | accidentals, sharps, flats, key signature | — |
| 2026-05-05 | 6 | §3-32 | 매일 5분 초견 연습 — 효과적인 루틴 만들기 (ko) | daily-5min-sight-reading-routine | 실전 연습 가이드 | ~1690자 | 초견 연습, 분산 연습, 의도적 연습, 매일 루틴 | — |
| 2026-05-05 | 6 | §3-32 | Daily 5-Minute Sight-Reading Practice — Building an Effective Routine (en) | daily-5min-sight-reading-routine | Practice Hub | ~810 words | sight-reading practice, daily routine, deliberate practice | — |
| 2026-05-05 | 6 | §3-33 | 한 음씩 천천히 읽기의 함정 — 청크 단위 인식 (ko) | chunk-based-sight-reading | 실전 연습 가이드 | ~1610자 | 청크 인식, 악보 패턴, 초견 훈련, 패턴 인식 | — |
| 2026-05-05 | 6 | §3-33 | The Note-by-Note Trap — How Chunk-Based Recognition Transforms Sight-Reading (en) | chunk-based-sight-reading | Practice Hub | ~800 words | chunk-based reading, pattern recognition, sight-reading | — |
| 2026-05-06 | 7 | §2-21 | 조표 읽는 법 — ♯·♭의 위치만 봐도 조성을 알 수 있는 이유 (ko) | key-signatures-explained | 음악 이론 & 화성학 | ~2180자 | 조표, 5도권, 조성 인식, 악보 읽기 | — |
| 2026-05-06 | 7 | §2-21 | How to Read Key Signatures — Why the Order of Sharps and Flats Reveals the Key (en) | key-signatures-explained | Theory & Harmony | ~830 words | key signatures, circle of fifths, tonal recognition | — |
| 2026-05-06 | 7 | §4-46 | 음표 인식 속도 — 초견 한계를 결정하는 시각·운동 자동화 (ko) | note-recognition-speed | 초견의 정석 | ~2030자 | 음표 인식, 초견 속도, eye-hand span, 시각 처리 | — |
| 2026-05-06 | 7 | §4-46 | Note Recognition Speed — The Visual-Motor Automation Behind Sight-Reading (en) | note-recognition-speed | Sight-Reading Lab | ~815 words | note recognition, sight-reading speed, eye-hand span | — |
| 2026-05-07 | 8 | §3-34 | 초견 연습 시간 — 얼마나, 어떻게 분배해야 효율적일까 (ko) | sight-reading-practice-time | 실전 연습 가이드 | ~2180자 | 초견 연습 시간, 분산 연습, deliberate practice, 악보 읽기 루틴 | — |
| 2026-05-07 | 8 | §3-34 | How Much Sight-Reading Practice — Time and Distribution That Actually Works (en) | sight-reading-practice-time | Practice Hub | ~800 words | sight-reading practice, distributed practice, deliberate practice | — |
| 2026-05-07 | 8 | §2-22 | 박자표 읽는 법 — 4/4·3/4·6/8이 의미하는 것 (ko) | time-signatures-explained | 음악 이론 & 화성학 | ~2183자 | 박자표, 단순박자, 복합박자, 4/4, 3/4, 6/8 | — |
| 2026-05-07 | 8 | §2-22 | How to Read Time Signatures — What 4/4, 3/4, and 6/8 Actually Mean (en) | time-signatures-explained | Theory & Harmony | ~894 words | time signature, simple meter, compound meter | — |
| 2026-05-08 | 9 | §3-35 | 초견과 자동화 — 악보가 의식 없이 읽히는 상태로 가는 길 (ko) | automaticity-in-sight-reading | 실전 연습 가이드 | ~1900자 | 자동화, 초견 자동화, 악보 읽기 자동화, 음표 인식 | Levitin + Bernstein 전통 |
| 2026-05-08 | 9 | §3-35 | Why Automaticity Makes or Breaks Sight-Reading (en) | automaticity-in-sight-reading | Practice Hub | ~806 words | automaticity, sight-reading, music cognition, note recognition | Levitin + Bernstein 전통 |
| 2026-05-08 | 9 | §2-23 | 음표 길이 완벽 정리 — 온음표부터 32분음표, 리듬이 만들어지는 방식 (ko) | note-values-explained | 음악 이론 & 화성학 | ~2000자 | 음표 길이, 온음표, 4분음표, 8분음표, 악보 읽기 | Copland + 음악 교육 전통 |
| 2026-05-08 | 9 | §2-23 | Note Values Explained — From Whole Notes to Thirty-Second Notes (en) | note-values-explained | Theory & Harmony | ~892 words | note values, whole note, quarter note, eighth note, rhythm | Copland + 음악 교육 전통 |
| 2026-05-09 | 10 | §3-37 | 초견 실수 패턴 분석 (ko) | sight-reading-mistake-patterns | 실전 연습 가이드 | ~1700자 | 초견 실수, 약점 음표, 덧줄 오류, 임시표 오류, 리듬 오류 | Levitin + 음악 교육 전통 |
| 2026-05-09 | 10 | §3-37 | Sight-Reading Mistake Patterns (en) | sight-reading-mistake-patterns | Practice Hub | ~880 words | sight-reading mistakes, note recognition errors, rhythm errors | Levitin + 음악 교육 전통 |
| 2026-05-09 | 10 | §2-24 | 쉼표 읽기 — 음표만큼 중요한 침묵의 표기 (ko) | reading-rests-musical-silence | 음악 이론 & 화성학 | ~1700자 | 쉼표 읽기, 침묵, 박자 유지, 대위법, 쉼표 오류 | Copland + Bernstein 전통 |
| 2026-05-09 | 10 | §2-24 | Reading Rests — Why Silence Matters as Much as Notes (en) | reading-rests-musical-silence | Theory & Harmony | ~870 words | reading rests, musical silence, pulse maintenance, rest notation | Copland + Bernstein 전통 |
| 2026-05-09 | 10 | §8-87 | Noteflex의 7레벨 21단계 시스템 (ko) — 토요일 3편째 (§1.1 13일차 차용) | seven-level-twenty-one-stage-system | 뮤직 테크 & 미래 | ~1850자 | 21단계, ZPD, 플로 이론, 점진적 학습, 통과 기준 | Levitin + 음악 교육 전통 |
| 2026-05-09 | 10 | §8-87 | The 7-Level 21-Stage System (en) | seven-level-twenty-one-stage-system | Music Tech | ~900 words | 21-stage system, ZPD, flow theory, progressive difficulty, pass criteria | Levitin + 음악 교육 전통 |
| 2026-05-12 | 13 | §5-65 | 취미 연주자를 위한 초견 — 직업이 아니라 즐거움일 때 (ko) | hobbyist-musician-sight-reading | 직군별 학습 전략 | ~2000자 | 취미 연주, 성인 음악 학습, 취미 초견, 아마추어 피아니스트 | Bonneville-Roussy + 음악 교육 전통 |
| 2026-05-12 | 13 | §5-65 | Sight-Reading for the Hobbyist (en) | hobbyist-musician-sight-reading | Learning Strategies by Role | ~890 words | hobbyist musician, amateur sight-reading, lifelong learning | Bonneville-Roussy + 음악 교육 전통 |
| 2026-05-12 | 13 | §4-48 | 빠른 음표 인식의 과학 — 눈이 멈추는 자리 (ko) — 14일차 차용 | fast-note-recognition | 초견의 정석 | ~1950자 | 음표 인식 속도, fixation, saccade, 시선 추적, 음악 인지 | Goolsby + Rayner 전통 |
| 2026-05-12 | 13 | §4-48 | The Science of Fast Note Recognition (en) — 14일차 차용 | fast-note-recognition | Sight-Reading Lab | ~900 words | note recognition speed, fixation, saccade, eye tracking | Goolsby + Rayner 전통 |
| 2026-05-12 | 13 | §1-7 | 어른의 초견 — 늦게 시작하는 학습자가 알아야 할 것들 (ko) — 14일차 차용 | adult-sight-reading | 초견의 정석 | ~2050자 | 어른의 초견, 성인 음악 학습, 신경가소성, 평생 학습 | Bugos + Wan & Schlaug 전통 |
| 2026-05-12 | 13 | §1-7 | Sight-Reading as an Adult (en) — 14일차 차용 | adult-sight-reading | Sight-Reading Lab | ~910 words | adult sight-reading, adult learner, neuroplasticity, late-start | Bugos + Wan & Schlaug 전통 |
| 2026-05-19 | — | §5-61 | 초견을 가르치는 교사의 6가지 단계 (ko) | music-teacher-sight-reading-pedagogy | 직군별 학습 전략 | ~2100자 | 음악 교사, 초견 지도, 자기조절 학습, 메타인지 | McPherson + 음악 교육 전통 |
| 2026-05-19 | — | §5-61 | Six Stages of Teaching Sight-Reading (en) | music-teacher-sight-reading-pedagogy | Learning Strategies by Role | ~920 words | sight-reading pedagogy, music teacher, self-regulated learning | McPherson + 음악 교육 전통 |
| 2026-05-19 | — | §7-77 | 초견 실력의 학습 곡선 (ko) | sight-reading-learning-curve | 뮤직 테크 & 미래 | ~2050자 | 학습 곡선, power law of practice, 자동화, 정체기 | Anderson + Levitin 전통 |
| 2026-05-19 | — | §7-77 | The Sight-Reading Learning Curve (en) | sight-reading-learning-curve | Music Tech | ~900 words | learning curve, power law of practice, automaticity, plateau | Anderson + Levitin 전통 |
| 2026-05-19 | — | §1-12 | 초견을 떠받치는 세 기둥 (ko) | three-pillars-of-sight-reading | 초견의 정석 | ~2000자 | 초견, 시각·인지·운동, eye-hand span, 작업 기억 | Drai-Zerbib + Bernstein 전통 |
| 2026-05-19 | — | §1-12 | The Three Pillars of Sight-Reading (en) | three-pillars-of-sight-reading | Sight-Reading Lab | ~890 words | sight-reading pillars, visual cognitive motor, integration | Drai-Zerbib + Bernstein 전통 |
| 2026-05-20 | — | §4-55 | 악보 읽기와 인지 부하 (ko) | cognitive-load-music-reading | 학습 데이터·과학 | ~3990자 | 인지 부하, 작업 기억, Sweller, Miller, 청크화 | Sweller + Miller 전통 |
| 2026-05-20 | — | §4-55 | Cognitive Load and Music Reading (en) | cognitive-load-music-reading | Learning Science | ~1275 words | cognitive load, working memory, Sweller, Miller, chunking | Sweller + Miller 전통 |
| 2026-05-20 | — | §6-68 | 기타 악보와 피아노 악보 — 두 세계의 차이 (ko) | guitar-vs-piano-notation | 악기별 가이드 | ~3582자 | 기타 악보, 피아노 악보, 타브, tablature, 악보 비교 | Stewart + Apel 전통 |
| 2026-05-20 | — | §6-68 | Guitar Notation vs Piano Notation (en) | guitar-vs-piano-notation | Instrument Guides | ~1291 words | guitar notation, piano notation, tablature, TAB, instrument comparison | Stewart + Apel 전통 |
| 2026-05-20 | — | §2-25 | 셈여림 기호 — pp부터 fff까지 (ko) | dynamics-markings-explained | 음악 이론 & 화성학 | ~4202자 | 셈여림, 다이내믹, pp, ff, 피아니시모, 포르테 | Goebl + Brown 전통 |
| 2026-05-20 | — | §2-25 | Dynamics Markings Explained — From pp to fff (en) | dynamics-markings-explained | Theory & Harmony | ~1325 words | dynamics, pianissimo, fortissimo, score reading | Goebl + Brown 전통 |
| 2026-05-22 | — | §5-63 | 시니어의 초견 학습 — 늦게 시작하는 것이 약점이 아닌 이유 (ko) ✅ 작성 완료 | senior-sight-reading | 직군별 학습 전략 | ~2200자 | 시니어 음악 학습, 늦은 시작, 신경가소성, 성인 초견 | Hanna-Pladdy + MacKay 전통 |
| 2026-05-22 | — | §5-63 | Sight-Reading for Seniors (en) ✅ 작성 완료 | senior-sight-reading | Learning Strategies by Role | ~950 words | senior music learning, adult sight-reading, neuroplasticity, older adult piano | Hanna-Pladdy + MacKay 전통 |
| 2026-05-24 | — | §6-70 | 관악기 초견 — 호흡과 시각이 함께 읽는 악보 (ko) ✅ 작성 완료 | wind-instrument-sight-reading | 악기별 초견 전략 | ~2100자 | 관악기 초견, 플루트 초견, 클라리넷 초견, 이조 악기 | Kopiez + Lee 전통 |
| 2026-05-24 | — | §6-70 | Wind Instrument Sight-Reading — When Eyes and Breath Read Together (en) ✅ 작성 완료 | wind-instrument-sight-reading | Sight-Reading by Instrument | ~1050 words | wind instrument sight-reading, flute sight-reading, clarinet sight-reading, transposing instrument | Kopiez + Lee 전통 |
| 2026-05-25 | — | §3-R1 | 리듬 초견 — 박자 기호를 알아도 리듬이 자꾸 틀리는 이유 (ko) ✅ 작성 완료 | rhythm-sight-reading-strategies | 실전 연습 가이드 | ~1800자 | 리듬 초견, 악보 리듬 읽기, 리듬 실수, 초견 리듬, 박자 연습, 리듬 패턴, 내면 박자 | Palmer + Krumhansl 전통 |
| 2026-05-25 | — | §3-R1 | Rhythm Sight-Reading: Why You Keep Getting Rhythms Wrong (en) ✅ 작성 완료 | rhythm-sight-reading-strategies | Practice Hub | ~980 words | rhythm sight-reading, reading rhythm in music, rhythm mistakes, inner pulse, beat training | Palmer + Krumhansl 전통 |
| 2026-05-26 | — | §1-4 | 초견과 청음 — 악보를 읽는 눈과 소리를 듣는 귀 (ko) ✅ 작성 완료 | sight-reading-vs-ear-training | 초견의 정석 | ~2846자 | 초견과 청음, 청음 훈련, audiation, 악보 읽기, 음정 인식, 내면 청음 | Hayward & Gromko 전통 |
| 2026-05-26 | — | §1-4 | Sight-Reading and Ear Training: Different Skills, One Musical Foundation (en) ✅ 작성 완료 | sight-reading-vs-ear-training | Sight-Reading Lab | ~951 words | sight-reading vs ear training, audiation, aural training, music reading, ear training | Hayward & Gromko 전통 |
| 2026-05-27 | 27 | §1-5 | 초견 실력의 4단계 — 입문부터 전문가까지 어떻게 달라지는가 (ko) ✅ 작성 완료 | sight-reading-four-stages | 초견의 정석 | ~1950자 | 초견 실력 4단계, 초견 단계, 음표 인식, eye-hand span, 초견 전문가 | Waters et al. 전통 |
| 2026-05-27 | 27 | §1-5 | The Four Stages of Sight-Reading Skill (en) ✅ 작성 완료 | sight-reading-four-stages | Sight-Reading Lab | ~1020 words | sight-reading stages, four stages sight-reading, eye-hand span, note recognition speed, music reading expertise | Waters et al. 전통 |
| 2026-05-28 | 28 | §3-33 | 한 음씩 천천히 읽기의 함정 — 청크 단위로 악보를 읽는 법 (ko) ✅ 작성 완료 | chunking-music-reading | 실전 연습 가이드 | ~2550자 | 악보 청크, 한 음씩 읽기, 초견 청크화, 악보 패턴 읽기, 작업 기억 음악 | Sloboda + Miller 전통 |
| 2026-05-28 | 28 | §3-33 | The Trap of Reading One Note at a Time — How Chunking Transforms Sight-Reading (en) ✅ 작성 완료 | chunking-music-reading | Practice Hub | ~870 words | chunking music reading, music chunking, note-by-note reading, music pattern recognition, working memory music | Sloboda + Miller 전통 |
| 2026-05-29 | 29 | §2-26 | 이음줄과 붙임줄 — 같아 보이는 두 곡선의 결정적 차이 (ko) ✅ 작성 완료 | slur-and-tie-difference | 음악 이론 & 화성학 | ~2150자 | 이음줄 붙임줄 차이, 타이 슬러, 악보 곡선, 레가토, 음악 표기법 | Palmer 전통 |
| 2026-05-29 | 29 | §2-26 | Slurs and Ties — How Two Curves That Look the Same Mean Different Things (en) ✅ 작성 완료 | slur-and-tie-difference | Theory & Harmony | ~850 words | slur vs tie, slur and tie difference, tie notation music, legato slur, phrase marks | Palmer 전통 |

---

## 7. 메모

### 7.1 자동 작성·게시 운영 방식

- **자동 작성 가능**: Claude Code가 .md 파일 생성
- **자동 게시 부분 가능**: 사용자께서 git push 후 Vercel 자동 배포
- **자동 스케줄링 불가**: 매일 사용자가 Claude Code에 명령 입력 필요

### 7.2 사용자 일일 작업 (회사 출근 후 또는 작업 시간)

1. Claude Code 켜기
2. § 2.1 (평일) 또는 § 2.2 (주말) 명령 입력
3. 작업 끝나면 결과 확인 + 검토
4. `git add src/content/blog/ docs/marketing/blog_topics_100.md`
5. `git commit -m "blog: {N}편 추가 — {날짜}"`
6. `git push`

소요 시간: Claude Code 작업은 자동, 사용자 직접 작업은 5~10분.

### 7.3 작성 품질 검증 (사용자 검토 시)

- AI식 과장 표현 있는지 확인
- 자연스러운 흐름인지 확인
- Noteflex 자연 연계 위치 확인
- SEO 키워드 자연 분포 확인
- 사실 정확성 확인 (출처 있으면 검증)

문제 있으면 Claude Code에 "X 부분 수정" 명령으로 재작성.

### 7.4 문서 연결

- `docs/PENDING_BACKLOG.md` §10.2 블로그 글 작성과 연동
- `docs/PENDING_BACKLOG.md` §3.1 AdSense 심사 전략과 연동

### 7.5 4/30 첫 작성 글 카테고리 매핑 (2026-04-30)

4/30 작성된 2편을 4개 클러스터로 매핑 (frontmatter `category` 필드 수정 필요):

| 파일 | 기존 카테고리 | 신규 카테고리 |
|---|---|---|
| 2026-04-30-sight-reading-basics.md (§1-1 초견이란 무엇인가) | "초견 기초" | **"초견의 정석"** |
| 2026-04-30-musical-staff-principle.md (§2-16 오선지의 원리) | "악보 읽기" | **"음악 이론 & 화성학"** |

push 전 두 파일의 frontmatter `category` 필드만 수정.

### 7.6 학술 자료·이미지·다국어 적용 시점 (2026-04-30 사용자 결정)

- **4/30 작성 글 2편**: 한국어 only로 push 완료 (학술 자료·이미지 미적용)
- **5/1 작업**: 4/30 글 영어 버전 추가 (총 4편) + 5/1 신규 글 한+영 (총 4편) = 8편 작성
- **5/1부터 신규 글**: 새 사양 모두 적용
  - §0.7 학술 자료 (Google Scholar 검색 가능한 실제 자료만)
  - §0.8 이미지 (Wikimedia·IMSLP·Unsplash, 출처 명시)
  - §0.10 다국어 (한+영 동시 작성, ko·en 폴더 분리)

### 7.7 About / Contact 페이지 (2026-04-30 신규)

AdSense 심사 통과 필수 요건. `docs/PENDING_BACKLOG.md` §10에 별도 항목으로 등록.

- About Us — 브랜드 철학 (0.0001초 정밀도, 듀오링고식 학습 의도)
- Contact — 이메일 또는 문의 양식 (support@noteflex.app)
- 푸터 링크 추가
- Week 2~3 작업

### 7.8 BLOG_LOG.md 통합 (2026-05-19 신규)

> `docs/blog/BLOG_LOG.md`는 deprecated. 블로그 메타데이터·정책·DOI 검증 결과는 이 파일에 통합 관리한다. BLOG_LOG.md는 과거 이력 참고용으로 보존한다.

#### 7.8-A 본문 이미지·인용 정책 (BLOG_LOG → 통합)

- **HISTORY_THEORY / 음악 이론 & 화성학·초견의 정석**: Wikimedia Commons 공개 도메인 이미지 2장 이상 권장. 본문 내 자연 배치, 글 끝에 `## 이미지 출처` (KO) / `## Image Sources` (EN) 섹션 명시.
- **PRACTICAL_GUIDE / 실전 연습 가이드 등**: 카테고리 그라데이션 커버에 의존, 본문 이미지 0개 가능. 글 끝에는 `## 참고 문헌` / `## References` 만.
- **공통**: 모든 이미지 URL은 작성 전 `curl -I` 200 응답 확인. AI 생성 이미지·Pexels·Unsplash·Pixabay·스톡 포토 금지.
- 허용 출처: Wikimedia Commons, Library of Congress, Met Museum, BnF Gallica, NYPL, Smithsonian, British Library, IMSLP, Mutopia Project, CPDL, PLOS, PMC, Frontiers.

#### 7.8-B 학술 인용 정책 (BLOG_LOG → 통합)

- DOI URL은 `curl -I`에서 200 또는 403(봇 차단)이면 유효. 404면 DOI 제거하고 인용 정보(저자·연도·제목·저널)만 유지.
- 글당 인용 최소 1개, 동일 저자 3편 연속 사용 금지 (§0.11).
- peer-reviewed 저널 우선, 책·매거진은 보조.

#### 7.8-C 출처 섹션 구조 (BLOG_LOG → 통합)

```markdown
## 이미지 출처
- 이미지명: 출처 URL (라이선스 표기)

## 참고 문헌
- 저자 (연도). 제목. 저널, 권(호), 쪽수. DOI: 10.xxxx/xxxxx
```

영어 글은 `## Image Sources` + `## References`.

#### 7.8-D 누적 글 수 (2026-05-24 갱신)

| 날짜 | KO | EN | 합계 | 비고 |
|---|---|---|---|---|
| 2026-05-15 | 40 | 40 | 80 | D+A 감사 + 커버 이미지 정책 확정 |
| 2026-05-16~18 | 55 | 55 | 110 | 신규 18편 추가, 카테고리 매핑 정정 |
| 2026-05-19 | 58 | 58 | 116 | 신규 3편 추가 (직군·학습 곡선·3대 요소) |
| 2026-05-22 | 59 | 59 | 118 | §5-63 시니어 초견 (ko+en) 추가 |
| 2026-05-24 | 60 | 60 | 120 | §6-70 관악기 초견 (ko+en) 추가 |
| 2026-05-25 | 61 | 61 | 122 | §3-R1 리듬 초견 전략 (ko+en) 추가 |
| 2026-05-26 | 65 | 65 | 130 | §1-4 초견과 청음 (ko+en) 추가 (실제 파일 수 기준) |
| 2026-05-27 | 66 | 66 | 132 | §1-5 초견 실력 4단계 (ko+en) 추가 |
| 2026-05-28 | 67 | 67 | 134 | §3-33 청크 단위 인식 (ko+en) 추가 |
| 2026-05-29 | 68 | 68 | 136 | §2-26 이음줄·붙임줄 차이 (ko+en) 추가 |

#### 7.8-E 2026-05-16~19 신규 21편 이미지·인용 메타데이터

| 슬러그 | 이미지 (Wikimedia) | 학술 인용 |
|---|---|---|
| transposition-explained | DwtkII-as-dur-fuga.jpg | Wolf (1976) DOI 10.1007/BF01067255 |
| sight-reading-metacognition | Teaching rhythm in music education | Schraw & Dennison (1994) DOI 10.1006/ceps.1994.1033 |
| orchestra-sight-reading | Small environment of studying Score KV265 | Wolf (1976) DOI 10.1007/BF01067255 |
| chord-progression-reading | Sheet music | Sloboda (1985) DOI 10.1093/acprof:oso/9780198521280.001.0001 |
| working-memory-music-reading | Reading Fixations Saccades | Furneaux & Land (1999) DOI 10.1098/rspb.1999.0943 |
| string-ensemble-sight-reading | Bachlut1.png | Buccino et al. (2001) DOI 10.1111/j.1460-9568.2001.01385.x |
| sight-reading-metrics | Piano practice | Lehmann & Ericsson (1996) DOI 10.1037/h0094082 |
| suzuki-vs-traditional-reading | Music class USA | McPherson & Gabrielsson (2002) DOI 10.1093/acprof:oso/9780195138108.003.0007 |
| pre-performance-24hours | Beethoven-Op.90-manuscript-opening | Stickgold & Walker (2007) DOI 10.1016/j.sleep.2007.03.011 |
| music-teacher-sight-reading-pedagogy | Music Lesson 1877 by Frederic Leighton + Music class students | McPherson & Renwick (2001) DOI 10.1080/14613800120089232 |
| sight-reading-learning-curve | Learning curve example from WWII + Piano practice | Anderson (1982) DOI 10.1037/0033-295X.89.4.369 |
| three-pillars-of-sight-reading | Eye movements and imagination 1 + Chopin polonaise Op. 53 | Drai-Zerbib & Baccino (2014) DOI 10.16910/jemr.7.2.5 |
| rhythm-sight-reading-strategies | Chopin Polonaise Op.53 (960px) + Piano practice (960px) | Palmer & Krumhansl (1990) DOI 10.1037/0096-1523.16.4.728 |
| sight-reading-vs-ear-training | Guidonian Hand (Wikimedia Commons, 500px) + Solfège des chanteurs G. Kuhn 1851 (BnF Gallica) | Hayward & Gromko (2009) DOI 10.1177/0022429409332677 |
| sight-reading-four-stages | LoC FSA Gloria Brink (cover) + LoC FSA Lighthouse piano lesson 8d42031r | Waters, Townsend & Underwood (1998) DOI 10.1037/0096-1523.24.5.1417 |
| chunking-music-reading | Wikimedia Goldberg Aria 1st edition BnF + Wikimedia Chopin Nocturne Op.62-2 autograph | Sloboda (1976) DOI 10.1080/14640747608400586 |
| slur-and-tie-difference | Wikimedia Schubert Mass No.6 D944 autograph + Wikimedia Ties slurs and ligature SVG | Palmer (1989) DOI 10.1037/0096-1523.15.2.331 |

---

## 변경 이력

- 2026-04-29 (오전): v1 초안 — 100개 주제 + 9개 카테고리
- 2026-04-29 (오후): v2 — N일차 방식 일정표 + Claude Code 자동 작성 명령 템플릿
- 2026-04-29 (저녁): v3 — 날짜 자동화 (date 명령어) + frontmatter 형식 추가
- 2026-04-30 (오전): v4 — push 완료, 4/30 1일차 글 2편 작성 시작
- 2026-04-30 (저녁): v5 — 4개 클러스터 카테고리 + 학술 자료 + 이미지 활용 가이드
- 2026-04-30 (밤): **v6 — 다국어 운영 (한+영 동시, 5/1부터, ko·en 폴더 분리)**
- 2026-05-01: **v7 — §6 작성 이력 갱신 (2일차 4편 + 4/30 영어 번역 2편 = 총 8편 누적)**
- 2026-05-02: **v8 — 3일차 6편 (한+영 각 3편). 5/2 토요일=주말 3편 정책. §1.1 6일차 3편째 (§8-86 Noteflex 풀려는 문제) 차용. 4일차 이후 시프트 X. 누적 14편 (한 7 + 영 7).**
- 2026-05-03: **v9 — 4일차 6편 (한+영 각 3편: §1-9 "악보를 읽는다" 진짜 의미, §2-19 덧줄 읽기, §7-78 망각 곡선과 N+2). 일요일=주말 3편 정책. §1.1 7일차 3편째 (§7-78) 차용. §1.1 1단계 표를 실제 날짜·요일 기반으로 재배치 (4/30~5/6 첫 주). 누적 20편 (한 10 + 영 10).**
- 2026-05-04: **v10 — 5일차 4편 (한+영 각 2편: §1-15 초견 실력 측정, §2-20 임시표). 학술 인용: Mishra(2014), Krumhansl(1990). 누적 24편 (한 12 + 영 12).**
- 2026-05-05: **v11 — 6일차 4편 (한+영 각 2편: §3-32 매일 5분 루틴, §3-33 청크 단위 인식). 학술 인용: Ericsson et al.(1993), Sloboda(1984). 누적 28편 (한 14 + 영 14). AdSense 심사 30편 달성까지 2편 남음(5/6 7일차).**
- 2026-05-06: **v12 — 7일차 4편 (한+영 각 2편: §2-21 조표 읽는 법, §4-46 음표 인식 속도). §1.1 7일차 §7-78 자리는 5/3에 차용된 영역 그대로 일관. 학술 인용: Tillmann·Bharucha·Bigand(2000), Bigand & Poulin-Charronnat(2006), Furneaux & Land(1999), Stewart et al.(2003). 누적 32편 (한 16 + 영 16). AdSense 심사 30편 영역 도달.**
- 2026-05-07: **v13 — 8일차 4편 (한+영 각 2편: §3-34 초견 연습 시간 분배, §2-22 박자표). 학술 인용: Duke, Simmons & Cash (2009), Hannon & Trehub (2005). 이미지: Wikimedia Commons 4개 (curl HTTP 200 검증). 누적 36편 (한 18 + 영 18).**
- 2026-05-08: **v14 — §1.4 글쓰기 방법론(음악 거장 학습 5분야·5거장 전통·7구조 기준)·§1.5 10레벨 조사·분석 기준 신규 추가. 기존 §1.4 → §1.6으로 변경. §6 거장 전통 열 추가. 9일차 4편 (한+영 각 2편: §3-35 자동화, §2-23 음표 길이). 학술 인용: Chaffin & Imreh (2002), Palmer (1997), Drake et al. (2000), Grahn & Brett (2007). 이미지: Wikimedia Commons 4개 (curl HTTP 200). 누적 40편 (한 20 + 영 20).**
- 2026-05-09: **v15 — 10일차 6편 (한+영 각 3편: §3-37 초견 실수 패턴 분석, §2-24 쉼표 읽기, §8-87 21단계 시스템). §1.1 5/2·5/3 패턴 일관 = §8-87 13일차 3편째 차용, 시프트 X. 학술 인용: Kopiez & Lee (2008), Lehmann & McArthur (2002), Margulis (2007), Cooper & Meyer (1960), Vygotsky (1978), Hattie & Timperley (2007). 이미지: Pexels 6개 (curl HTTP 200 PASS). 누적 46편 (한 23 + 영 23).**
- 2026-05-10: **v16 — 11일차 6편 (한+영 각 3편: §3-38 약점 음표 집중 학습법, §5-56 피아노 초견 가이드, §7-79 가중치 학습 알고리즘). §7-79 14일차 차용. 학술 인용: Ericsson et al. (1993) DOI, Karpinski (2000) + Lehmann (2002), Cepeda et al. (2006) DOI. 이미지: Wikimedia Commons 6개 (curl HTTP 200). 누적 52편 (한 26 + 영 26). ※PENDING 이력 "49편" 오기 정정 — 실제 파일 수 기준 52편.**
- 2026-05-11: **v17 — 12일차 6편 (한+영 각 3편: §4-47 음정 인식의 신경과학, §5-58 교회 반주자, §3-43 게임처럼 만들기). §3-43 13일차 차용. 학술 인용: Zatorre & Salimpoor (2013) DOI:10.1073/pnas.1301228110, McPherson (1994) DOI:10.2307/3345701, Ryan & Deci (2000) DOI:10.1037/0003-066X.55.1.68. 이미지: Wikimedia Commons 6개 (curl HTTP 200 PASS). 누적 58편 (한 29 + 영 29).**
- 2026-05-12: **v18 — 13일차 6편 (한+영 각 3편: §5-65 취미 연주자, §4-48 빠른 음표 인식, §1-7 어른의 초견). §4-48·§1-7 14일차 차용 — 13일차 슬롯 §3-43(12일차 차용)·§8-87(10일차 차용)이 이미 advance write 되어 있어 신규 작성 슬롯이 §5-65 단 1개뿐이라 14일차에서 2개를 추가 차용. 학술 인용: Bonneville-Roussy et al. (2011) DOI:10.1177/0305735609352441, Goolsby (1994) DOI:10.2307/40285757, Rayner (1998) DOI:10.1037/0033-2909.124.3.372, Bugos et al. (2007) DOI:10.1080/13607860601086504, Wan & Schlaug (2010) DOI:10.1177/1073858410377805. 이미지: Wikimedia Commons 6개 (Renoir·Menzel·Reading Fixations·Wundt·Manet·Vermeer, curl HTTP 200 PASS). 누적 64편 (한 32 + 영 32).**
- 2026-05-19: **v19 — 신규 3편 (한+영 각 3편: §5-61 음악 교사 지도법, §7-77 학습 곡선, §1-12 초견의 3가지 핵심 요소). §0.9 STYLE_MAP 기준 9개 카테고리 전수 등재 + 위 카테고리 외 생성 금지 규칙 명시. §7.8 BLOG_LOG.md 통합 — 본문 이미지·인용 정책, 출처 섹션 구조, 누적 글 수, 21편 메타데이터 통합. BLOG_LOG.md는 deprecated 처리하고 보존. 학술 인용: McPherson & Renwick (2001) DOI:10.1080/14613800120089232, Anderson (1982) DOI:10.1037/0033-295X.89.4.369, Drai-Zerbib & Baccino (2014) DOI:10.16910/jemr.7.2.5. 이미지: Wikimedia Commons 6개 (Leighton Music Lesson·Music class students·WWII Learning curve·Piano practice·Eye movements imagination·Chopin Op.53, curl HTTP 200 PASS). 누적 116편 (한 58 + 영 58).**
- 2026-05-25: **v20 — §3-R1 리듬 초견 전략 (ko+en). 학술 인용: Palmer & Krumhansl (1990) DOI:10.1037/0096-1523.16.4.728. 이미지: Wikimedia Commons 2종 (Chopin Polonaise Op.53 + Piano practice, 960px thumbnail, curl HTTP 200 PASS). 누적 122편 (한 61 + 영 61).**
- 2026-05-26: **v21 — §1-4 초견과 청음 (ko+en). 학술 인용: Hayward & Gromko (2009) DOI:10.1177/0022429409332677. 이미지: Wikimedia Commons 1종 (Guidonian Hand 500px, curl HTTP 200 PASS) + BnF Gallica 1종 (Solfège des chanteurs G. Kuhn 1851, curl HTTP 200 PASS). 누적 130편 (실제 파일 기준 한 65 + 영 65).**
- 2026-05-28: **v22 — §3-33 청크 단위 인식 (ko+en). 학술 인용: Sloboda (1976) DOI:10.1080/14640747608400586 + Miller (1956) + Chase & Simon (1973). 이미지: Wikimedia Commons 2종 (Goldberg Variations Aria 1742 1st edition BnF + Chopin Nocturne Op.62-2 autograph manuscript, curl HTTP 200 PASS). 누적 134편 (한 67 + 영 67).**
- 2026-05-29: **v23 — §2-26 이음줄·붙임줄 차이 (ko+en). 학술 인용: Palmer (1989) DOI:10.1037/0096-1523.15.2.331. 이미지: Wikimedia Commons 2종 (Schubert Mass No.6 D944 autograph manuscript + Ties slurs and ligature comparison SVG, curl HTTP 200 PASS). 누적 136편 (한 68 + 영 68).**
