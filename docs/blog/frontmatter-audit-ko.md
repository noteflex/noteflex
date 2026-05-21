# 한국어 블로그 Frontmatter 감사 리포트

- **감사 일자**: 2026-05-21
- **대상 경로**: `src/content/blog/ko/`
- **총 파일 수**: 61편
- **keywords 자동 추가**: 0건 (전 파일 5개 이상 보유)
- **실제 파일 수정**: 없음

---

## 요약 (우선순위별)

### 🔴 즉시 조치 필요 (8건) — excerpt 필드 사용 중, description 누락

`description` 대신 `excerpt` 필드를 사용 중인 파일 8편.  
Astro content schema가 `description`을 필수로 요구하는 경우 빌드 오류 발생 가능.  
`excerpt` → `description` 키 교체가 필요하나, 본 감사에서는 규칙상 frontmatter 변경 금지(keywords 추가 제외)로 인해 수동 조치 필요.

| 파일명 | excerpt 길이(자) | 비고 |
|---|---|---|
| `2026-05-05-chunk-based-sight-reading.md` | 75 | description 필드 없음 |
| `2026-05-05-daily-5min-sight-reading-routine.md` | 61 | description 필드 없음 |
| `2026-05-06-key-signatures-explained.md` | 98 | description 필드 없음 |
| `2026-05-06-note-recognition-speed.md` | 89 | description 필드 없음 |
| `2026-05-07-sight-reading-practice-time.md` | 77 | description 필드 없음 |
| `2026-05-07-time-signatures-explained.md` | 124 | description 필드 없음 |
| `2026-05-08-automaticity-in-sight-reading.md` | 66 | description 필드 없음 |
| `2026-05-08-note-values-explained.md` | 79 | description 필드 없음 |

**조치**: 각 파일에서 `excerpt:` → `description:` 으로 키 이름 변경 (값 그대로 유지).

---

### 🟡 권고 사항 (53건) — description 길이 120자 미만

기준: description 120~170자 권장.  
120자 미만이면 검색 결과 스니펫이 짧게 잘릴 수 있음.

| 파일명 | description 길이(자) |
|---|---|
| `2026-04-30-musical-staff-principle.md` | 89 |
| `2026-04-30-sight-reading-basics.md` | 88 |
| `2026-05-01-clef-guide.md` | 95 |
| `2026-05-01-sight-reading-five-impacts.md` | 105 |
| `2026-05-02-grand-staff-explained.md` | 76 |
| `2026-05-02-noteflex-mission.md` | 91 |
| `2026-05-02-sight-reading-7-principles.md` | 90 |
| `2026-05-03-forgetting-curve-and-spaced-repetition.md` | 99 |
| `2026-05-03-reading-ledger-lines.md` | 94 |
| `2026-05-03-reading-music-real-meaning.md` | 102 |
| `2026-05-04-accidentals-explained.md` | 104 |
| `2026-05-04-how-to-measure-sight-reading-skill.md` | 93 |
| `2026-05-09-reading-rests-musical-silence.md` | 57 |
| `2026-05-09-seven-level-twenty-one-stage-system.md` | 71 |
| `2026-05-09-sight-reading-mistake-patterns.md` | 51 |
| `2026-05-10-piano-sight-reading-guide.md` | 76 |
| `2026-05-10-weakness-note-practice.md` | 64 |
| `2026-05-10-weighted-practice-algorithm.md` | 79 |
| `2026-05-11-church-accompanist-sight-reading.md` | 84 |
| `2026-05-11-gamified-sight-reading.md` | 98 |
| `2026-05-11-neuroscience-of-interval-recognition.md` | 105 |
| `2026-05-12-hobbyist-musician-sight-reading.md` | 115 |
| `2026-05-13-choral-sight-reading.md` | 107 |
| `2026-05-13-piano-vs-other-instruments.md` | 119 |
| `2026-05-14-jazz-musician-sight-reading.md` | 104 |
| `2026-05-14-vocal-sight-reading.md` | 99 |
| `2026-05-15-duolingo-style-music-learning.md` | 98 |
| `2026-05-15-practice-journal-sight-reading.md` | 87 |
| `2026-05-15-value-of-practice-data.md` | 92 |
| `2026-05-15-violin-sight-reading.md` | 113 |
| `2026-05-16-composition-improvisation-sight-reading.md` | 56 |
| `2026-05-16-familiar-vs-new-score-practice.md` | 78 |
| `2026-05-16-graduated-difficulty-design.md` | 70 |
| `2026-05-16-instant-note-recognition.md` | 68 |
| `2026-05-16-orchestra-sight-reading.md` | 64 |
| `2026-05-16-sight-reading-metacognition.md` | 56 |
| `2026-05-16-sight-reading-plateau-five-patterns.md` | 73 |
| `2026-05-16-transposition-explained.md` | 71 |
| `2026-05-16-weekly-monthly-practice-diagnosis.md` | 67 |
| `2026-05-17-chord-progression-reading.md` | 64 |
| `2026-05-17-string-ensemble-sight-reading.md` | 56 |
| `2026-05-17-working-memory-music-reading.md` | 60 |
| `2026-05-18-pre-performance-24hours.md` | 54 |
| `2026-05-18-sight-reading-metrics.md` | 47 |
| `2026-05-18-suzuki-vs-traditional-reading.md` | 71 |
| `2026-05-19-music-teacher-sight-reading-pedagogy.md` | 75 |
| `2026-05-19-sight-reading-learning-curve.md` | 95 |
| `2026-05-19-three-pillars-of-sight-reading.md` | 83 |
| `2026-05-20-cognitive-load-music-reading.md` | 87 |
| `2026-05-20-dynamics-markings-explained.md` | 82 |
| `2026-05-20-guitar-vs-piano-notation.md` | 85 |

