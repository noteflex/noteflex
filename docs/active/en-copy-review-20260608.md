# English Copy Review — 2026-06-08

> 목적: HN 게시(수요일) 전 영어 카피 전수 감수. 코드·strings 파일 변경 없음 — 보고만.
> 검토 범위: `src/i18n/strings.ts` `en` 객체 전체 + Pricing.tsx·FAQ.tsx·Index.tsx의 하드코딩 카피.
> 약관 4종 제외.

---

## 우선순위 기호

- **HIGH** — HN 게시 전 필수 수정 (문법 오류·오해·제품 신뢰 훼손)
- **MID** — 가능하면 수정 (어색하지만 이해는 가능)
- **LOW** — 여유 있을 때 (미세 다듬기)

---

## 항목별 검토

---

### 1. `premiumRequired.subscribe`
**위치**: strings.ts — `en.premiumRequired.subscribe`  
**현재**: `"Go to subscribe →"`  
**제안**: `"Subscribe →"` 또는 `"See plans →"`  
**이유**: "Go to subscribe"는 문법적으로 비원어민 티가 나는 구조. 동사+to+동사 형태로 버튼 레이블에 어울리지 않음. "Subscribe" 한 단어로 충분.  
**우선순위**: **HIGH**

---

### 2. `authModal.signupStep2`
**위치**: strings.ts — `en.authModal.signupStep2`  
**현재**: `"② Email Verify"`  
**제안**: `"② Verify Email"`  
**이유**: "Email Verify"는 영어 어순 오류 (명사+동사 순서). "Verify Email" 또는 "② Email Verification"이 자연스러움.  
**우선순위**: **HIGH**

---

### 3. `authModal.giftBullet2`
**위치**: strings.ts — `en.authModal.giftBullet2`  
**현재**: `"Free access to all levels"`  
**제안**: `"Free access to Levels 1–5"` 또는 `"Access Levels 1–5 for free"`  
**이유**: Free 플랜은 Lv1-5까지만 접근 가능 (Lv6-7은 Premium 전용). "all levels"는 사실과 다른 약속. HN 사용자가 가입 후 레벨 잠금을 보면 신뢰가 즉각 손상됨.  
**우선순위**: **HIGH**

---

### 4. `premiumDialog.title`
**위치**: strings.ts — `en.premiumDialog.title`  
**현재**: `"✨ Unlock All Levels with Pro"`  
**제안**: `"✨ Unlock All Levels with Premium"`  
**이유**: 제품명은 사이트 전체에서 "Premium"으로 통일돼 있음 (헤더, Pricing 페이지, 결제 화면, dailyLimit 등). 이 한 곳만 "Pro"를 사용해 용어 혼용 발생. HN 개발자는 이런 일관성 결여를 신뢰 결함으로 읽음.  
**우선순위**: **HIGH**

---

### 5. `gameDialogs.statAvgReaction`
**위치**: strings.ts — `en.gameDialogs.statAvgReaction`  
**현재**: `"Avg response"`  
**제안**: `"Avg reaction"`  
**이유**: 나머지 앱 전체가 "reaction"을 사용 (`kpiAvgReaction: "Avg reaction"`, `tableAvgReaction: "Avg reaction"`, `analytics.metricAvgReaction: "Avg Reaction"` 등). 게임 결과 모달만 "response"로 달라 용어 불일치.  
**우선순위**: **HIGH**

---

### 6. `authCallback.deletionCompleteDesc` — 브랜드 이름 오기
**위치**: strings.ts — `en.authCallback.deletionCompleteDesc`  
**현재**: `"Thank you for using NoteFlex.\nYou can restore your account within 30 days."`  
**제안**: `"Thank you for using Noteflex.\nYou can restore your account within 30 days."`  
**이유**: 브랜드 이름이 "NoteFlex" (중간 대문자 F)로 잘못 표기. 사이트 전체에서 "Noteflex"를 사용. URL(noteflex.app)·SEO·저작권 표기 모두 소문자 f.  
**우선순위**: **HIGH**

---

