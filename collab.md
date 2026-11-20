# Collab config — alice-englishcenter

## Stack
- Static site for GitHub Pages (plain HTML/CSS/JS, `.nojekyll`); no build step at deploy, but
  generated files (`*.min.css`, `version.json`, `aec-version` meta) are committed.
- Content = Markdown/JSON in `content/` (IELTS GT Listening: `content/ielts-gt/listening/`),
  rendered client-side (marked + DOMPurify, pinned CDN). Internal docs in `docs/` (not on site).
- Dev-only npm deps: playwright-core (E2E), msedge-tts + ffmpeg-static (listening audio).
- Later: Supabase teacher/student platform (`docs/roadmap-teacher-student.md`).

## Commands (macOS, Node ≥ 20)
- Install: `npm ci`
- Test: `node --test` (unit + E2E) and `node scripts/check.mjs` (links, manifest, min.css/version freshness, CSS budget)
- Build: `npm run css` (after CSS edits) → `node scripts/build-version.mjs` (after any change in `index.html`, `assets/`, `content/`)
- Audio: `npm run audio` (needs network)
- Run/dev: `python3 -m http.server 8000` → http://localhost:8000
- E2E: `npm run test:chrome` + `npm run test:webkit` (Safari engine) on this Mac; `PW_BROWSER`/`PW_CHANNEL`
  in `tests/helpers/browser.mjs` (default Chromium `msedge`). Codex's `-w` sandbox can't bind localhost or
  launch browsers (and a crash pops a macOS dialog) → codex never launches browsers; lead runs both suites.

## Roles (overrides global routing)
- lead: whoever the user is chatting with
- codex: JS, scripts, tests, build/audio, E2E runs, review every diff before merge
- agy: UI/HTML/CSS, English-learning content and copy, docs, research
  - models: newest Gemini Pro / Claude Opus/Sonnet from `agy models` (never Flash or Gemini 3.x Pro).

## Permissions
- codex: may edit (worktree, -w); must not `git commit` (bridge auto-commits)
- agy: may edit (worktree, -w; file edits only, user choice)
- Never touch: `.env*`, secrets; never hand-edit `*.min.css` or `version.json` (regenerate).
- Never publish ielts.app test content verbatim (structure only; write original practice items).

## Project rules
- Definition of done: `node --test` all pass + `node scripts/check.mjs` 0 errors; lead re-runs both.
- Edited CSS/JS → bump its `?v=` in `index.html`, rebuild CSS, then rebuild version.
- CSS budget < 60 KB raw / < 15 KB gzip (≈59 KB used): new UI must trim or merge CSS first.
- **UI design gene = Frutiger Aero (mandatory).** Every UI change follows `docs/design-system.md`
  (tokens, glass panels, gel buttons, a11y) and passes its checklist. Changing the gene needs the
  user's approval and an update to that file first.
- Keep learner-facing content accurate and consistent; codex reviews code, lead reviews content.

## Collaboration
- **Lead never implements, however small** (user rule): UI/CSS/content → agy `-w`;
  JS/scripts/tests → codex `-w`. Lead steps in only if both fail after fix-up rounds or the user asks; says why.
- **Every task ships with tests.** The prompt lists acceptance checks; not done until:
  1. builds re-run as needed, `node scripts/check.mjs` → 0 errors, `node --test` → all pass;
  2. UI changes: codex adds/updates a playwright-core E2E check (measure positions/sizes,
     screenshots at 1600px + 390px, light + dark); the lead runs it on Chrome + WebKit;
  3. codex reviews the diff against the `docs/design-system.md` checklist.
  agy work → codex runs 1–3 afterwards.
- Blocked teammate: give cause + workaround and try it; `NEEDS USER:` for user-only steps;
  `SUGGEST codex|agy:` when the other teammate has a better tool.
- Fallbacks: agy has no shell → codex runs builds/tests on its diff; Google Docs/Sheets/Slides or
  Canva content → agy; bulk reading of lesson material → agy.

## Workflow
- Global workflow applies (`-w` needs a commit on `main`).
