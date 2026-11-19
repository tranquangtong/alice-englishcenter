# Listening Phase B validation

Validated on 19 November 2026 in headless Microsoft Edge. Changes are uncommitted for bridge handoff; no CSS or test JSON was edited.

## Implementation

- `assets/js/listening-core.js`: number-aware counting and grading compact numeric runs only when `allowNumber` is true. Spaced/compact phone answers match in either direction, with tests for both single-variant answer keys. Dates with a month word retain that word; number separators remain meaningful except existing thousands-comma normalization.
- `assets/js/listening.js`: column-delimited table prompts produce semantic tables with one question per row, inline labelled inputs and feedback in the answer cell. The existing `.table-scroll` glass/responsive styles are reused. Tables without delimiters retain inline prompts. Both listening module cache versions are now `v=2` (controller in `index.html`, core in the controller import).
- `scripts/build-listening-audio.mjs`: synthesis uses four bounded workers, retains script order, and waits for active workers before cleaning temporary files on failure. Worker tests cover order, connection limits and failure cleanup. The existing 24 kHz mono/48 kbps encoding is retained.
- `tests/helpers/static-server.mjs`: opt-in real catalogue/assets mode alongside the existing isolated fixtures; CDN scripts use installed local dependencies in browser tests.
- `tests/listening-core.test.mjs`, `tests/listening-audio-build.test.mjs`, `tests/listening-real-audio.test.mjs`, `tests/listening-real.e2e.test.mjs`: regression, audio and real-content browser coverage.
- `.gitignore` already ignores `node_modules/` and `test-artifacts/`; verified with `git check-ignore`.

## Audio inventory

Generated with `npm run audio -- --all` (Windows shell: `npm.cmd`). Every path below is relative to `assets/audio/ielts-gt/listening/`. Sizes are exact bytes; durations are decoded MP3 durations including narrator and pauses.

| File | Bytes | Duration (m:ss) |
|---|---:|---:|
| gt-l-01/part1.mp3 | 2,559,405 | 7:06.53 |
| gt-l-01/part2.mp3 | 2,604,477 | 7:14.04 |
| gt-l-01/part3.mp3 | 2,688,285 | 7:28.01 |
| gt-l-01/part4.mp3 | 2,304,237 | 6:24.00 |
| gt-l-02/part1.mp3 | 2,535,933 | 7:02.62 |
| gt-l-02/part2.mp3 | 2,578,413 | 7:09.70 |
| gt-l-02/part3.mp3 | 2,893,197 | 8:02.16 |
| gt-l-02/part4.mp3 | 2,361,981 | 6:33.62 |
| gt-l-03/part1.mp3 | 2,321,949 | 6:26.95 |
| gt-l-03/part2.mp3 | 2,089,821 | 5:48.26 |
| gt-l-03/part3.mp3 | 2,513,469 | 6:58.87 |
| gt-l-03/part4.mp3 | 2,209,053 | 6:08.14 |
| gt-l-04/part1.mp3 | 2,184,285 | 6:04.01 |
| gt-l-04/part2.mp3 | 2,289,261 | 6:21.50 |
| gt-l-04/part3.mp3 | 2,603,325 | 7:13.85 |
| gt-l-04/part4.mp3 | 2,045,757 | 5:40.92 |

Total: **38,782,848 bytes (38.78 MB; 36.99 MiB)**, below the 60 MB stop threshold. Combined duration: **1:47:43.18**. All 16 files decode as 24 kHz, mono, 48 kbps; each part exceeds 120 seconds. FFmpeg silence detection found every scripted pause (including the 5-second breaks in tests 03/04), allowing a small amount of natural voice silence. Script metadata identifies the opening narrator, and decoded audio contains speech before the first reading pause. This is structural/audio decoding verification, not a human review of pronunciation.

Two synthesis streams retried after an incomplete stream; both ultimately completed. Temporary generator files and browser profiles were removed. PowerShell blocked `npm.ps1`; `npm.cmd` worked. Cleanup of the interrupted first synthesis run succeeded using non-recursive Node file removal after resolving Windows short/long paths.

## Checks and browser evidence

- `node --test`: 29 tests pass, zero failures. Both fixture and real-content Edge suites pass.
- `node scripts/check.mjs`: zero errors, zero warnings. `git diff --check`: clean.
- All four tests: real media metadata, every question/group rendered, maps decoded with alt text, shared multi-choice lists, matching choices, table cell placement/fallback, all four seek buttons, correct answers submitted for **40/40 and Band 9**, reset and empty answers submitted for **0/40**. All 40 explanations and transcript evidence marks remain available after submission.
- Test 01 exam mode: forbidden seeking reverted, playback rate forced to 1, seek/speed/pause controls absent, native MP3 end events advance all four parts, two-minute review automatically submits. Acceleration lives only in the browser test: temporarily bypasses the seek guard to reach each actual MP3's tail; production UI/code has no test hook.
- Catalogue: exactly four tests and two external sites with twenty test links each; test links and site-home links all carry `target="_blank" rel="noopener noreferrer"`.
- Screenshots in ignored `test-artifacts/`: `listening-real-{list,practice,result}-{1600,390}.png`; exact dimensions/bounds in `listening-real-layout.json`; file sizes, durations and detected/scripted pauses in `listening-audio-report.json`.
- Design review against `design-system.md`: existing sky/water, grass accents, glass panels, rounded gel buttons and shared typography retained; no new color literals or CSS. Tables reuse glass surfaces and stack into cards on narrow screens. No horizontal overflow on all sixteen part views at 390px or the table result at 360px in light/dark; reduced motion enabled; table stays visible and audio controls hide in print. No CSS change is needed by this implementation; parallel CSS work still needs the lead's merged-state verification.

## Content and JSON compatibility notes

- **gt-l-01:** Part 1 Q3's spaced telephone variant is now valid and matches the compact form. Q7–10 have type `table` but no column delimiters, so inline fallback applies. Part 4 Q36 and its script/evidence say “solitary bumblebees”; change this wording in a content pass because bumblebees are social insects. The answer `native` itself still agrees with the script. [Verification source: Bumblebee Conservation Trust](https://www.bumblebeeconservation.org/wp-content/uploads/2024/12/all-about-bumblebees.pdf).
- **gt-l-02:** Part 1 Q6–10 also have type `table` without delimiters, so inline fallback applies. Both shared multi-choice groups and matching render and grade correctly. No additional answer-key/schema incompatibility found in this pass.
- **gt-l-03:** Map and shared multi-choice/matching groups render and grade correctly. No additional answer-key/schema incompatibility found in this pass; this is not a clinical review of the shift-work lecture.
- **gt-l-04:** Part 1 Q7–10 use ` | ` delimiters and now render as a two-column table. Part 2 Q18's script/evidence calls the retailer's age-check policy a legal responsibility and includes high-caffeine energy drinks alongside alcohol. Clarify law versus store policy and the jurisdiction/date: the England energy-drink ban is intended for April 2027, subject to Parliamentary approval, rather than currently in force on this validation date. The matching answer `D` remains consistent with the script. [Verification sources: UK Government implementation timeline](https://www.gov.uk/government/consultations/banning-the-sale-of-high-caffeine-energy-drinks-to-children/outcome/banning-the-sale-of-high-caffeine-energy-drinks-to-children-consultation-outcome), [scheme owner's Challenge 25 explanation](https://rasg.org.uk/challenge-25/faqs/).

Content notes were reported only; the generated recordings intentionally follow the current supplied scripts. Editing either flagged script later requires regenerating that part's MP3 and rerunning the checks.
