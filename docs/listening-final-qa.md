# Listening final QA — 19 November 2026

All 30 automated tests pass, including real-content/real-MP3 e2e. The requested
screen checks pass after minimal CSS corrections. The full design checklist has
two open findings: SVG badge contrast and the combined CSS size budget.
Changes are uncommitted for bridge handoff.

## Changes

- Rebuilt tests 01 and 04 with `npm.cmd run audio -- content/ielts-gt/listening/gt-l-01.json content/ielts-gt/listening/gt-l-04.json --force`.
  The builder has no part filter, so eight MP3s were regenerated. Test 01 Part 4
  is **385.34 seconds**; test 04 Part 2 is **383.54 seconds**. All 16 files pass
  decoding, duration >120 seconds, mono 24 kHz/48 kbps and scripted-pause checks.
  Total production audio is **38,803,152 bytes**. The rebuilt scripts include
  the bumblebee/mason-bee correction and the store-policy clarification.
- `index.html`: `style.css?v=5`, `listening.css?v=2`, `listening.js?v=3`.
- `assets/js/listening.js`: optional external-site note rendered inside its
  section as an escaped paragraph. Tests cover present, absent and hostile notes.
- `assets/css/style.css`: brand link minimum height 44px (was 36px desktop/32px
  mobile); gel gloss restricted to the upper cap, above label text, to preserve
  AA label contrast without changing colours or removing the Aero highlight.
- `assets/css/listening.css`: external site-home links minimum height 44px
  (was 25px); jump buttons minimum width 44px (±5s was 40.6px); existing white/
  black print reset extended to mode/progress/Band, answer status, instructions
  and transcript pause panels. Those previously retained coloured gradients,
  including dark-mode backgrounds when printing from dark mode.
- `tests/listening-final.e2e.test.mjs`: reproducible screen/accessibility QA,
  screenshots, computed contrast bounds, 360px checks and print assertions.
- `tests/listening.e2e.test.mjs`: outside-click test now clicks the far edge of
  main. The old top-left point lies under the new dropdown; a real pointer click
  at that point correctly targets the menu rather than closing it.

## Measurements

Headless Microsoft Edge; desktop viewport 1600×1000, mobile 390×844. Every row
covers hub, list, practice, scrolled practice, exam, result and open dropdown.
All seven states have zero horizontal overflow. Measurements are CSS pixels.

| Scheme / width | Header height | Minimum initial H1 clearance below header | Sticky bar height / viewport | Sticky bar clearance below header | Minimum sampled text contrast |
|---|---:|---:|---:|---:|---:|
| Light / 1600 | 54.4 | 65.0 | 122.0 / 12.2% | 21.6 | 4.83:1 |
| Light / 390 | 58.8 | 39.4 | 251.6 / 29.8% | 6.8 | 4.83:1 |
| Dark / 1600 | 54.4 | 65.0 | 122.0 / 12.2% | 21.6 | 5.13:1 |
| Dark / 390 | 58.8 | 39.4 | 251.6 / 29.8% | 6.8 | 5.13:1 |

The bar sticks at y=94.4 desktop / y=76 mobile and stays below 40% of mobile
viewport height. Exam bars are shorter (138.9 desktop / 182.7 mobile). Header
controls fit one row; H1 measurements exclude deliberately scrolled-away text.
All visible header/main interactive targets are at least 44×44; radio/checkbox
targets use their clickable option label. Additional hub/list/table-result
checks at 360px pass in both schemes.

| Text | Light contrast | Dark contrast |
|---|---:|---:|
| Score | 6.76:1 | 6.40:1 |
| Band | 4.88:1 | 6.76:1 |
| ✓ Đúng | 4.87:1 | 6.53:1 |
| ✗ Chưa đúng | 6.87:1 | 9.85:1 |

Contrast uses computed foreground/background colours, alpha composition through
ancestors and gradient-stop extrema, with white-cloud/sky extremes in light
mode and navy/teal extremes in dark. This is a conservative glass approximation;
blur, saturation and inset-shadow rasterisation are not modelled. Bright gel
caps are excluded only when they lie above the measured text bounds. SVG image
contents are separately reviewed below and are outside this DOM colour scan.

