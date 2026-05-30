# Blog Image Policy (D+A Unified)

> 2026-05-15 정합 적용됨 — 메모리 #13 갱신 완료.

## Two Classes

### HISTORY_THEORY
- Topics: 음악 이론·화성학·신경과학·인지·음악사·기보 영역
- Images: 2 (cover + 1 body) — OR cover only when no Scene/Insight image is needed
- Cover: appears as Hero via 5 frontmatter fields
- Body image (if any): must sit in Scene/Insight section, NOT in Hook
- Sources: Wikimedia · LoC · Met · BnF · NYPL · IMSLP · Smithsonian · PLOS · Frontiers · PMC

### PRACTICAL_GUIDE
- Topics: 실전 연습·루틴·게임·약점·악기별·직군별·뮤직 테크·데이터 분석
- Images: 1 (cover only, Hero) — body has no `![](...)` lines
- Sources: same whitelist as HISTORY_THEORY

## Common Rules

- 5 cover frontmatter fields mandatory:
  - `coverImage` — direct image URL
  - `coverImageAlt` — descriptive alt text
  - `coverImageSource` — source page URL (Wikimedia File: page, Met collection page, LoC item, etc.)
  - `coverImageLicense` — Public Domain · CC0 · CC BY · CC BY-SA · CC BY 3.0 등
  - `coverImageCredit` — creator + repository
- All URLs HTTP 200 verified before commit
- Image Sources section separated from References (academic citations)
- First body image (if present) NOT in Hook section (Scene/Insight only)
- KO and EN siblings carry identical cover/body image set

## Section Conventions

```markdown
## 참고 자료 / ## References
(academic citations only — Hallam 1997, Cepeda 2006, etc.)

## 이미지 출처 / ## Image Sources
(image credit entries — 1 entry for PRACTICAL_GUIDE, 1–2 for HISTORY_THEORY)
```

## Forbidden Sources

- Pexels · Unsplash · Pixabay
- 자동 박지 말음 — 출시 후 사용자 직접 완료 (메모리 #13)
- 2026-05-15 sprint 결과: 80개 글 전부 0건 확인

## Source Hosts (Allowed)

| Host | Type | Example |
|---|---|---|
| `upload.wikimedia.org` | Wikimedia Commons file | thumb/x/yy/Name.jpg |
| `commons.wikimedia.org` | Wikimedia Commons file page | /wiki/File:Name.jpg |
| `images.metmuseum.org` | Met original image | CRDImages/{ep,mi,dp}/original/X.jpg |
| `www.metmuseum.org` | Met collection page | /art/collection/search/{id} |
| `tile.loc.gov` | Library of Congress image | image-services/iiif/... |
| `www.loc.gov` | Library of Congress item page | /item/{id}/ |
| `gallica.bnf.fr` | BnF Gallica | /ark:/12148/... |
| `imslp.org` | IMSLP score (Public Domain) | /wiki/... |
| `digitalcollections.nypl.org` | NYPL | /items/... |
| `journals.plos.org` | PLOS ONE figure | (CC BY) |
| `www.frontiersin.org` | Frontiers figure | (CC BY) |
| `www.ncbi.nlm.nih.gov/pmc` | PMC (CC BY / CC0 only) | (verify per-article) |

## Verification (manual)

```bash
curl -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -sI "{url}" | head -3
```

Must return HTTP/2 200. HTTP 429 = rate limit (retry); HTTP 404/403 = replace.

## Sprint Records

- 2026-05-15: D+A 정합 sprint 완료 — 40 cover 완료, 46 PRACTICAL 본문 축소, 22 HISTORY 후크 정리. 자세한 내용은 `AUDIT_2026-05-15.md` 참조.
