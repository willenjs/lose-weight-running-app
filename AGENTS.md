# AGENTS.md

Guidance for AI coding agents working in this repository. Read `README.md`
for what the app is; this file is about how to change it safely.

## Commands

- Install: `npm install`
- Test: `npm test` (vitest, runs `tests/**/*.test.js`)
- Build: `npm run build`
- Dev server: `npm run dev`

Before claiming a change is done, run `npm test` and `npm run build` and
confirm both pass.

## Architecture rules

- `src/core/` is pure JavaScript: no DOM, no Svelte, no browser APIs, no
  imports from outside `core/`. It must stay portable to a native app.
- `src/platform/` holds every browser API (Web Audio, speechSynthesis,
  Wake Lock, localStorage). It may import from `core/` only.
- `src/ui/controller.svelte.js` is the only module that wires `core/` and
  `platform/` together and owns app state (`app`, a Svelte 5 `$state` object).
  Components call its exported actions; they do not call `platform/` directly.
- Svelte 5 runes only (`$state`, `$derived`, `$props`, `onclick=`); no
  legacy `export let`, `$:` or `on:click`.
- No router, no TypeScript, no SvelteKit, no i18n library, no backend.

## Timer invariants (do not break)

- Timer state is always derived from timestamps in the `Session`
  (`startedAt`, `pausedAt`, `pausedTotalMs`, `skippedMs`) via
  `getState(session, workout, now)`. Never count ticks or intervals.
- Audio cues are pre-scheduled on the `AudioContext` clock from
  `upcomingCues()`. Any action that changes the session (pause, resume, skip,
  stop) must stop the cue player and, if still running, start it again.
- `createCuePlayer().start()` must be called from a user gesture.

## Conventions

- Everything in code is English: identifiers, file names, comments, storage
  keys, commit messages. Portuguese lives only in `src/i18n/pt.js` (and in
  tests asserting Portuguese output).
- All user-facing text goes through `t(key, params)`. Add every new key to
  both `src/i18n/pt.js` and `src/i18n/en.js`; a test enforces matching keys.
- Durations are stored and passed in seconds. Spoken durations use
  `formatDuration(seconds, lang)` and the `{duration}` placeholder.
- localStorage keys are `runningAssistant.*`, stored as
  `{ "version": 1, "data": ... }`. Bump the version and handle migration if
  the shape changes. Storage code must never throw.
- Workout data in `src/core/plan.js` is transcribed from `image-sources/`;
  `tests/core/plan.test.js` pins each total to its screenshot. Do not edit
  the plan without a matching screenshot.

## Testing

- Write tests first for anything in `src/core/`, `src/i18n/` and
  `src/platform/storage.js`. Tests live in `tests/`, mirroring `src/`.
- Audio, speech, wake lock and UI are verified manually (see README
  "Manual phone test"). Do not claim background audio works without a test on
  a real Android phone.

## Git

- Conventional commit prefixes (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Remote: `origin` → `git@github.com:willenjs/lose-weight-running-app.git`,
  default branch `main`. Do not push unless asked.
- Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`
  (never edit the `gh-pages` branch by hand; it is overwritten on each deploy).