`getByRole('button', { name, exact: true })` resolves the compact header buttons
as **IELTS General** and **Danh mục học tập** at 390px in both themes. Keyboard
focus has a visible outline ≥2px. Reduced motion disables bubble animations
and leaves other animation/transition durations ≤0.001s. Feedback includes both
the symbol and Vietnamese status text. Print keeps the table visible, hides
the audio bar, and renders the tested panels black on white in both schemes.

The Node test server uses real catalogue/media and installed copies of the
pinned CDN scripts, with Google Font links stripped for reproducible offline
checks. Screenshots therefore use the declared system fallback. Production
still declares Inter/Noto Sans via Google Fonts with `display=swap`.

## Full diff review: `25c43f2..main`

Reviewed the 52-file merged change set: routing/controller/grading/validation,
CSS/header, catalogue and four test schemas/scripts/evidence, SVG maps, audio
builder/assets, fixtures/tests, dependency changes and documentation. Audio
binaries were checked by decoding and browser media rather than a text diff.
The current QA fixes were additionally reviewed against the same checklist.
No general refactor was made.

| Design checklist | Finding |
|---|---|
| Five Aero genes | Present: sky/water background, grass states, gloss/glass panels, rounded gel controls, shared heading/body font families. No gene change. |
| Tokens | New listening semantic colours live in `:root` with dark overrides; components reuse shared surface, type, border and gel tokens. Standalone SVG maps contain their own palette. No new colour literal introduced by this QA round. |
| AA / themes / motion / mobile / print | Screen DOM text, both schemes, 360/390px layout, focus, target size, motion and tested print panels pass after the fixes above. SVG badge text still fails AA; see below. |
| Component reuse | Listening cards, controls, tabs, feedback and dropdown reuse the glass/gel vocabulary; existing JS selectors remain compatible. Glass fallbacks are present before `@supports`. |
| CSS size / assets | Open budget finding: both stylesheets together are approximately 77.7KB uncompressed, exceeding the guide's approximate 40KB total budget. CSS/SVG decoration remains lightweight relative to raster assets. |

### Open findings

1. **SVG map badges fail the 4.5:1 text requirement.**
   `content/ielts-gt/listening/img/gt-l-01-map.svg:13` and `:32` define bright
   aqua badge gradients with white 16px lettering. Across the rendered letter
   bounding box, computed gradient contrast is **2.94–4.32:1**.
   `content/ielts-gt/listening/img/gt-l-03-map.svg:10` and `:139` have the same
   issue with 18px lettering: **2.67–3.85:1**. These are source-SVG pixel sizes;
   scaling down the images makes the letters smaller. A follow-up should darken
   badge fills or change lettering colour and recheck both maps. External SVG
   image text cannot be fixed by the page stylesheet; left for the requested
   full-diff findings report rather than changing content assets in this CSS QA.
   Exact glyph bounds and contrast bounds: `test-artifacts/final/map-contrast.json`.
2. **CSS budget exceeded.** `assets/css/style.css` plus
   `assets/css/listening.css` total roughly 77.7KB. Consolidation/minification
   needs a separate scoped change; no refactor in this round.

The earlier content findings in `docs/listening-phase-b-validation.md` are
historical: the two merged content corrections and regenerated audio address
them. Schema/evidence checks and real-test scoring remain green; this round
does not claim a fresh human pronunciation review or independent fact-check of
every lesson claim.

## Validation and artifacts

- `node --test`: **30 tests, 30 pass, 0 fail**, including fixture e2e, final QA,
  and all four real tests/real audio, 40/40 → Band 9 and 0/40 paths, exam guards,
  all four native MP3 endings and timed review submission.
- `node scripts/check.mjs`: **0 errors, 0 warnings**.
- `git diff --check`: clean.
- `test-artifacts/final/`: **34 PNGs** (28 state screenshots, four score views,
  two SVG maps), `measurements.json`, `map-contrast.json`, and `tests.log`.
  Audio detail: `test-artifacts/listening-audio-report.json`. Artifacts are
  gitignored. Temporary profiles/servers were closed and generator temp files
  removed. Dependencies installed using the writable npm cache and `npm.cmd`.

Verification source for role/name-based browser assertions:
[Playwright Locator documentation](https://playwright.dev/docs/api/class-locator).
