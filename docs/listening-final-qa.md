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
| CSS size / assets | Still open after the CSS follow-up: loaded minified stylesheets total 56,359 bytes raw / 12,677 bytes gzip, down from 77,675 raw bytes. The raw total still exceeds the approximate 40KB budget. |

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
2. **CSS budget still exceeded — partial reduction, not resolved.** Shared
   component declarations and generated minified files reduce loaded CSS from
   **77,675 to 56,359 raw bytes** (27.4% smaller), **12,677 bytes gzip**. A further
   **16,360 raw bytes** must be removed to satisfy the strict <40,000-byte check.
   See the follow-up below. Gzip size alone does not close the raw-byte finding.

The earlier content findings in `docs/listening-phase-b-validation.md` are
historical: the two merged content corrections and regenerated audio address
them. Schema/evidence checks and real-test scoring remain green; this round
does not claim a fresh human pronunciation review or independent fact-check of
every lesson claim.

## CSS budget follow-up — incomplete

Readable CSS remains in `assets/css/style.css` and `assets/css/listening.css`.
Shared grid layouts, glass surfaces and answer-state declarations are grouped;
gel gradients use shared tokens. No content SVG was edited. The five Aero genes,
existing colours, selectors, glass fallbacks and print rules remain intact.

`node scripts/build-css.mjs` (also `npm run css`) generates the checked-in
`.min.css` files without dependencies. It preserves quoted strings, SVG URLs,
escapes, descendant pseudo selectors and calc spacing. `index.html` now loads
`style.min.css?v=6` and `listening.min.css?v=3`. Source hashes and deterministic
output comparisons make missing/stale builds fail `scripts/check.mjs`, including
comment-only source edits. Line endings are normalized for cross-platform checks.
The checker also enforces the raw budget; it currently fails with **one budget
error, zero stale-file errors and zero warnings**. This change is not ready to
be reported as the completed budget fix.

| Loaded file | Raw bytes | Gzip bytes |
|---|---:|---:|
| `assets/css/style.min.css` | 26,853 | 6,697 |
| `assets/css/listening.min.css` | 29,506 | 5,980 |
| **Total** | **56,359** | **12,677** |

Gzip uses Node's default gzip level, compressing each file separately. The two
readable sources still total 76,873 bytes. Comment/whitespace minification of
the original sources alone produced 57,083 bytes, so that step cannot meet the
raw budget. Further structural CSS consolidation remains necessary.

Before any source edit, the existing final e2e captured its 32 screenshots in
`test-artifacts/css-budget/before/`. Independent stabilized source/generated
e2e runs are in `source/` and `after/`, with exact pixel counts in
`pixel-diff.json`. A repeat using the unchanged original sources is in
`before-repeat/`, with `control-pixel-diff.json`. The repeat reproduced the
42,608-pixel dark footer difference and the mobile result/player paint region;
these large cross-run differences therefore also occur without a CSS change.

An additional comparison applied original and updated styles to the **same DOM,
viewport and browser context**, across all 28 states, taking paired screenshots
and comparing every standard computed property on every element and its
`::before`/`::after`. All 28 states had **zero computed-property differences**.
Paired exact pixel counts (no tolerance applied):

| State | Light 1600 | Light 390 | Dark 1600 | Dark 390 |
|---|---:|---:|---:|---:|
| Hub | 4 | 0 | 2 | 0 |
| List | 0 | 0 | 0 | 0 |
| Practice | 0 | 1 | 0 | 3 |
| Practice, scrolled | 2 | 0 | 1 | 0 |
| Exam | 0 | 1 | 0 | 3 |
| Result | 0 | 1 | 0 | 3 |
| Dropdown | 7 | 12 | 4 | 15 |

Every nonzero paired difference is only **1–2 channel levels** (of 255), at
glass/bubble or antialiased brand edges; the largest is **15 pixels / 0.004557%**.
Together with unchanged computed styles and the original-source repeat, this
supports browser raster/compositor variability rather than a layout/style
change. Paired PNGs and JSON reports are in `test-artifacts/css-budget/paired/`.
Both independent e2e runs still pass layout, contrast, focus, target, motion,
360px and print assertions.

To reproduce source/generated e2e captures, set `CSS_QA_STYLESHEETS=source` and
`CSS_QA_OUTPUT=test-artifacts/css-budget/source` for the first run of
`node --test tests/listening-final.e2e.test.mjs`; unset the stylesheet override
and choose a different output directory for the generated-file run. An optional
`CSS_QA_SOURCE_DIRECTORY` selects a saved source directory relative to the repo.
Compare directories with
`node tests/helpers/compare-screenshots.mjs BEFORE AFTER REPORT.json`.

Follow-up validation: `node --test` **32/32 pass** (the original 30 plus two CSS
build tests); `git diff --check` clean. `node scripts/check.mjs` has **1 error**,
solely the remaining raw-byte budget overrun. Finding #2 remains open.

## Original QA validation and artifacts

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
