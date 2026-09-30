# AGENTS.md

Guidance for AI coding agents working in this repository. Read `README.md`
for what the app is; this file is about how to change it safely.

## Commands

- Install: `npm install`
- Test: `npm test` (vitest, runs `tests/**/*.test.js`)
- Build: `npm run build`
- Dev server: `npm run dev`
- Android APK: `npm run android:build` (install over USB: `npm run android:install`)
- Phone + watch JVM unit tests: `npm run android:test`
- Watch APK: `npm run wear:build` (install over Wi-Fi: set `WEAR_SERIAL=<ip:port>`, then `npm run wear:install`)

Before claiming a change is done, run `npm test` and `npm run build` and
confirm both pass. If `android/` changed, also run `npm run android:test`.

## Architecture rules

- `src/core/` is pure JavaScript: no DOM, no Svelte, no browser APIs, no
  imports from outside `core/`. It must stay portable to a native app.
- `src/platform/` holds every browser API (Web Audio, speechSynthesis,
  Wake Lock, localStorage). It may import from `core/` only.
- `src/ui/controller.svelte.js` is the only module that wires `core/` and
  `platform/` together and owns app state (`app`, a Svelte 5 `$state` object).
  Components call its exported actions; they do not call `platform/` directly.
- `src/platform/native/` talks to the Android `Coach` plugin. In the app the
  native engine speaks every cue itself (`speaksInBackground`), so the
  controller must not speak or hold the screen wake lock there.
- `android/wear/` is the Wear OS companion, in Kotlin + Compose for Wear OS
  (Wear OS has no WebView). The phone app's native code stays Java.
- While a run is active in the Android app, `CoachService` owns the session:
  JS sends every session change (`engine.sync`), the service applies watch
  commands itself and reports states back (`stateChanged`, `current()`).
  `tests/fixtures/session-math.json` pins `timer.js`, `SessionMath.java` and
  the watch's `RunState.kt` to the same arithmetic; change all three together.
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
- Workout data in `src/core/plan.js` was transcribed from the program's
  original screenshots (no longer kept in the repo);
  `tests/core/plan.test.js` pins each total. Do not edit the plan unless the
  user supplies the new schedule.
- `layout-target/` holds the design mockups (HTML, screenshots, design
  notes) the UI follows. Reference only; it is not part of the build.

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
