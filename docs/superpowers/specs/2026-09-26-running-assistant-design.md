# Running Assistant — Design

**Date:** 2026-09-26
**Status:** Draft, awaiting review

## Purpose

A mobile-friendly website that guides the user through a 5-week walk/jog/run
interval program and tracks which workouts are done. The program comes from the
15 screenshots in `image-sources/` ("Correndo para a perda de peso").

Primary use: on a treadmill, Android phone with Chrome, screen always on, but
Chrome **may be in the background** (another app in front). Phase-change cues
must still be heard in that situation.

### Success criteria

- All 15 workouts are available, with intervals exactly as in the screenshots.
- Starting a workout gives an audible cue at every phase change, on time, even
  while Chrome is in the background on Android.
- Completed workouts are remembered across visits (localStorage) and the next
  workout is suggested.
- The UI is in Portuguese by default and can be switched to English. All
  user-facing text lives in resource files.

### Constraints

- Frontend only: no backend, no database, no login.
- Persistence via localStorage only.
- Everything in the codebase (identifiers, file names, storage keys, comments)
  is in English. Portuguese appears only in the Portuguese resource file.
- Durations are stored in seconds.
- Must stay portable: a native Android version (Capacitor wrapper, or a
  rewrite) may follow if the web version's background behaviour is not good
  enough.

### Out of scope (v1)

History beyond the last completion date, statistics, custom or editable plans,
backend or accounts, service-worker offline mode, progress export/import.

## Stack

- Vite + Svelte 5 + JavaScript (no TypeScript, no SvelteKit).
- JSDoc typedefs for the core data shapes.
- vitest for unit tests of `src/core/`.
- Minimal PWA: web app manifest + icon (no service worker).

## Architecture

```
src/
  core/            pure JavaScript; no DOM, no Svelte, no browser APIs
    plan.js          the 15 workouts
    timer.js         session state derived from the clock
    progress.js      completion tracking
  platform/        browser adapters; the only code touching browser APIs
    audio.js         Web Audio cue scheduling
    speech.js        speechSynthesis voice cues
    wakeLock.js      Screen Wake Lock
    storage.js       localStorage access
  i18n/
    pt.js            Portuguese strings (default)
    en.js            English strings
    index.js         t(key, params), language store, duration formatting
  ui/
    App.svelte       screen switching by app state
    PlanScreen.svelte
    WorkoutScreen.svelte
    RunScreen.svelte
    FinishedScreen.svelte
    components/      shared pieces (interval row, buttons, …)
  main.js
```

Dependency rule: `ui` → `core`, `platform`, `i18n`; `platform` → `core` only
for data shapes; `core` depends on nothing. This keeps `core/` portable to a
native app unchanged, and makes `platform/` the only layer to replace when
wrapping with Capacitor.

## Data

### Plan (`core/plan.js`)

```js
/** @typedef {'walk' | 'jog' | 'run'} PhaseType */
/** @typedef {{ type: PhaseType, seconds: number }} Phase */
/** @typedef {{ id: string, week: number, day: number, phases: Phase[] }} Workout */
```

IDs are `w{week}d{day}` (e.g. `w1d1`). Totals are computed, not stored.
Transcribed from the screenshots (W = walk, J = jog, R = run, in minutes):

| Week | Day 1 | Day 2 | Day 3 |
|---|---|---|---|
| 1 | W6 J2 W6 J2 R5 (21) | W7 J2 W7 J2 R5 (23) | W7 J2 W7 J2 R5 (23) |
| 2 | W6 J2 W6 J2 R5 (21) | W7 J2 W7 J2 R5 (23) | W6 J2 W6 J2 R5 (21) |
| 3 | W9 J2 W9 J2 R5 (27) | W9 J2 W9 J2 R5 (27) | W7 J2 W7 J2 R5 (23) |
| 4 | W9 J2 W9 J2 R5 (27) | W5 J2 W5 J2 W5 J2 R5 (26) | W7 J2 W7 J3 W7 J3 R5 (34) |
| 5 | W7 J2 W7 J3 W7 J3 R5 (34) | W9 J2 W9 J2 R5 (27) | W7 J2 W7 J3 W7 J3 R5 (34) |

The plan is reproduced as given; no warm-up phases are added.

### Session (`core/timer.js`)

```js
/** @typedef {{
 *   workoutId: string,
 *   startedAt: number,      // epoch ms
 *   pausedAt: number|null,  // epoch ms while paused
 *   pausedTotalMs: number,
 *   skippedMs: number
 * }} Session */
```

### Progress (`core/progress.js`)

```js
/** @typedef {{ completed: Record<string, string> }} Progress */
// workoutId -> ISO date of last completion
```

## Components

### `core/timer.js`

Pure functions; never holds timers.

- `startSession(workoutId, now)` → Session
- `pauseSession(session, now)`, `resumeSession(session, now)` → Session
- `skipPhase(session, workout, now)` → Session (adds the rest of the current
  phase to `skippedMs`)
