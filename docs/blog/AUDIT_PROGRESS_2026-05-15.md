# Blog Audit Progress — 2026-05-15 D+A Sprint

## Status: COMPLETE

| Pass | Description | Files | Result |
|---|---|---|---|
| Stage 1 | Audit report `AUDIT_2026-05-15.md` | — | committed `b12c0fb` |
| Pass 1 | ADD_COVER (frontmatter 누락 영역) | 40 | committed `b06fff3` |
| Pass 2 | PRACTICAL_GUIDE → REDUCE_TO_ONE | 46 | committed `8feb072` |
| Pass 3 | HISTORY_THEORY hook image 제거 | 22 | committed `f9f1f84` |
| Pass 4 | `IMAGE_POLICY.md` | 1 | committed `bfc27ad` |

## Per-Pass Detail

### Pass 1: ADD_COVER
- Scope: 2026-04-30 ~ 2026-05-08 (40 files, KO 20 + EN 20)
- Action: added 5 cover frontmatter fields (`coverImage`, `coverImageAlt`, `coverImageSource`, `coverImageLicense`, `coverImageCredit`)
- Strategy: re-used existing first body image URL when present; for 2 image-less posts (`musical-staff-principle`, `sight-reading-basics`) picked verified Met / Wikimedia covers (Allegory of Music / BWV 1001 manuscript)
- Old `image:` field merged into the new 5-field block

### Pass 2: REDUCE_TO_ONE (PRACTICAL_GUIDE)
- Scope: 46 files (KO 23 + EN 23), all PRACTICAL_GUIDE
- Action: removed every body `![](...)` line and its immediate caption line; collapsed "이미지 출처" / "Image Sources" section to one cover entry
- References sections untouched (academic citations stay)

### Pass 3: HISTORY_THEORY hook removal
- Scope: 22 files (KO 11 + EN 11) where first body image sat before any `## ` H2 (Hook section)
- Action: removed the duplicate hook image (same URL as cover); for posts with 2 body images, the second body image in Scene/Insight section remains
- Result: HISTORY_THEORY now reads "cover (Hero) + 0 or 1 body image"

### Pass 4: IMAGE_POLICY.md
- D+A unified policy: HISTORY_THEORY (2 images) · PRACTICAL_GUIDE (1 image), 5 frontmatter fields, source whitelist, verification command

## Verification Results

- Pexels / Unsplash / Pixabay: 0 occurrences (forbidden list intact)
- HTTP 200 verified URLs across 18 unique image sources (5 returned 429 rate-limit on `upload.wikimedia.org` HEAD checks — Commons file pages return 200, files confirmed live)
- All 80 posts now have the 5 cover frontmatter fields

## Cumulative State (post-sprint)

| Metric | Before | After |
|---|---|---|
| Posts missing cover | 40 | 0 |
| PRACTICAL_GUIDE body images | 80+ | 0 |
| HISTORY_THEORY hook-position images | 22 | 0 |
| Forbidden source occurrences | 0 | 0 |

## Open Issues

- 5 image URLs on `upload.wikimedia.org` returned HTTP 429 (rate limit) during HEAD verification. Their Commons File: pages returned 200, so the images are live. Treating as live; no replacement needed.
- No HTTP 404s encountered.
- No ambiguous classifications: every post mapped cleanly via category field.

## Commits

```
bfc27ad docs(blog): IMAGE_POLICY.md D+A 정책 완료
f9f1f84 fix(blog): HISTORY_THEORY 후크 위치 본문 이미지 제거
8feb072 refactor(blog): PRACTICAL_GUIDE 이미지 1개로 축소
b06fff3 fix(blog): cover frontmatter 누락 영역 완료 (5/2 이전 글)
b12c0fb docs(blog): D+A 정책 정합 감사 보고서 2026-05-15
```