참고: 8편의 `excerpt`-only 파일도 excerpt 길이 기준으로 보면 전부 120자 미만.

---

### 🟢 정상 (2건) — description 120자 이상

| 파일명 | description 길이(자) |
|---|---|
| `2026-05-12-adult-sight-reading.md` | 121 |
| `2026-05-12-fast-note-recognition.md` | 122 |

---

## 전체 파일별 점검 결과

| # | 파일명 | title 길이 | desc 필드 | desc 길이 | keywords 수 | slug 형식 | H1 없음 | 빈 alt 없음 |
|---|---|---|---|---|---|---|---|---|
| 1 | `2026-04-30-musical-staff-principle.md` | 20 | description | 89 | 5 | ✅ | ✅ | ✅ |
| 2 | `2026-04-30-sight-reading-basics.md` | 30 | description | 88 | 5 | ✅ | ✅ | ✅ |
| 3 | `2026-05-01-clef-guide.md` | 35 | description | 95 | 6 | ✅ | ✅ | ✅ |
| 4 | `2026-05-01-sight-reading-five-impacts.md` | 24 | description | 105 | 5 | ✅ | ✅ | ✅ |
| 5 | `2026-05-02-grand-staff-explained.md` | 28 | description | 76 | 5 | ✅ | ✅ | ✅ |
| 6 | `2026-05-02-noteflex-mission.md` | 31 | description | 91 | 5 | ✅ | ✅ | ✅ |
| 7 | `2026-05-02-sight-reading-7-principles.md` | 16 | description | 90 | 5 | ✅ | ✅ | ✅ |
| 8 | `2026-05-03-forgetting-curve-and-spaced-repetition.md` | 32 | description | 99 | 5 | ✅ | ✅ | ✅ |
| 9 | `2026-05-03-reading-ledger-lines.md` | 28 | description | 94 | 5 | ✅ | ✅ | ✅ |
| 10 | `2026-05-03-reading-music-real-meaning.md` | 37 | description | 102 | 5 | ✅ | ✅ | ✅ |
| 11 | `2026-05-04-accidentals-explained.md` | 16 | description | 104 | 6 | ✅ | ✅ | ✅ |
| 12 | `2026-05-04-how-to-measure-sight-reading-skill.md` | 15 | description | 93 | 5 | ✅ | ✅ | ✅ |
| 13 | `2026-05-05-chunk-based-sight-reading.md` | 26 | **excerpt** 🔴 | 75 | 5 | ✅ | ✅ | ✅ |
| 14 | `2026-05-05-daily-5min-sight-reading-routine.md` | 25 | **excerpt** 🔴 | 61 | 5 | ✅ | ✅ | ✅ |
| 15 | `2026-05-06-key-signatures-explained.md` | 35 | **excerpt** 🔴 | 98 | 5 | ✅ | ✅ | ✅ |
| 16 | `2026-05-06-note-recognition-speed.md` | 32 | **excerpt** 🔴 | 89 | 5 | ✅ | ✅ | ✅ |
| 17 | `2026-05-07-sight-reading-practice-time.md` | 30 | **excerpt** 🔴 | 77 | 5 | ✅ | ✅ | ✅ |
| 18 | `2026-05-07-time-signatures-explained.md` | 30 | **excerpt** 🔴 | 124 | 7 | ✅ | ✅ | ✅ |
| 19 | `2026-05-08-automaticity-in-sight-reading.md` | 32 | **excerpt** 🔴 | 66 | 5 | ✅ | ✅ | ✅ |
| 20 | `2026-05-08-note-values-explained.md` | 39 | **excerpt** 🔴 | 79 | 6 | ✅ | ✅ | ✅ |
| 21 | `2026-05-09-reading-rests-musical-silence.md` | 23 | description | 57 | 5 | ✅ | ✅ | ✅ |
| 22 | `2026-05-09-seven-level-twenty-one-stage-system.md` | 35 | description | 71 | 5 | ✅ | ✅ | ✅ |
| 23 | `2026-05-09-sight-reading-mistake-patterns.md` | 32 | description | 51 | 5 | ✅ | ✅ | ✅ |
| 24 | `2026-05-10-piano-sight-reading-guide.md` | 33 | description | 76 | 5 | ✅ | ✅ | ✅ |
| 25 | `2026-05-10-weakness-note-practice.md` | 28 | description | 64 | 5 | ✅ | ✅ | ✅ |
| 26 | `2026-05-10-weighted-practice-algorithm.md` | 23 | description | 79 | 5 | ✅ | ✅ | ✅ |
| 27 | `2026-05-11-church-accompanist-sight-reading.md` | 28 | description | 84 | 5 | ✅ | ✅ | ✅ |
| 28 | `2026-05-11-gamified-sight-reading.md` | 27 | description | 98 | 5 | ✅ | ✅ | ✅ |
| 29 | `2026-05-11-neuroscience-of-interval-recognition.md` | 30 | description | 105 | 5 | ✅ | ✅ | ✅ |
| 30 | `2026-05-12-adult-sight-reading.md` | 30 | description | 121 🟢 | 5 | ✅ | ✅ | ✅ |
| 31 | `2026-05-12-fast-note-recognition.md` | 36 | description | 122 🟢 | 6 | ✅ | ✅ | ✅ |
| 32 | `2026-05-12-hobbyist-musician-sight-reading.md` | 30 | description | 115 | 5 | ✅ | ✅ | ✅ |
| 33 | `2026-05-13-choral-sight-reading.md` | 26 | description | 107 | 6 | ✅ | ✅ | ✅ |
| 34 | `2026-05-13-piano-vs-other-instruments.md` | 36 | description | 119 | 6 | ✅ | ✅ | ✅ |
| 35 | `2026-05-14-jazz-musician-sight-reading.md` | 32 | description | 104 | 6 | ✅ | ✅ | ✅ |
| 36 | `2026-05-14-vocal-sight-reading.md` | 25 | description | 99 | 6 | ✅ | ✅ | ✅ |
| 37 | `2026-05-15-duolingo-style-music-learning.md` | 35 | description | 98 | 6 | ✅ | ✅ | ✅ |
| 38 | `2026-05-15-practice-journal-sight-reading.md` | 31 | description | 87 | 6 | ✅ | ✅ | ✅ |
| 39 | `2026-05-15-value-of-practice-data.md` | 39 | description | 92 | 6 | ✅ | ✅ | ✅ |
| 40 | `2026-05-15-violin-sight-reading.md` | 28 | description | 113 | 6 | ✅ | ✅ | ✅ |
| 41 | `2026-05-16-composition-improvisation-sight-reading.md` | 21 | description | 56 | 5 | ✅ | ✅ | ✅ |
| 42 | `2026-05-16-familiar-vs-new-score-practice.md` | 28 | description | 78 | 5 | ✅ | ✅ | ✅ |
| 43 | `2026-05-16-graduated-difficulty-design.md` | 30 | description | 70 | 5 | ✅ | ✅ | ✅ |
| 44 | `2026-05-16-instant-note-recognition.md` | 26 | description | 68 | 5 | ✅ | ✅ | ✅ |
| 45 | `2026-05-16-orchestra-sight-reading.md` | 27 | description | 64 | 5 | ✅ | ✅ | ✅ |
| 46 | `2026-05-16-sight-reading-metacognition.md` | 20 | description | 56 | 5 | ✅ | ✅ | ✅ |
| 47 | `2026-05-16-sight-reading-plateau-five-patterns.md` | 26 | description | 73 | 5 | ✅ | ✅ | ✅ |
| 48 | `2026-05-16-transposition-explained.md` | 37 | description | 71 | 5 | ✅ | ✅ | ✅ |
| 49 | `2026-05-16-weekly-monthly-practice-diagnosis.md` | 28 | description | 67 | 5 | ✅ | ✅ | ✅ |
| 50 | `2026-05-17-chord-progression-reading.md` | 28 | description | 64 | 5 | ✅ | ✅ | ✅ |
| 51 | `2026-05-17-string-ensemble-sight-reading.md` | 24 | description | 56 | 5 | ✅ | ✅ | ✅ |
| 52 | `2026-05-17-working-memory-music-reading.md` | 31 | description | 60 | 5 | ✅ | ✅ | ✅ |
| 53 | `2026-05-18-pre-performance-24hours.md` | 24 | description | 54 | 5 | ✅ | ✅ | ✅ |
| 54 | `2026-05-18-sight-reading-metrics.md` | 36 | description | 47 | 5 | ✅ | ✅ | ✅ |
| 55 | `2026-05-18-suzuki-vs-traditional-reading.md` | 35 | description | 71 | 5 | ✅ | ✅ | ✅ |
| 56 | `2026-05-19-music-teacher-sight-reading-pedagogy.md` | 35 | description | 75 | 5 | ✅ | ✅ | ✅ |
| 57 | `2026-05-19-sight-reading-learning-curve.md` | 34 | description | 95 | 5 | ✅ | ✅ | ✅ |
| 58 | `2026-05-19-three-pillars-of-sight-reading.md` | 28 | description | 83 | 5 | ✅ | ✅ | ✅ |
| 59 | `2026-05-20-cognitive-load-music-reading.md` | 32 | description | 87 | 6 | ✅ | ✅ | ✅ |
| 60 | `2026-05-20-dynamics-markings-explained.md` | 34 | description | 82 | 7 | ✅ | ✅ | ✅ |
| 61 | `2026-05-20-guitar-vs-piano-notation.md` | 24 | description | 85 | 6 | ✅ | ✅ | ✅ |

