# Noteflex — Claude Code 작업 규약

## 프로젝트
음악 초견(sight-reading) 훈련 게임 SaaS. 운영 중(noteflex.app), 솔로 개발.
스택: React + TypeScript + Vite + Tailwind + Supabase + Vercel + Paddle + AdSense + Sentry, PWA, i18n(ko/en).

## 세션 시작 의례 (매 세션 필수)
1. docs/active/PENDING_BACKLOG.md — 할 일과 우선순위
2. docs/active/DECISIONS.md — 확정 결정·함정·재논의 금지 사항
3. 작업 영역에 해당하는 dev_doc 읽기:
   - 분석/리포트 → docs/active/dev_docs/ai-report.md
   - 게임 엔진 → docs/active/dev_docs/game-engine.md
   - 클리어 조건·점수 → docs/active/dev_docs/scoring-rules.md
4. 해당 영역 코드를 직접 읽어 현재 상태 파악.
원칙: "현재 구현"의 진실은 코드. 문서와 코드가 다르면 코드가 맞고, 충돌 사실을 보고.
docs/archive/ 는 보관용 — 현재 상태의 근거로 사용 금지.

## 절대 규칙
- "박다" 동사와 모든 활용형 사용 금지 — 코드, 주석, 문서, 커밋 메시지, 보고 전체.
- git add . / git commit -a 금지. 변경 파일만 명시적으로 stage.
- git push 금지 (사용자가 직접 수행).
- 파일 삭제는 명시적 지시가 있을 때만.
- 지시 범위 밖의 동작 변경 금지.
- URL·DOI·사실관계 임의 생성 절대 금지. 확인 불가하면 멈추고 보고.
- Supabase 대시보드 설정값은 코드로 판단 불가 — 추측하지 말고 "대시보드 확인 필요"로 분리 보고. (운영 프로젝트 ref: rcwydfzkuhfcnnbqjmpp)

## 게임 영역 보호 규칙
- 게임 정책·클리어 기준·점수 로직은 사용자 확인 없이 변경 금지.
- 동기화 앵커 = handleCountdownComplete. 노트/버튼/사운드/스와이프 desync 무관용.
- 결과 모달은 backdrop/ESC로 닫히지 않음(버튼만). 모달 lazy load 금지. 화면 전환 무지연.
- 자동 테스트 통과 ≠ 완료. 게임 관련 변경은 인게임 수동 검증이 필수이며(사용자 수행), 보고에 검증 시나리오를 포함할 것.

## 블로그 작성 불변 사항
(상세 절차는 사용자가 제공하는 블로그 프롬프트를 따름. 아래는 절차와 무관하게 항상 유효한 불변. **검수 0 전제** — 사용자가 글을 읽지 않고 그대로 푸시한다는 가정으로 정책이 설계됨.)
- 작성 로그: docs/active/BLOG_LOG.md / 주제 목록: docs/marketing/blog_topics_100.md
- URL·sitemap 기준 = frontmatter slug 단일 기준. 영문 소문자-하이픈, ko·en 동일 slug(hreflang 페어), 날짜·언어 prefix 없음.
- **학술·논문·연구 인용 전면 금지.** 검수 없이 푸시되므로 출처 환각·DOI 오류·인용 정보 부정확 위험이 사이트 신뢰도·AdSense 노출에 치명적. "(저자, 연도)" 본문 인용, `## 참고 문헌`/`## References` 섹션, DOI 표기, 저자·저널 언급 모두 작성 금지. 근거는 위키 수준으로 확정된 음악 사실·규칙 그 자체로 충분히 서술.
- **토픽 화이트리스트**: 음표·쉼표·박자·박자표·음정·음계·조표·셈여림·기호의 정의·규칙 등 **위키 수준으로 확정된 음악 기초 사실에 한정**. 음악사 해석·작곡가 일화·생애·논쟁·주관적 평가·특정 연도·특정 인물을 핵심으로 삼는 토픽은 환각 위험으로 작성 금지 — blog_topics_100.md 토픽 목록에 있더라도 화이트리스트 미부합이면 건너뜀.
- **본문 끝 H2 마커는 2종("## 이미지 출처", "## Image Sources") 중 정확 일치** — BlogPostCTA 자동 삽입 앵커. 이 H2가 본문에 없으면 CTA가 글 맨 끝으로 떨어지는 회귀 → 누락 금지. (코드 측 splitter `src/pages/BlogPost.tsx`는 과거 호환을 위해 4종 markers 잔존하나, **신규 작성에선 2종만 사용**.)
- 발행 빈도: **주 1~2주제(ko+en 짝)**. 과거 "하루 1주제" 페이스는 폐기.
- 이미지는 허용 출처만(Wikimedia·British Library·LoC·Met·BnF·NYPL·Smithsonian·IMSLP·Mutopia·PLOS·PMC), Pexels/Unsplash/Pixabay/Freepik 금지, 모든 이미지 curl HTTP 200 검증, 글당 2장 이상.
- frontmatter(title·description·slug·coverImage)는 빌드 시 sitemap·블로그 프리렌더(글별 OG)가 소비하므로 누락 금지.

## 보고 형식
- 변경 요약(파일별) + stage 목록 + (게임/UI 변경 시) 수동 검증 시나리오.
- 원인 조사 요청 시: 판정을 먼저, 상세는 뒤에.
- 모호한 지점은 임의 진행하지 말고 가장 그럴듯한 해석을 명시한 뒤 진행하거나, 판단 불가 시 멈추고 질문.