- `getState(session, workout, now)` →
  `{ phaseIndex, phaseRemainingMs, totalRemainingMs, elapsedMs, finished }`

Elapsed time = `(pausedAt ?? now) − startedAt − pausedTotalMs + skippedMs`,
clamped to the workout total. Because state is derived from timestamps,
throttled or suspended JavaScript never makes the display wrong once it runs
again.

### `core/progress.js`

- `nextWorkout(plan, progress)` → first workout in plan order not completed,
  or `null` when all are done.
- `markDone(progress, workoutId, isoDate)` → Progress (repeats overwrite the date)
- `unmark(progress, workoutId)` → Progress

### `platform/audio.js`

The background-reliability mechanism.

- `createCuePlayer()` → `{ start(session, workout, now), stop(), supported }`.
  Must be created/started from a user gesture ("Vamos!" tap).
- `start` schedules **every remaining cue** at once on the `AudioContext`
  clock, computed from `getState`:
  - 3 short countdown pips in the last 3 s of each phase;
  - a phase-start tone distinct per type: walk = low single, jog = medium
    single, run = high double;
  - a finish melody at the end.
- `stop` cancels all scheduled nodes. Pause/skip/stop call `stop`; resume and
  skip then call `start` again from the new state.
- While a session runs, a near-silent continuous tone plays so Chrome treats
  the tab as audible, exempting it from intensive background throttling.

### `platform/speech.js`

- `announcePhase(phase, lang)` speaks e.g. "Correr por 5 minutos" via
  `speechSynthesis` with a `pt-BR` / `en-US` voice.
- Only called when `document.visibilityState === 'visible'`; in the
  background, the beeps are the cue.

### `platform/wakeLock.js`

Requests a screen wake lock on start and re-requests on `visibilitychange` to
visible. Silently no-op when unsupported or refused.

### `platform/storage.js`

Keys: `runningAssistant.progress`, `runningAssistant.session`,
`runningAssistant.lang`. Values are JSON with a `version: 1` field. All reads
wrapped in try/catch; missing, corrupt or unknown-version data returns the
default instead of throwing.

### `i18n/`

- `pt.js` / `en.js`: flat key → string maps, e.g.
  `'phase.walk'`, `'workout.title'` (`'Semana {week} - Dia {day}'`),
  `'workout.start'` (`'Vamos!'`), `'cue.phase'` (`'{phase} por {duration}'`).
- `index.js`: `t(key, params)` with `{name}` interpolation; a Svelte store for
  the current language (default `pt`, persisted via storage);
  `formatDuration(seconds, lang)` → "5 minutos" / "5 minutes" /
  "90 segundos" / "90 seconds". Missing keys fall back to `pt`, then to the key.

## Screens and flow

State-based switching in `App.svelte`, no URL routing.

1. **Plan (home):** weeks 1–5, each with its 3 day cards showing total time
   and a ✓ when completed. The next workout is highlighted and a "Continue"
   button opens it. Any workout can be opened. PT/EN language toggle.
2. **Workout:** mirrors the screenshot — "Semana X - Dia Y", total time,
   interval list with icons and durations. Button "Vamos!" starts the run. If
   the workout is completed, a small "unmark" action is shown.
3. **Run:** large phase name and countdown, full-screen colour per phase type,
   next phase, total remaining, progress bar. Buttons: pause/resume, skip
   phase, stop (with confirmation). The UI refreshes ~4×/s while visible.
4. **Finished:** "Treino concluído!" message; the workout is marked done
   automatically; button back to the plan.

Visual style follows the screenshots: dark background, mint/green headings, a
green primary button, list rows with thin separators.

**Resume after reload:** the active session is saved on start, pause, resume
and skip. On load, a saved session younger than 2 hours offers "resume" or
"discard"; older ones are discarded silently. Resuming requires a tap (needed
to restart audio).

## Error handling

- Web Audio unsupported or blocked: show a notice on the Run screen; the
  visual timer continues.
- Wake Lock or speech unsupported: silently skipped.
- Corrupt storage: fall back to defaults (see storage).

## Testing

- vitest unit tests for `core/`:
  - `timer`: phase boundaries, exact end of workout, pause/resume
    arithmetic, multiple pauses, skip, skip on last phase finishes,
    clamping past the end;
  - `progress`: next workout, all done, mark/unmark, repeat overwrites date;
  - `plan`: 15 workouts, IDs unique, each total matches the screenshot total
    in the table above.
- vitest for `i18n`: every key in `pt` exists in `en` and vice versa;
  interpolation; duration formatting.
- Manual test on the Android phone: start a workout, switch to another app,
  confirm phase cues arrive on time for at least one full phase change; pause
  and resume; reload mid-workout and resume.

## Deployment

`npm run build` produces static files deployable to GitHub Pages or Netlify.
For phone testing on the local network: `npm run dev -- --host`. Note that
Wake Lock requires a secure context; `localhost` qualifies, a LAN IP over
plain HTTP does not, so Wake Lock will be absent in LAN testing (acceptable,
since the screen stays on anyway) and fully available once deployed over HTTPS.