---

## 점검 항목별 집계

| 항목 | 기준 | 통과 | 미통과 |
|---|---|---|---|
| (A) title 길이 30~70자 | 30~70자 | 35 | 26 (모두 30자 미만, 단 70자 초과 없음) |
| (B) description 120~170자 | 120~170자 | 2 | 59 (전부 120자 미만) |
| (C) keywords 3개 이상 | ≥3개 | 61 | 0 |
| (D) excerpt 필드 사용 | 없어야 함 | 53 | 8 |
| (E) slug 형식 | kebab-case 영문 | 61 | 0 |
| (F) 본문 H1 (`#`) | 없어야 함 | 61 | 0 |
| (G) 빈 alt 텍스트 (`![]()`) | 없어야 함 | 61 | 0 |

---

## 권고 조치 우선순위

1. **즉시 (🔴)**: `2026-05-05` ~ `2026-05-08` 파일 8편에서 `excerpt:` 키를 `description:`으로 변경.
2. **장기 (🟡)**: 새 포스트 작성 시 description을 120~170자로 작성. 기존 53편은 검색 노출 최적화 목적으로 순차 보강 가능.
3. **title (🟡)**: 30자 미만 title 26편은 SEO 측면에서 조금 짧으나, 한국어 특성상 정보가 압축되어 있어 강제 수정 불필요. 신규 포스트에서 30~50자 권장.
