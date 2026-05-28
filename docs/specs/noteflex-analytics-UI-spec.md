# Noteflex 분석 보고서 UI 스펙 (v1)

> 작성: 2026-05-26 · `noteflex-analytics-report-spec.md`(엔진)의 UI companion
> 권장 위치: `docs/specs/analytics-UI-spec.md`
> 구현 단계 = 빌드 ③ (보고서 UI + 코칭 다이얼로그). 스택: React+TS+Tailwind, 차트 = recharts.

---

## 0. 원칙

- **시스템이 결론을 먼저 말한다.** 통계 나열 X → "오늘 집중할 약점 1개"를 자동으로 위에 띄움. 유저가 파고들 필요 없게.
- **즉시 시각 반응**: delta는 색+화살표(▲녹/▼적), 약점 칩은 error_rate로 색 농도, 차트는 mount 시 애니메이션.
- **compact + 여백**: 카드 단위, 모바일 우선(PWA 좁은 뷰포트 기준 설계). 한 화면에 핵심만.
- **카피는 짧고 단단하게.** "낮은음 Gb3 — 5번 다 놓침" 식. AI 과장·메타 표현 금지.
- 색: 배경 크림 #faf8f0, 강조 브랜드레드 #D3224E, 성공/향상 녹색 계열, 약점 적색 농도 스케일.

---

## 1. 정보 구조 / 내비게이션

- 대시보드 안 **"분석" 섹션** → 상단 세그먼트 탭 `일간 · 주간 · 월간`.
  - Free: 일간만 활성, 주간·월간 탭은 자물쇠(블러 미리보기 + 업셀).
  - Pro: 셋 다.
- **세션 종료 코칭 다이얼로그**: 게임 결과 모달 안에 통합(새 모달 X). "풀 보고서 보기" → 대시보드 분석 일간 탭으로.

### 데이터 페치 (RPC → 화면)
| 화면 | RPC | 비고 |
|---|---|---|
| 일간 | `get_daily_report(date)` | 오늘은 라이브 계산, 과거일은 롤업 읽기 |
| 주간 | `get_weekly_report(week_start)` | 100% 롤업 |
| 월간 | `get_monthly_report(year, month)` | 100% 롤업 |
| 코칭 다이얼로그 | `get_daily_report(today)` 또는 방금 세션 + baseline | compact 슬라이스 |
| 약점 칩/상세 | `get_user_note_status(status?)` | per-note 상태(졸업·약점·학습중) |

> RPC 반환은 JSONB. 아래 필드명은 **롤업 테이블 컬럼 기준**(get_*_report가 그대로 내보낸다고 가정) — 와이어링 시 실제 RPC 출력 키 확인 후 확정.

---

## 2. 공통 컴포넌트 & 상태

**상태 4종 (모든 탭 공통)**
- **loading**: 스켈레톤(카드 윤곽 shimmer). lazy loading X, 첫 페인트 빠르게.
- **grace("쌓이는 중")**: §8. 빈 화면 대신 진행 게이지 + 해금 D-day.
- **error**: 짧은 안내 + 재시도 버튼. 통계 깨졌다고 무서운 문구 X.
- **tier-lock**: Free가 Pro 탭 진입 시 — 블러된 미리보기 + 자물쇠 + 업셀(§7).

**재사용 컴포넌트**
- `MetricCard` — 큰 숫자 + 라벨 + delta(▲▼ vs baseline)
- `WeakNoteChip` — 음표+octave+clef, error_rate 색 농도, tap 시 상세
- `TrendChart` — recharts Line, 2축(정확도·속도). 주/월 공용, 기간만 교체
- `ComparisonBar` — 이번 vs 지난(가로 바 2개)
- `GraceGauge` — 진행률 바 + "N일/주 더"
- `LockOverlay` — 블러 + 자물쇠 + 업셀 카피

---

## 3. 일간 (Free) — 진단·행동

**필드 매핑**: `overall_accuracy`, `avg_reaction_ms`, `median_reaction_ms`, `sessions_count`, `streak_days`, `baseline_accuracy`, `baseline_avg_reaction_ms`, `weak_notes_top[]`, `per_note`

