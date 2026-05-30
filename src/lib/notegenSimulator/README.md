# notegen-sim — 4-F 출제 결정 검증용 시뮬레이터

NoteGame.tsx의 `generateBatch` / `generateKeyBatch` 출제 결정을 React-free 시뮬레이터로 실행해
사람-친화 표·메트릭·의심 케이스로 검증한다. 4단계 출제 로직 변경 시 자동 회귀 테스트 자산.

## 실행

```bash
npm run notegen              # 5종 시나리오 전부, 처음/마지막 20턴 디테일
npm run notegen:full         # 5종 전부, 전체 turn 디테일
NOTEGEN_SCENARIO=B npm run notegen   # 시나리오 B만 (또는 A·C·D·E)
```

콘솔: 메트릭 표·adaptive 분포·음별 ASCII bar·의심 케이스·디테일 표.
JSON 저장: `test-results/notegen-{scenarioId}-{ISO timestamp}.json` (gitignore됨, 시나리오당 ~5MB).

## 시나리오 5종

| # | 레벨 | 사용자 모델 | 턴수 | 핵심 검증 |
|---|---|---|---|---|
| A | Lv 1-1 | perfect 0.8s | 1000 | soft 회피 위반 비율·warmup→boost 흐름 |
| B | Lv 5-2 G major | weak_on F#4·F#5 (+ weakScores 시드) | 500 | 조표·약점 가중·N+2 회복 |
| C | Lv 3-2 | random50 2.0s | 500 | reduce_weak 발동·큐 상한·N+2 적중 |
| D | Lv 4-1 | perfect 0.5s | 500 | boost_weak·streak 마스터 발동 |
| E | Lv 5-2 G major | Free random60 | 500 | Premium gating (weak_weighted=0), 조표 유지 |

## 메트릭 9종

| 메트릭 | 입력 | 의미 |
|---|---|---|
| `softAvoidViolationRate` | decisions | previousNotes[0] 동명 출제 비율 (n+2 제외) |
| `n2RecoveryCount` / `HitRate` | decisions | N+2 회복 source 건수/비율 |
| `weakWeightedDecisionCount` | decisions | weak_weighted source 결정 건수 (Free=0 검증) |
| `queueMaxViolations` | decisions | queueState.length > 3 occurrence (정상=0) |
| `streakMasteredNoteCount` | decisions | 마스터 상태 도달 distinct noteId 수 |
| `accidentalRatio` | **decisions** | 슬롯 결정 단위 조표 영향 음 비율 (재시도 bias X) |
| `weakSlotPickRateOnIds` | decisions, Set | weak_weighted 슬롯에서 targetIds 비중 |
| `noteDistribution` | events | noteId → count (ASCII bar 입력) |

`adaptiveModeTurns.<mode>`: SimResult.adaptiveModeHistogram에서 직접 (events 단위).

## 의심 케이스 자동 추출 (5종)

1. **soft-avoid-low-mult-picked** — `softAvoidMult < 0.5` 후보가 picked
2. **weak-slot-no-score** — weak_weighted 슬롯이지만 `weak_scores` 행 없음 (시드 누락 의심)
3. **streak-mastered-picked** — streakMastered=true 음표 출제 (정상이지만 추적)
4. **low-probability-pick** — `pickProbability < 1%` hit (저확률)
5. **consecutive-violation** — 직전 정답과 같은 음표 곧바로 재출제 (cross-batch dedup 회귀)

## 시나리오 추가

`src/lib/notegenSimulator/scenarios/scenarioX.ts` 생성 → `Scenario` 타입 export.
`scenarios/index.ts`의 `ALL_SCENARIOS`에 추가하면 `npm run notegen`이 자동 포함.

```ts
import { Scenario } from "./types";

export const scenarioF: Scenario = {
  name: "F",
  description: "...",
  simConfig: {
    level: 7,
    sublevel: 3,
    userModel: { kind: "random", correctRate: 0.8 },
    isPremium: true,
    maxTurns: 1000,
    seed: 42,
    cyclic: true,
  },
  expectedMetrics: [
    { id: "softAvoidViolationRate", label: "soft 회피", predicate: { kind: "lt", max: 0.05 } },
    // 신규 메트릭 id는 metrics.ts의 computeMetricValue에 case 추가
  ],
};
```

## 정책 parity 주의

NoteGame.tsx의 `generateBatch` / `generateKeyBatch`를 직접 import해서 사용 (옵션 A). 다음 hook은
React-free로 복제했으며 정책 판정은 `noteWeighting.ts`의 `computeStreakMultiplier` ·
`computeAdaptiveWeakRatio` 공유로 단일화:

- `SimSessionStreak` ← `useSessionStreakMastery`
- `SimAdaptive` ← `useAdaptiveDifficulty`

복제본 변경 시 production hook도 함께 갱신해야 한다 (파일 상단 주석 명시).

## 의도적 차이 — production과 다름

- **라이브 시스템 미모델** — 통계 수집 위해 항상 maxTurns 또는 all-stages-complete까지
- **final-retry phase 미지원** — regular phase 출제 결정에만 집중
- **cyclic 옵션** — stage 사이클 짧을 때(Lv1-1=30 notes) maxTurns까지 stage 상태만 reset.
  adaptive/sessionStreak/queue/prevNotes는 유지 (NoteGame.handleReplay와 다름)

## PickDecision 활성화

세션 시작 시 `_setPickDecisionEnabled(true)` + `clearPickDecisions()`, 종료 시
`_resetPickDecisionEnabled()`. 매 composeBatch마다 글로벌 버퍼(ring=1000) drain →
`allDecisions` 누적으로 장기 세션 결정 누락 방지.