### 7. `analytics.weeklyDeltaMsFaster/Slower` vs `monthlyDeltaMsFaster/Slower` — 화살표 반전·불일치
**위치**: strings.ts — `en.analytics`  
**현재**:
```
weeklyDeltaMsFaster:  "▲{n}ms faster"   ← ▲ = 빠름 (반응시간↓ = 좋음)
weeklyDeltaMsSlower:  "▼{n}ms slower"   ← ▼ = 느림
monthlyDeltaMsFaster: "▼{n}ms faster"   ← ▼ = 빠름
monthlyDeltaMsSlower: "▲{n}ms slower"   ← ▲ = 느림
```
**제안**: 화살표 사용 통일. 반응시간이 줄면 "better/faster" → 아이콘 의미 혼동을 피하려면 화살표 대신 수치 표기만:
```
weeklyDeltaMsFaster:  "{n}ms faster"
weeklyDeltaMsSlower:  "{n}ms slower"
monthlyDeltaMsFaster: "{n}ms faster"
monthlyDeltaMsSlower: "{n}ms slower"
```
또는 ▼ = 반응시간 감소 = 좋음으로 일관성 있게 통일.  
**이유**: 주간에는 ▲=faster, 월간에는 ▼=faster로 섹션 간 반전. ▲ms는 통상적으로 "반응시간 증가 = 느려짐"을 의미하므로, ▲ms faster 조합은 개발자가 즉각 혼동. 두 섹션이 서로 반대 관례를 써 둘 다 틀림.  
**우선순위**: **HIGH**

---

### 8. `dailyLimit.guest.values[0]`
**위치**: strings.ts — `en.dailyLimit.guest.values[0]`  
**현재**: `"7 free sessions daily (more than 2× now)"`  
**제안**: `"7 free sessions per day"` 또는 `"7 sessions per day, free"`  
**이유**: "(more than 2× now)"는 컨텍스트 없이 무엇의 2배인지 알 수 없음. 이전 한도(3회 추정)를 모르는 신규 HN 방문자에게는 의미 없는 괄호. 오히려 의아하게 보임.  
**우선순위**: **HIGH**

---

### 9. `authModal.signupTitle`
**위치**: strings.ts — `en.authModal.signupTitle`  
**현재**: `"Start Mastering Sight-Reading"`  
**제안**: `"Master Sight-Reading."` 또는 `"Read Music. Fast."`  
**이유**: "Start Mastering"은 2단어 동사 연속으로 무겁고 늘어짐. 스티브잡스 톤 기준 위반. 짧고 단단한 선언형이 적합.  
**우선순위**: **MID**

---

### 10. `authModal.signupSubtitle`
**위치**: strings.ts — `en.authModal.signupSubtitle`  
**현재**: `"Create your account and take the first step"`  
**제안**: `"One step to start."` 또는 `"Takes 5 seconds."`  
**이유**: "take the first step"은 동기부여 포스터 클리셰. 스티브잡스 톤 위반.  
**우선순위**: **MID**

---

### 11. `authModal.signupEmailPlaceholder`
**위치**: strings.ts — `en.authModal.signupEmailPlaceholder`  
**현재**: `"Enter the email you'd like to use"`  
**제안**: `"Your email address"`  
**이유**: 이메일 필드 placeholder로 과하게 장황. 표준적인 "Email address" 또는 "Your email"로 충분.  
**우선순위**: **MID**

---

### 12. `authModal.giftBullet3`
**위치**: strings.ts — `en.authModal.giftBullet3`  
**현재**: `"Analyze weak notes via stats"`  
**제안**: `"Spot your weak notes with data"` 또는 `"Weak-note analysis"`  
**이유**: "via stats"는 어색. "via"는 경로 전치사인데 stats가 분석 도구인지 결과인지 불명확. 앱 내 다른 곳은 "weak-note analysis" 용어를 사용.  
**우선순위**: **MID**

---

### 13. `gameDialogs.clearDesc`
**위치**: strings.ts — `en.gameDialogs.clearDesc`  
**현재**: `"Clean clear again. Ready for another challenge?"`  
**제안**: `"Another clean run. Ready for more?"`  
**이유**: "Clean clear" 연속이 어색 (같은 의미의 단어 반복). "Clean run" 또는 "Clean pass"가 더 자연스러운 영어.  
**우선순위**: **MID**

---

### 14. `gameDialogs.pauseBody`
**위치**: strings.ts — `en.gameDialogs.pauseBody`  
**현재**: `"Leaving now discards this round's progress, and today's session still counts as used."`  
**제안**: `"Quitting discards this round. Your session still counts."`  
**이유**: 두 절을 and로 잇는 복합문이 모달 알림치고 길고 무거움. 짧게 끊어야 읽힘.  
**우선순위**: **MID**

---

### 15. `diagnosis.vulnerabilityTitle`
**위치**: strings.ts — `en.diagnosis.vulnerabilityTitle`  
**현재**: `"Vulnerability analysis"`  
**제안**: `"Weakness analysis"`  
**이유**: 앱 전체에서 "weak notes", "weakness analysis" 표현을 사용. 이 한 곳만 "vulnerability"로 달라짐. "vulnerability"는 보안 문맥에서 더 자연스러운 단어로, 음악 앱에서 독자를 멈추게 함.  
**우선순위**: **MID**

---