**레이아웃 (위→아래)**
1. **헤드라인 한 줄** (자동 결론): weak_notes_top[0] 기반.
   예: *"오늘은 낮은음 **Gb3**가 약점 — 5번 다 놓쳤어요."* (없으면 "오늘 깔끔했어요" 톤)
2. **MetricCard 3개** (가로 스크롤/그리드):
   - 정확도 `overall_accuracy` + delta vs `baseline_accuracy` (▲▼)
   - 평균 속도 `avg_reaction_ms` (ms→초 표시) + delta vs `baseline_avg_reaction_ms` (속도는 ↓가 향상=녹색)
   - 세션 수 `sessions_count` + 스트릭 배지 `streak_days`🔥
3. **오늘의 약점 음표** — `weak_notes_top` 상위 3~5개를 `WeakNoteChip`으로. error_rate 높을수록 진한 적색. (median_ms=timeLimit값이면 "시간초과" 라벨)
4. **세션별 미니 리스트** — 각 세션 정확도·속도·레벨 한 줄씩.
5. **주간 티저** (Free 한정, §7) — 하단에 블러된 주간 차트 + "이번 주 패턴이 쌓이면 해제" 자물쇠.

> 신규 유저도 1일차부터 꽉 참(라이브 today 슬라이스). delta는 baseline 없으면(신규) 숨김.

---

## 4. 주간 (Pro) — 패턴·습관

**필드**: 일자별 `per_day`(롤업이 day rows 7개) 또는 weekly 롤업의 추세 배열, `weak_notes_top`(주간=지속 약점), `active_days`, `total_duration_seconds`, 이번주 vs 지난주 비교용 직전 주 롤업.

**레이아웃**
1. **추세 한 줄** (자동 결론): 기울기 기반. *"이번 주 정확도 ▲6%p — 오르는 중."*
2. **TrendChart** — 7일 정확도(좌축)·속도(우축) 라인. 점 부족한 날은 빈 점 처리.
3. **연습 리듬** — 요일별 활동 점/히트맵 (빠진 날 회색). `active_days/7`.
4. **주간 약점 top** — `weak_notes_top`(주간 윈도우=노이즈 제거된 진짜 약점). **이게 약점 훈련(2b)의 입력**임을 UI에서도 "이 음표들로 훈련 시작" CTA로 연결.
5. **ComparisonBar** — 이번 주 vs 지난 주 (정확도·속도·연습량).
6. <7일이면 §8 grace.

---

## 5. 월간 (Pro) — 성장·정체

**필드**: 주차별 추세, `graduated_count`/`graduated_notes`, `regressed_count`/`regressed_notes`, 레벨 진행, `active_days`(월).

**레이아웃**
1. **성장 한 줄**: *"이번 달 음표 **7개** 졸업 🎓"* (`graduated_count`).
2. **주차 추세 차트** — 4~5주 정확도·속도.
3. **졸업/퇴보 음표** — `graduated_notes` 칩(녹색), `regressed_notes` 칩(주의). 약점→정상 전환의 성취감.
4. **마일스톤 타임라인** — 레벨 통과·스트릭 기록.
5. **꾸준함** — 월 `active_days` 캘린더 점.
6. 출시 후 ~한 달은 거의 §8 grace가 본문. "4주 쌓이면 성장 궤적 해금."

---

## 6. 세션 종료 AI 코칭 다이얼로그

기존 게임 결과 모달 **안에** 코칭 영역으로 통합(별도 모달 X). compact, 3~4개만.

**구성**
- **코칭 한 줄** (규칙 기반, `generateCoachingComment` 확장): *"낮은음 G2가 평소보다 0.8초 느렸어요 — 다음 세션에서 집중."*
- **이번 세션 vs 평소** delta 2~3개 (정확도·속도) — 세션값 vs `baseline_*`. ▲▼ 색.
- **약점 음표 1~2** — `weak_notes_top` 상위.
- **"풀 보고서 보기"** → 대시보드 일간.
- 티어: **Free=후킹**(핵심 + "주간 패턴은 Pro" 한 줄), **Pro=풀**.

