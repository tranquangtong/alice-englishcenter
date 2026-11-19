# Collab config — alice-englishcenter

## Stack
- Static site for GitHub Pages (plain HTML/CSS/JS, no build step; `.nojekyll`).
- Content = Markdown in `content/` + `docs/`, rendered client-side (marked via pinned CDN).
- Later: private repo + other hosting; teacher/student roles (see `content/roadmap-teacher-student.md`).

## Commands
- Install: none (Node ≥ 20 only for checks)
- Test: `node scripts/check.mjs` (links + manifest + Markdown files exist)
- Run/dev: `python3 -m http.server 8000` (Windows: `python -m http.server 8000`) then open http://localhost:8000

## Roles (overrides global routing)
- lead: whoever the user is chatting with
- codex: implementation with tests, build/CI fixes, review every diff before merge
- agy: UI/HTML/CSS, content and copy (English-learning material), docs, research
  - models: the newest Gemini Pro / Claude Opus/Sonnet from `agy models` (global rule: never Flash or Gemini 3.x Pro); no fixed ids here.

## Permissions
- codex: may edit (worktree, -w)
- agy: may edit (worktree, -w; file edits only)
- Never touch: `.env*`, secrets. Never publish ielts.app test content verbatim (structure only; write original practice items).

## Project rules
- Definition of done: `node scripts/check.mjs` passes with 0 errors; the lead verifies before reporting.
- Keep learner-facing content accurate and consistent; Codex reviews code, the lead reviews content.
- **UI design gene = Frutiger Aero (mandatory).** Every UI change — redesign, new page or feature
  (login, teacher/student dashboards, quizzes…) — must follow `docs/design-system.md` (tokens,
  glass panels, gel buttons, a11y rules) and pass its review checklist. Changing the gene needs
  the user's approval and an update to that file first.

## Collaboration
- Lead plans, routes, checks results; steps in only when really needed (both teammates blocked,
  fix-up rounds used up, or tiny task) and says why.
- Blocked teammate: give the cause + a workaround and try it; `NEEDS USER:` for steps only the
  user can do; `SUGGEST codex|agy:` when the other teammate has a better tool.
- Fallbacks: agy edits UI/content (no shell) → codex runs lint/tests on it; content in Google
  Docs/Sheets/Slides or Canva → agy (codex has no such plugins); bulk reading of lesson
  material → agy; codex blocked by no network (e.g. installs) → `NEEDS USER:`.

## Workflow
- Global workflow applies. Note: `-w` needs at least one commit on `main`.