### 16. `diagnosis.batchPending`
**위치**: strings.ts — `en.diagnosis.batchPending`  
**현재**: `"⏰ No analysis data yet. First analysis completes tomorrow at 06:00 (KST)."`  
**제안**: `"⏰ No analysis data yet. First analysis runs tomorrow at 06:00 KST (UTC+9)."`  
**이유**: 국제 방문자(HN)는 KST를 모를 수 있음. "UTC+9" 병기로 즉각 이해 가능하게.  
**우선순위**: **MID**

---

### 17. `dashboard.aiFeedbackDesc`
**위치**: strings.ts — `en.dashboard.aiFeedbackDesc`  
**현재**: `"Reviews your playing and suggests comments and next goals"`  
**제안**: `"Reviews your playing and suggests next goals"`  
**이유**: "suggests comments and next goals" — "comments"는 구체적이지 않은 목적어. "suggests next goals"만으로 의미 충분하며 더 간결.  
**우선순위**: **MID**

---

### 18. `dailyLimit.free.title`
**위치**: strings.ts — `en.dailyLimit.free.title`  
**현재**: `"You've finished today's seven."`  
**제안**: `"You've used all 7 sessions today."` 또는 `"That's your 7 for today."`  
**이유**: "today's seven"은 비원어민 구어체 냄새. 앞서 "That's it for today." (guest 버전)와의 어조 불일치도 있음. 직접적인 표현이 더 명확.  
**우선순위**: **MID**

---

### 19. `Pricing.en.freeFeatures[0]`
**위치**: Pricing.tsx — `CONTENT.en.freeFeatures[0]`  
**현재**: `"Level 1–5 Sub1 sequential unlock"`  
**제안**: `"Levels 1–5, first sublevel each"` 또는 `"Sequential unlock: Lv 1–5, sublevel 1"`  
**이유**: "Sub1 sequential unlock"은 내부 용어. HN 방문자가 "Sub1"이 무엇인지 알 수 없음.  
**우선순위**: **MID**

---

### 20. `header.signIn`
**위치**: strings.ts — `en.header.signIn`  
**현재**: `"Sign In / Sign Up"`  
**제안**: `"Sign in"` (기존 사용자 우선, 모달 내에서 분기)  
**이유**: 두 동작을 "/"로 병기하면 버튼이 아닌 링크 토글처럼 보임. 모달에서 이미 Sign In / Sign Up 분기를 처리하므로 진입 버튼은 하나의 행동을 가리키는 게 UX상 깔끔. HN 개발자는 "/" 구분 버튼을 어색하게 인지.  
**우선순위**: **MID**

---

### 21. `premiumRequired.title`
**위치**: strings.ts — `en.premiumRequired.title`  
**현재**: `"Premium-only level"`  
**제안**: `"Premium only"` 또는 `"Premium level"`  
**이유**: "Premium-only level"의 "level"이 하이픈 복합어와 결합돼 어색. 모달 타이틀이므로 짧게.  
**우선순위**: **MID**

---

### 22. `profile.deleteConfirmTitle`
**위치**: strings.ts — `en.profile.deleteConfirmTitle`  
**현재**: `"Are you sure you want to delete?"`  
**제안**: `"Delete your account?"` 또는 `"Are you sure you want to delete your account?"`  
**이유**: "delete"가 목적어 없이 끝남. "Delete your account?" 형태가 표준.  
**우선순위**: **MID**

---

### 23. `Pricing.en.premiumFeatures[6]`
**위치**: Pricing.tsx — `CONTENT.en.premiumFeatures[6]`  
**현재**: `"Early access to new features — always one step ahead"`  
**제안**: `"Early access to new features"` 또는 `"Beta features, first"`  
**이유**: "always one step ahead"는 마케팅 클리셰. 스티브잡스 톤 기준으로 늘어지는 수식어.  
**우선순위**: **MID**

---

### 24. `game.backToHome`
**위치**: strings.ts — `en.game.backToHome`  
**현재**: `"Back to Home 🔥"`  
**제안**: `"Back to Home"`  
**이유**: 🔥 는 스트릭이나 성취와 관련된 이모지인데 게임 종료/결과 화면의 귀환 버튼에는 의미 없이 붙어 있음. LOW지만 맥락 없는 이모지는 신뢰를 깎음.  
**우선순위**: **LOW**

---

### 25. `blogCta.subs[6]`
**위치**: strings.ts — `en.blogCta.subs[6]`  
**현재**: `"unless you try."`  
**제안**: `"Unless you try."`  
**이유**: 문장 시작이므로 대문자. "You'll never know. / unless you try." 조합에서 소문자 시작은 의도적 소문자(e.e. cummings 스타일)가 아니면 오타로 읽힘.  
**우선순위**: **LOW**