> 모달 정책 준수: backdrop·ESC 닫기 X, 버튼으로만. 첫 로드 100ms / 인터랙션 16ms.

---

## 7. 티어 게이팅 & 업셀

- **Free**: 일간 + 코칭(후킹). 주간·월간 탭 = `LockOverlay`(블러 미리보기 + 자물쇠).
- **Pro**: 전부.
- **업셀 카피 = 미래가치 프레이밍** (결제 직후 빈 화면 방지): "오늘 틀린 음표, 이번 주 내내 그랬을까? — **주간 패턴은 Pro**." / 잠금 해제 후에도 데이터 적으면 §8 grace를 보여줘 사기감 방지.
- **담백하게 한 줄.** 결핍 과하게 건드리지 말 것(Jobs 결).
- 미구현 기능은 업셀에 노출 금지(심사·환불 리스크).

---

## 8. Grace "쌓이는 중" 상태

빈 화면 = 버그처럼 보임 → **퀘스트로 전환.**
- `GraceGauge`: 진행률 바 + 해금까지 남은 일/주.
  - 주간: `주간 추세  ██░░░░  3일 더`
  - 월간: `성장 궤적  █░░░░░  4주 데이터 필요 (1주차 진행 중)`
- compact 카피. 듀오링고식 "매일 채우는" 루프.
- 일간은 grace 거의 없음(1일차부터 참). 주간 <7일, 월간 <4주에서 작동.

---

## 9. 시각 디자인 토큰

- 배경 크림 #faf8f0, 카드 흰색+옅은 그림자, 강조 #D3224E.
- delta: 향상=녹색(#1a9d52 류)·악화=적색·중립=회색. 속도는 ↓가 향상이니 색 반전 주의.
- 약점 칩 적색 농도: error_rate 0→1을 옅은→진한 적색 스케일.
- 숫자는 크게(MetricCard), 라벨은 작게. 폰트 위계 분명히.
- 차트: recharts. 축 최소화, 격자 옅게, 라인 굵게. 모바일에서 라벨 겹침 방지.
- 애니메이션: 카드·차트 mount 시 짧은 fade/grow(즉시 시각 반응). 과하지 않게.

---

## 10. 컴포넌트 분해 (Code 구현용)

```
AnalyticsSection/
  AnalyticsTabs            # 일/주/월 세그먼트 + 티어 게이팅
  DailyReport              # §3
  WeeklyReport             # §4
  MonthlyReport            # §5
  components/
    MetricCard
    WeakNoteChip
    TrendChart             # recharts, 주/월 공용
    ComparisonBar
    RhythmHeatmap          # 주간 요일별
    MasteryMilestones      # 월간
    GraceGauge
    LockOverlay            # 티어 잠금 + 업셀
  hooks/
    useDailyReport(date)   # get_daily_report
    useWeeklyReport(start) # get_weekly_report
    useMonthlyReport(y,m)  # get_monthly_report
    useNoteStatus(status?) # get_user_note_status
CoachingPanel              # 게임 결과 모달 내 코칭 영역 (§6)
```

**delta 계산 (프론트)**: `(value - baseline) / baseline`. baseline 없으면(신규 유저) delta 숨김. 속도 delta는 부호 반전(낮을수록 향상).

**JSONB 파싱**: `weak_notes_top`은 배열 `[{clef, avg_ms, octave, attempts, note_key, median_ms, error_rate, weak_score}]` — 검증된 실제 구조. 칩에 note_key+octave+clef, 색은 error_rate.

---

## 11. v1 제외 / 출시 후

- 워밍업/피로 곡선(세션 내) — 일간 v1.1.
- 또래 백분위, 마이크로프리즈/지터.
- 약점 칩 tap → 즉시 약점 훈련 진입(2b 연동 후).
- 코칭 LLM 호출(규칙 기반 후 업그레이드).

---

*확정 시 docs/specs/에 추가. 엔진 스펙과 한 쌍.*