---

### 26. `profile.deleteSendButton`
**위치**: strings.ts — `en.profile.deleteSendButton`  
**현재**: `"Send deletion confirmation email"`  
**제안**: `"Send confirmation email"`  
**이유**: 삭제 맥락이 이미 섹션 제목("Delete Account")에서 명확하므로 버튼에 "deletion" 반복 불필요. 버튼 레이블이 너무 김.  
**우선순위**: **LOW**

---

### 27. `profile.nicknamePlaceholder`
**위치**: strings.ts — `en.profile.nicknamePlaceholder`  
**현재**: `"3–20 chars, lowercase letters/digits/underscore"`  
**제안**: `"3–20 chars · lowercase, numbers, _"`  
**이유**: "lowercase letters/digits/underscore" — "/" 구분이 목록인지 or 관계인지 불명확. "·" 또는 쉼표로 끊으면 더 빠르게 읽힘.  
**우선순위**: **LOW**

---

### 28. `lockedByProgress.description`
**위치**: strings.ts — `en.lockedByProgress.description`  
**현재**: `"Sequential practice is the most effective way to build sight-reading skills. Take it step by step."`  
**제안**: `"Sequential practice is the most effective way to build sight-reading skills."`  
**이유**: "Take it step by step."은 앞 문장을 반복하는 클리셰. 제거해도 의미 손실 없음.  
**우선순위**: **LOW**

---

### 29. `dashboard.newUserTitle`
**위치**: strings.ts — `en.dashboard.newUserTitle`  
**현재**: `"Let's start your music journey"`  
**제안**: `"Your first session starts here"` 또는 `"Start your first session"`  
**이유**: "music journey"는 온보딩 문구의 전형적 클리셰. 제품 톤(단단하고 직접적)과 어울리지 않음.  
**우선순위**: **LOW**

---

### 30. `levelSelect.levels` — 레벨 레이블 용어
**위치**: strings.ts — `en.levelSelect.levels[4]`, `[5]`  
**현재**: `{ name: "Advanced", label: "Sharp mastery (♯)" }`, `{ name: "Expert", label: "Flat mastery (♭)" }`  
**제안**: `"Sharps (♯)"`, `"Flats (♭)"` 또는 `"Sharp practice (♯)"`, `"Flat practice (♭)"`  
**이유**: "mastery"가 레벨 이름("Master")과 중복 사용돼 레벨 체계가 혼란스럽게 읽힐 수 있음.  
**우선순위**: **LOW**

---

### 31. `gameDialogs.passedTitle` vs `clearTitle` — 과거형 불일치
**위치**: strings.ts — `en.gameDialogs.passedTitle`, `clearTitle`  
**현재**: `"🎉 {label} cleared!"` / `"✅ {label} clear"`  
**제안**: `clearTitle`을 `"✅ {label} cleared"` 또는 `"✅ {label} — clean"`으로 통일  
**이유**: passedTitle은 과거형("cleared!"), clearTitle은 형용사 형태("clear"). 동일 맥락(결과 모달)에서 어법이 달라 비원어민 느낌.  
**우선순위**: **LOW**

---

## HIGH 우선순위 요약

| # | 위치 | 현재 문구 | 제안 | 문제 |
|---|------|----------|------|------|
| 1 | `premiumRequired.subscribe` | `"Go to subscribe →"` | `"Subscribe →"` | 문법 오류 |
| 2 | `authModal.signupStep2` | `"② Email Verify"` | `"② Verify Email"` | 어순 오류 |
| 3 | `authModal.giftBullet2` | `"Free access to all levels"` | `"Free access to Levels 1–5"` | 사실 오류 (오해 유발) |
| 4 | `premiumDialog.title` | `"… with Pro"` | `"… with Premium"` | 용어 불일치 (전체 앱은 "Premium") |
| 5 | `gameDialogs.statAvgReaction` | `"Avg response"` | `"Avg reaction"` | 용어 불일치 (나머지는 "reaction") |
| 6 | `authCallback.deletionCompleteDesc` | `"NoteFlex"` | `"Noteflex"` | 브랜드명 오기 |
| 7 | `analytics.weeklyDeltaMsFaster/Slower` vs `monthly…` | ▲/▼ 방향 불일치 | 화살표 제거 또는 방향 통일 | 주간·월간 간 화살표 반전 |
| 8 | `dailyLimit.guest.values[0]` | `"(more than 2× now)"` | 괄호 삭제 | 컨텍스트 없는 비교 수치 |

---

*검토자: Claude Sonnet 4.6 — 2026-06-08*  
*변경 파일 없음. 이 보고서만 생성.*
