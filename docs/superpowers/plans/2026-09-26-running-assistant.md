# Running Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-friendly website that guides a treadmill interval workout (walk/jog/run) with audio cues that keep working while Chrome is in the background, and tracks progress through a 15-workout plan in localStorage.

**Architecture:** Pure-JS `core/` (plan data, clock-derived timer, cue schedule, progress) with no browser APIs; thin `platform/` adapters (Web Audio, speech, wake lock, localStorage); `i18n/` resource files (pt default, en); Svelte 5 `ui/` with one controller module holding app state. All cues for a run are pre-scheduled on the `AudioContext` clock so background throttling cannot delay them.

**Tech Stack:** Vite 8, Svelte 5 (runes), JavaScript with JSDoc typedefs, vitest 5. Node 24 is installed.

**Spec:** `docs/superpowers/specs/2026-09-26-running-assistant-design.md`

**Refinements to the spec made while planning (intentional):**
- The cue schedule is computed by a pure `core/cues.js` so it can be unit-tested; `platform/audio.js` only turns it into sound.
- `platform/speech.js` exposes `speak(text, locale)`; the controller builds the text via i18n (keeps `platform/` free of i18n).
- The resume rule is a pure `shouldOfferResume(session, now)` in `core/timer.js` so it can be tested.
- `platform/storage.js` returns the raw saved language; the controller validates it against `LANGS`.

## Global Constraints

- Frontend only: no backend, no database, no login. Persistence via localStorage only.
- Everything in the codebase (identifiers, file names, storage keys, comments, commit messages) is in English. Portuguese appears only in `src/i18n/pt.js` (and in tests asserting Portuguese output).
- Never use "corrida" anywhere in code. Durations are stored and passed in seconds: no `minutes` fields, parameters or placeholders (spoken cues use `{duration}`). The only exception is the i18n unit keys `unit.minute.*`, which name the word being displayed.
- Storage keys: `runningAssistant.progress`, `runningAssistant.session`, `runningAssistant.lang`; values are JSON `{ "version": 1, "data": ... }`.
- All user-facing text comes from `src/i18n/pt.js` / `src/i18n/en.js`; default language `pt`.
- Dependency rule: `core/` imports nothing outside `core/`; `platform/` imports only from `core/`; `ui/` may import everything.
- Plain Vite + Svelte 5, JavaScript, no TypeScript, no SvelteKit, no router, no i18n library.
- Every commit message ends with the trailer line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (passed as a second `-m`).

## Review Focus

1. **Device clock goes backwards** (NTP correction) mid-run → elapsed time clamps to 0, never negative. Test: Task 2 `treats a clock that went backwards as the start`.
2. **Reload while paused** → the restored session stays paused and paused time is not counted. Test: Task 2 `keeps a restored paused session paused with the same elapsed time`.
3. **Skip while paused** → moves to the start of the next phase and stays paused; no cues are scheduled while paused. Tests: Task 2 `keeps a paused session paused at the next phase start`, Task 3 `schedules nothing while paused`.
4. **localStorage unavailable or throwing** (private mode, quota, blocked site data) → app runs with defaults and never crashes. Tests: Task 6 `works with no backend at all`, `swallows errors thrown by the backend`.
5. **Saved session for a workout not in the plan, or too old** → not offered for resume. Tests: Task 2 `shouldOfferResume` block.

---

## File Structure

```
package.json, vite.config.js, index.html
README.md, AGENTS.md, CLAUDE.md  human docs; agent instructions (CLAUDE.md imports AGENTS.md)
public/manifest.webmanifest, public/icon.svg
src/main.js                      entry: init controller, mount App
src/app.css                      global styles (single stylesheet; the app is small)
src/core/plan.js                 PLAN data, findWorkout, totalSeconds, groupByWeek
src/core/timer.js                session functions, getState, formatClock, shouldOfferResume
src/core/cues.js                 upcomingCues: the audio cue schedule
src/core/progress.js             emptyProgress, isDone, nextWorkout, markDone, unmark
src/i18n/pt.js, src/i18n/en.js   string resources
src/i18n/index.js                translate, formatDuration, LANGS, DEFAULT_LANG, LOCALES
src/platform/storage.js          createStorage(backend)
src/platform/audio.js            createCuePlayer()
src/platform/speech.js           speak(text, locale)
src/platform/wakeLock.js         createWakeLock()
src/ui/controller.svelte.js      app state + actions (only file that wires core+platform)
src/ui/App.svelte                screen switch
src/ui/PlanScreen.svelte, WorkoutScreen.svelte, RunScreen.svelte, FinishedScreen.svelte
src/ui/components/PhaseIcon.svelte, ResumeDialog.svelte
tests/core/*.test.js, tests/i18n/i18n.test.js, tests/platform/storage.test.js
```

Test workout used throughout: `w1d1` = walk 360 s, jog 120 s, walk 360 s, jog 120 s, run 300 s → total 1260 s. Phase boundaries (s): 0–360, 360–480, 480–840, 840–960, 960–1260.

---

### Task 1: Project scaffold and plan data

**Files:**
- Create: `package.json` (via npm), `vite.config.js`, `index.html`, `src/main.js`, `src/ui/App.svelte`, `src/core/plan.js`
- Test: `tests/core/plan.test.js`

**Interfaces:**
- Produces:
  - `PLAN: Workout[]` (15 items, plan order)
  - `findWorkout(id: string): Workout | null`
  - `totalSeconds(workout: Workout): number`
  - `groupByWeek(plan: Workout[]): { week: number, workouts: Workout[] }[]`
  - typedefs `PhaseType = 'walk'|'jog'|'run'`, `Phase = { type, seconds }`, `Workout = { id, week, day, phases }`; ids are `w{week}d{day}`

- [ ] **Step 1: Initialise npm and install dev dependencies**

Run (from `D:\projeto-corrida`):
```bash
npm init -y
npm install -D vite@^8.3.1 svelte@^5.57.1 @sveltejs/vite-plugin-svelte@^7.3.1 vitest@^5.0.2
```
Then edit `package.json` so the top-level fields are exactly (keep the generated `devDependencies` block as installed):
```json
{
  "name": "lose-weight-running-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```
Remove `main`, `keywords`, `author`, `license`, `description` if `npm init` added them.

- [ ] **Step 2: Create `vite.config.js`**

```js
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // Relative base so the build works from any sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [svelte()],
  test: {
    include: ['tests/**/*.test.js'],
  },
});
```

- [ ] **Step 3: Create `index.html`, `src/main.js`, placeholder `src/ui/App.svelte`**

`index.html`:
```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#15161b" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Oswald:wght@500;600&display=swap"
      rel="stylesheet"
    />
    <title>Running Assistant</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

`src/main.js`:
```js
import { mount } from 'svelte';
import App from './ui/App.svelte';

mount(App, { target: document.getElementById('app') });
```

`src/ui/App.svelte` (placeholder, replaced in Task 8):
```svelte
<main class="app">
  <h1>Running Assistant</h1>
</main>
```

- [ ] **Step 4: Write the failing plan test** — `tests/core/plan.test.js`

```js
import { describe, it, expect } from 'vitest';
import { PLAN, findWorkout, totalSeconds, groupByWeek } from '../../src/core/plan.js';

// Totals (in minutes) exactly as printed on each screenshot in image-sources/.
const SCREENSHOT_TOTALS = {
  w1d1: 21, w1d2: 23, w1d3: 23,
  w2d1: 21, w2d2: 23, w2d3: 21,
  w3d1: 27, w3d2: 27, w3d3: 23,
  w4d1: 27, w4d2: 26, w4d3: 34,
  w5d1: 34, w5d2: 27, w5d3: 34,
};

describe('PLAN', () => {
  it('has 15 workouts in week/day order with unique ids', () => {
    expect(PLAN.map((w) => w.id)).toEqual(Object.keys(SCREENSHOT_TOTALS));
    expect(new Set(PLAN.map((w) => w.id)).size).toBe(15);
  });

  it('matches every screenshot total', () => {
    for (const workout of PLAN) {
      expect(totalSeconds(workout), workout.id).toBe(SCREENSHOT_TOTALS[workout.id] * 60);
    }
  });

  it('ends every workout with a 5-minute run', () => {
    for (const workout of PLAN) {
      expect(workout.phases.at(-1), workout.id).toEqual({ type: 'run', seconds: 300 });
    }
  });

  it('transcribes the 7-phase workouts exactly', () => {
    expect(findWorkout('w4d2').phases.map((p) => [p.type, p.seconds])).toEqual([
      ['walk', 300], ['jog', 120], ['walk', 300], ['jog', 120], ['walk', 300], ['jog', 120], ['run', 300],
    ]);
    expect(findWorkout('w4d3').phases.map((p) => [p.type, p.seconds])).toEqual([
      ['walk', 420], ['jog', 120], ['walk', 420], ['jog', 180], ['walk', 420], ['jog', 180], ['run', 300],
    ]);
  });
});

describe('findWorkout', () => {
  it('returns the workout with week and day', () => {
    expect(findWorkout('w3d2')).toMatchObject({ id: 'w3d2', week: 3, day: 2 });
  });

  it('returns null for an unknown id', () => {
    expect(findWorkout('w9d9')).toBeNull();
  });
});

describe('groupByWeek', () => {
  it('groups into 5 weeks of 3 days', () => {
    const weeks = groupByWeek(PLAN);
    expect(weeks.map((w) => w.week)).toEqual([1, 2, 3, 4, 5]);
    expect(weeks.every((w) => w.workouts.length === 3)).toBe(true);
    expect(weeks[1].workouts.map((w) => w.id)).toEqual(['w2d1', 'w2d2', 'w2d3']);
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../../src/core/plan.js`.

- [ ] **Step 6: Implement `src/core/plan.js`**

```js
/** @typedef {'walk' | 'jog' | 'run'} PhaseType */
/** @typedef {{ type: PhaseType, seconds: number }} Phase */
/** @typedef {{ id: string, week: number, day: number, phases: Phase[] }} Workout */

/** @param {number} seconds @returns {Phase} */
const walk = (seconds) => ({ type: 'walk', seconds });
/** @param {number} seconds @returns {Phase} */
const jog = (seconds) => ({ type: 'jog', seconds });
/** @param {number} seconds @returns {Phase} */
const run = (seconds) => ({ type: 'run', seconds });

/** @returns {Workout} */
function workout(week, day, phases) {
  return { id: `w${week}d${day}`, week, day, phases };
}

// Transcribed from the screenshots in image-sources/ (weekN-dayM.jpeg).
/** @type {Workout[]} */
export const PLAN = [
  workout(1, 1, [walk(6 * 60), jog(2 * 60), walk(6 * 60), jog(2 * 60), run(5 * 60)]),
  workout(1, 2, [walk(7 * 60), jog(2 * 60), walk(7 * 60), jog(2 * 60), run(5 * 60)]),
  workout(1, 3, [walk(7 * 60), jog(2 * 60), walk(7 * 60), jog(2 * 60), run(5 * 60)]),
  workout(2, 1, [walk(6 * 60), jog(2 * 60), walk(6 * 60), jog(2 * 60), run(5 * 60)]),
  workout(2, 2, [walk(7 * 60), jog(2 * 60), walk(7 * 60), jog(2 * 60), run(5 * 60)]),
  workout(2, 3, [walk(6 * 60), jog(2 * 60), walk(6 * 60), jog(2 * 60), run(5 * 60)]),
  workout(3, 1, [walk(9 * 60), jog(2 * 60), walk(9 * 60), jog(2 * 60), run(5 * 60)]),
  workout(3, 2, [walk(9 * 60), jog(2 * 60), walk(9 * 60), jog(2 * 60), run(5 * 60)]),
  workout(3, 3, [walk(7 * 60), jog(2 * 60), walk(7 * 60), jog(2 * 60), run(5 * 60)]),
  workout(4, 1, [walk(9 * 60), jog(2 * 60), walk(9 * 60), jog(2 * 60), run(5 * 60)]),
  workout(4, 2, [walk(5 * 60), jog(2 * 60), walk(5 * 60), jog(2 * 60), walk(5 * 60), jog(2 * 60), run(5 * 60)]),
  workout(4, 3, [walk(7 * 60), jog(2 * 60), walk(7 * 60), jog(3 * 60), walk(7 * 60), jog(3 * 60), run(5 * 60)]),
  workout(5, 1, [walk(7 * 60), jog(2 * 60), walk(7 * 60), jog(3 * 60), walk(7 * 60), jog(3 * 60), run(5 * 60)]),
  workout(5, 2, [walk(9 * 60), jog(2 * 60), walk(9 * 60), jog(2 * 60), run(5 * 60)]),
  workout(5, 3, [walk(7 * 60), jog(2 * 60), walk(7 * 60), jog(3 * 60), walk(7 * 60), jog(3 * 60), run(5 * 60)]),
];

/** @param {string} id @returns {Workout | null} */
export function findWorkout(id) {
  return PLAN.find((w) => w.id === id) ?? null;
}

/** @param {Workout} workout */
export function totalSeconds(workout) {
  return workout.phases.reduce((sum, phase) => sum + phase.seconds, 0);
}

/** @param {Workout[]} plan @returns {{ week: number, workouts: Workout[] }[]} */
export function groupByWeek(plan) {
  const weeks = [];
  for (const w of plan) {
    const last = weeks.at(-1);
    if (last?.week === w.week) last.workouts.push(w);
    else weeks.push({ week: w.week, workouts: [w] });
  }
  return weeks;
}
```

- [ ] **Step 7: Run tests and build**

Run: `npm test` → Expected: all plan tests PASS.
Run: `npm run build` → Expected: build succeeds, `dist/` created.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html src tests
git commit -m "feat: scaffold Vite + Svelte app with workout plan data" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Timer engine

**Files:**
- Create: `src/core/timer.js`
- Test: `tests/core/timer.test.js`

**Interfaces:**
- Consumes: `findWorkout`, `totalSeconds` from `src/core/plan.js`
- Produces:
  - typedef `Session = { workoutId: string, startedAt: number, pausedAt: number|null, pausedTotalMs: number, skippedMs: number }` (epoch ms)
  - typedef `TimerState = { phaseIndex, phaseRemainingMs, totalRemainingMs, elapsedMs, finished: boolean, paused: boolean }`
  - `startSession(workoutId, now): Session`
  - `pauseSession(session, now): Session`, `resumeSession(session, now): Session`
  - `skipPhase(session, workout, now): Session`
  - `elapsedMs(session, workout, now): number` (clamped to `[0, total]`)
  - `phaseBoundaries(workout): { startMs, endMs }[]`
  - `getState(session, workout, now): TimerState`
  - `formatClock(ms): string` → `"mm:ss"`, seconds rounded **up**
  - `RESUME_MAX_AGE_MS = 7_200_000`, `shouldOfferResume(session, now): boolean`

- [ ] **Step 1: Write the failing tests** — `tests/core/timer.test.js`

```js
import { describe, it, expect } from 'vitest';
import { findWorkout } from '../../src/core/plan.js';
import {
  startSession, pauseSession, resumeSession, skipPhase, getState,
  formatClock, shouldOfferResume, RESUME_MAX_AGE_MS,
} from '../../src/core/timer.js';

const w = findWorkout('w1d1'); // 360/120/360/120/300 s, total 1260 s
const T0 = 1_000_000;
const s = (seconds) => seconds * 1000;
const fresh = () => startSession('w1d1', T0);

describe('getState', () => {
  it('starts in the first phase with its full duration', () => {
    expect(getState(fresh(), w, T0)).toEqual({
      phaseIndex: 0, phaseRemainingMs: s(360), totalRemainingMs: s(1260),
      elapsedMs: 0, finished: false, paused: false,
    });
  });

  it('moves to the next phase exactly at the boundary', () => {
    expect(getState(fresh(), w, T0 + s(360) - 1).phaseIndex).toBe(0);
    expect(getState(fresh(), w, T0 + s(360)).phaseIndex).toBe(1);
    expect(getState(fresh(), w, T0 + s(360)).phaseRemainingMs).toBe(s(120));
  });

  it('is finished exactly at the total', () => {
    expect(getState(fresh(), w, T0 + s(1260))).toMatchObject({
      finished: true, phaseIndex: 4, phaseRemainingMs: 0, totalRemainingMs: 0,
    });
    expect(getState(fresh(), w, T0 + s(1260) - 1).finished).toBe(false);
  });

  it('clamps past the end', () => {
    expect(getState(fresh(), w, T0 + s(5000)).elapsedMs).toBe(s(1260));
  });

  it('treats a clock that went backwards as the start', () => {
    expect(getState(fresh(), w, T0 - 5000)).toMatchObject({ elapsedMs: 0, phaseIndex: 0 });
  });
});

describe('pause and resume', () => {
  it('freezes time while paused', () => {
    const paused = pauseSession(fresh(), T0 + s(10));
    expect(getState(paused, w, T0 + s(500))).toMatchObject({ elapsedMs: s(10), paused: true });
  });

  it('does not count paused time after resume', () => {
    const paused = pauseSession(fresh(), T0 + s(10));
    const resumed = resumeSession(paused, T0 + s(100));
    expect(getState(resumed, w, T0 + s(110))).toMatchObject({ elapsedMs: s(20), paused: false });
  });

  it('accumulates multiple pauses', () => {
    let session = pauseSession(fresh(), T0 + s(10));
    session = resumeSession(session, T0 + s(20));
    session = pauseSession(session, T0 + s(30));
    session = resumeSession(session, T0 + s(50));
    expect(getState(session, w, T0 + s(60)).elapsedMs).toBe(s(30));
  });

  it('ignores pause when paused and resume when running', () => {
    const paused = pauseSession(fresh(), T0 + s(10));
    expect(pauseSession(paused, T0 + s(20))).toBe(paused);
    const running = fresh();
    expect(resumeSession(running, T0 + s(20))).toBe(running);
  });

  it('keeps a restored paused session paused with the same elapsed time', () => {
    const paused = pauseSession(fresh(), T0 + s(10));
    const restored = JSON.parse(JSON.stringify(paused));
    expect(getState(restored, w, T0 + s(3000))).toMatchObject({ elapsedMs: s(10), paused: true });
  });
});

describe('skipPhase', () => {
  it('jumps to the start of the next phase', () => {
    const skipped = skipPhase(fresh(), w, T0 + s(100));
    expect(getState(skipped, w, T0 + s(100))).toMatchObject({ phaseIndex: 1, phaseRemainingMs: s(120) });
  });

  it('keeps a paused session paused at the next phase start', () => {
    const paused = pauseSession(fresh(), T0 + s(100));
    const skipped = skipPhase(paused, w, T0 + s(200));
    expect(getState(skipped, w, T0 + s(300))).toMatchObject({
      paused: true, phaseIndex: 1, phaseRemainingMs: s(120),
    });
  });

  it('finishes the workout when skipping the last phase', () => {
    const skipped = skipPhase(fresh(), w, T0 + s(1000));
    expect(getState(skipped, w, T0 + s(1000)).finished).toBe(true);
  });

  it('does nothing when already finished', () => {
    const session = fresh();
    expect(skipPhase(session, w, T0 + s(2000))).toBe(session);
  });
});

describe('formatClock', () => {
  it('formats as mm:ss rounding up partial seconds', () => {
    expect(formatClock(s(360))).toBe('06:00');
    expect(formatClock(59_001)).toBe('01:00');
    expect(formatClock(1)).toBe('00:01');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(-5)).toBe('00:00');
    expect(formatClock(s(3600))).toBe('60:00');
  });
});

describe('shouldOfferResume', () => {
  it('offers a recent session', () => {
    expect(shouldOfferResume(fresh(), T0 + RESUME_MAX_AGE_MS - 1)).toBe(true);
  });

  it('rejects a session at or beyond the max age', () => {
    expect(shouldOfferResume(fresh(), T0 + RESUME_MAX_AGE_MS)).toBe(false);
  });

  it('rejects a session for a workout that is not in the plan', () => {
    expect(shouldOfferResume(startSession('w9d9', T0), T0 + 1000)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/core/timer.test.js`
Expected: FAIL — cannot resolve `../../src/core/timer.js`.

- [ ] **Step 3: Implement `src/core/timer.js`**

```js
import { findWorkout, totalSeconds } from './plan.js';

/** @typedef {import('./plan.js').Workout} Workout */

/**
 * All times are epoch milliseconds. State is always derived from these
 * timestamps, never from counting ticks, so throttled or suspended
 * JavaScript cannot make the timer drift.
 * @typedef {{
 *   workoutId: string,
 *   startedAt: number,
 *   pausedAt: number | null,
 *   pausedTotalMs: number,
 *   skippedMs: number
 * }} Session
 */

/**
 * @typedef {{
 *   phaseIndex: number,
 *   phaseRemainingMs: number,
 *   totalRemainingMs: number,
 *   elapsedMs: number,
 *   finished: boolean,
 *   paused: boolean
 * }} TimerState
 */

export const RESUME_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** @returns {Session} */
export function startSession(workoutId, now) {
  return { workoutId, startedAt: now, pausedAt: null, pausedTotalMs: 0, skippedMs: 0 };
}

/** @param {Session} session @returns {Session} */
export function pauseSession(session, now) {
  if (session.pausedAt !== null) return session;
  return { ...session, pausedAt: now };
}

/** @param {Session} session @returns {Session} */
export function resumeSession(session, now) {
  if (session.pausedAt === null) return session;
  return {
    ...session,
    pausedAt: null,
    pausedTotalMs: session.pausedTotalMs + Math.max(0, now - session.pausedAt),
  };
}

/** @param {Workout} workout @returns {{ startMs: number, endMs: number }[]} */
export function phaseBoundaries(workout) {
  let startMs = 0;
  return workout.phases.map((phase) => {
    const bounds = { startMs, endMs: startMs + phase.seconds * 1000 };
    startMs = bounds.endMs;
    return bounds;
  });
}

/** @param {Session} session @param {Workout} workout */
export function elapsedMs(session, workout, now) {
  const totalMs = totalSeconds(workout) * 1000;
  const at = session.pausedAt ?? now;
  const raw = at - session.startedAt - session.pausedTotalMs + session.skippedMs;
  return Math.min(totalMs, Math.max(0, raw));
}

/** @param {Session} session @param {Workout} workout @returns {TimerState} */
export function getState(session, workout, now) {
  const bounds = phaseBoundaries(workout);
  const totalMs = bounds.at(-1).endMs;
  const elapsed = elapsedMs(session, workout, now);
  const finished = elapsed >= totalMs;
  const phaseIndex = finished ? bounds.length - 1 : bounds.findIndex((b) => elapsed < b.endMs);
  return {
    phaseIndex,
    phaseRemainingMs: finished ? 0 : bounds[phaseIndex].endMs - elapsed,
    totalRemainingMs: totalMs - elapsed,
    elapsedMs: elapsed,
    finished,
    paused: session.pausedAt !== null,
  };
}

/** @param {Session} session @param {Workout} workout @returns {Session} */
export function skipPhase(session, workout, now) {
  const state = getState(session, workout, now);
  if (state.finished) return session;
  return { ...session, skippedMs: session.skippedMs + state.phaseRemainingMs };
}

/** Countdown display: rounds up so a phase shows "06:00" at its start and "00:01" in its last second. */
export function formatClock(ms) {
  const totalSec = Math.ceil(Math.max(0, ms) / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** @param {Session} session */
export function shouldOfferResume(session, now) {
  return findWorkout(session.workoutId) !== null && now - session.startedAt < RESUME_MAX_AGE_MS;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/timer.js tests/core/timer.test.js
git commit -m "feat: add clock-derived workout timer engine" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Cue schedule

**Files:**
- Create: `src/core/cues.js`
- Test: `tests/core/cues.test.js`

**Interfaces:**
- Consumes: `phaseBoundaries`, `getState` from `src/core/timer.js`
- Produces:
  - typedef `CueKind = 'pip' | 'walk' | 'jog' | 'run' | 'finish'`
  - typedef `Cue = { kind: CueKind, inMs: number }` (`inMs` = delay from `now`)
  - `COUNTDOWN_PIPS = 3`
  - `upcomingCues(session, workout, now): Cue[]` sorted by `inMs` ascending

Rules: each phase gets a start cue of its type at its start; 3 pips at 3 s, 2 s and 1 s before each phase end (only if inside the phase); one `finish` at the total. Only cues at or after the current elapsed time are returned. Paused or finished sessions return `[]`.

- [ ] **Step 1: Write the failing tests** — `tests/core/cues.test.js`

```js
import { describe, it, expect } from 'vitest';
import { findWorkout } from '../../src/core/plan.js';
import { startSession, pauseSession } from '../../src/core/timer.js';
import { upcomingCues } from '../../src/core/cues.js';

const w = findWorkout('w1d1'); // 360/120/360/120/300 s
const T0 = 1_000_000;
const s = (seconds) => seconds * 1000;
const fresh = () => startSession('w1d1', T0);

describe('upcomingCues', () => {
  it('schedules every cue for a fresh session', () => {
    const cues = upcomingCues(fresh(), w, T0);
    expect(cues).toHaveLength(5 + 5 * 3 + 1);
    expect(cues.slice(0, 5)).toEqual([
      { kind: 'walk', inMs: 0 },
      { kind: 'pip', inMs: s(357) },
      { kind: 'pip', inMs: s(358) },
      { kind: 'pip', inMs: s(359) },
      { kind: 'jog', inMs: s(360) },
    ]);
    expect(cues.at(-1)).toEqual({ kind: 'finish', inMs: s(1260) });
    expect(cues.find((c) => c.kind === 'run')).toEqual({ kind: 'run', inMs: s(960) });
  });

  it('is sorted by time', () => {
    const times = upcomingCues(fresh(), w, T0).map((c) => c.inMs);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('drops cues that are already past and offsets the rest from now', () => {
    const cues = upcomingCues(fresh(), w, T0 + 359_500);
    expect(cues[0]).toEqual({ kind: 'jog', inMs: 500 });
  });

  it('schedules nothing while paused', () => {
    expect(upcomingCues(pauseSession(fresh(), T0 + s(10)), w, T0 + s(20))).toEqual([]);
  });

  it('schedules nothing once finished', () => {
    expect(upcomingCues(fresh(), w, T0 + s(1260))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/core/cues.test.js`
Expected: FAIL — cannot resolve `../../src/core/cues.js`.

- [ ] **Step 3: Implement `src/core/cues.js`**

```js
import { getState, phaseBoundaries } from './timer.js';

/** @typedef {'pip' | 'walk' | 'jog' | 'run' | 'finish'} CueKind */
/** @typedef {{ kind: CueKind, inMs: number }} Cue */

export const COUNTDOWN_PIPS = 3;

/**
 * Every audio cue still ahead in the workout, as delays from `now`.
 * The audio layer schedules all of them at once so they fire on time
 * even if the page's JavaScript is throttled in the background.
 * @param {import('./timer.js').Session} session
 * @param {import('./plan.js').Workout} workout
 * @returns {Cue[]}
 */
export function upcomingCues(session, workout, now) {
  const state = getState(session, workout, now);
  if (state.paused || state.finished) return [];

  const elapsed = state.elapsedMs;
  const bounds = phaseBoundaries(workout);
  const cues = [];
  bounds.forEach(({ startMs, endMs }, i) => {
    cues.push({ kind: workout.phases[i].type, atMs: startMs });
    for (let k = COUNTDOWN_PIPS; k >= 1; k--) {
      const atMs = endMs - k * 1000;
      if (atMs > startMs) cues.push({ kind: 'pip', atMs });
    }
  });
  cues.push({ kind: 'finish', atMs: bounds.at(-1).endMs });

  return cues
    .filter((cue) => cue.atMs >= elapsed)
    .sort((a, b) => a.atMs - b.atMs)
    .map((cue) => ({ kind: cue.kind, inMs: cue.atMs - elapsed }));
}
```

- [ ] **Step 4: Run tests**

Run: `npm test` → Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/cues.js tests/core/cues.test.js
git commit -m "feat: compute audio cue schedule for a session" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Progress tracking

**Files:**
- Create: `src/core/progress.js`
- Test: `tests/core/progress.test.js`

**Interfaces:**
- Produces:
  - typedef `Progress = { completed: Record<string, string> }` (workoutId → ISO date of last completion)
  - `emptyProgress(): Progress`
  - `isDone(progress, workoutId): boolean`
  - `nextWorkout(plan, progress): Workout | null`
  - `markDone(progress, workoutId, isoDate): Progress`
  - `unmark(progress, workoutId): Progress`
- All functions return new objects; inputs are never mutated.

- [ ] **Step 1: Write the failing tests** — `tests/core/progress.test.js`

```js
import { describe, it, expect } from 'vitest';
import { PLAN } from '../../src/core/plan.js';
import { emptyProgress, isDone, nextWorkout, markDone, unmark } from '../../src/core/progress.js';

describe('progress', () => {
  it('starts empty and suggests the first workout', () => {
    expect(emptyProgress()).toEqual({ completed: {} });
    expect(nextWorkout(PLAN, emptyProgress()).id).toBe('w1d1');
  });

  it('suggests the first workout not done, in plan order', () => {
    let progress = markDone(emptyProgress(), 'w1d1', '2026-09-26T10:00:00.000Z');
    progress = markDone(progress, 'w1d3', '2026-09-27T10:00:00.000Z');
    expect(nextWorkout(PLAN, progress).id).toBe('w1d2');
  });

  it('returns null when every workout is done', () => {
    const progress = PLAN.reduce((p, w) => markDone(p, w.id, '2026-09-26T10:00:00.000Z'), emptyProgress());
    expect(nextWorkout(PLAN, progress)).toBeNull();
  });

  it('marks and unmarks without mutating the input', () => {
    const before = emptyProgress();
    const done = markDone(before, 'w2d1', '2026-09-26T10:00:00.000Z');
    expect(before).toEqual({ completed: {} });
    expect(isDone(done, 'w2d1')).toBe(true);
    const undone = unmark(done, 'w2d1');
    expect(isDone(undone, 'w2d1')).toBe(false);
    expect(isDone(done, 'w2d1')).toBe(true);
  });

  it('overwrites the date when a workout is repeated', () => {
    let progress = markDone(emptyProgress(), 'w1d1', '2026-09-26T10:00:00.000Z');
    progress = markDone(progress, 'w1d1', '2026-10-01T10:00:00.000Z');
    expect(progress.completed.w1d1).toBe('2026-10-01T10:00:00.000Z');
  });

  it('does not treat inherited object keys as done', () => {
    expect(isDone(emptyProgress(), 'toString')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/core/progress.test.js`
Expected: FAIL — cannot resolve `../../src/core/progress.js`.

- [ ] **Step 3: Implement `src/core/progress.js`**

```js
/** @typedef {import('./plan.js').Workout} Workout */
/** @typedef {{ completed: Record<string, string> }} Progress */

/** @returns {Progress} */
export function emptyProgress() {
  return { completed: {} };
}

/** @param {Progress} progress */
export function isDone(progress, workoutId) {
  return Object.hasOwn(progress.completed, workoutId);
}

/** @param {Workout[]} plan @param {Progress} progress @returns {Workout | null} */
export function nextWorkout(plan, progress) {
  return plan.find((w) => !isDone(progress, w.id)) ?? null;
}

/** @param {Progress} progress @returns {Progress} */
export function markDone(progress, workoutId, isoDate) {
  return { ...progress, completed: { ...progress.completed, [workoutId]: isoDate } };
}

/** @param {Progress} progress @returns {Progress} */
export function unmark(progress, workoutId) {
  const { [workoutId]: _removed, ...rest } = progress.completed;
  return { ...progress, completed: rest };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test` → Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/progress.js tests/core/progress.test.js
git commit -m "feat: add progress tracking functions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Internationalisation

**Files:**
- Create: `src/i18n/pt.js`, `src/i18n/en.js`, `src/i18n/index.js`
- Test: `tests/i18n/i18n.test.js`

**Interfaces:**
- Produces:
  - `LANGS = ['pt', 'en']`, `DEFAULT_LANG = 'pt'`, `LOCALES = { pt: 'pt-BR', en: 'en-US' }`
  - `translate(lang, key, params?): string` — `{name}` interpolation; unknown lang/key falls back to `pt`, then to the key itself; placeholders without a matching param are left as-is
  - `formatDuration(seconds, lang): string` — e.g. `"5 minutes"`, `"1 minute and 30 seconds"`, `"45 seconds"`
- Keys used by later tasks (must exist in both files): see Step 3.

- [ ] **Step 1: Write the failing tests** — `tests/i18n/i18n.test.js`

```js
import { describe, it, expect } from 'vitest';
import pt from '../../src/i18n/pt.js';
import en from '../../src/i18n/en.js';
import { translate, formatDuration, LANGS, DEFAULT_LANG, LOCALES } from '../../src/i18n/index.js';

describe('resources', () => {
  it('have the same keys in every language', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pt).sort());
  });

  it('declare a locale for every language', () => {
    expect(LANGS).toEqual(['pt', 'en']);
    expect(DEFAULT_LANG).toBe('pt');
    for (const lang of LANGS) expect(LOCALES[lang]).toBeTruthy();
  });
});

describe('translate', () => {
  it('interpolates params', () => {
    expect(translate('en', 'workout.title', { week: 2, day: 3 })).toBe('Week 2 - Day 3');
    expect(translate('pt', 'workout.title', { week: 2, day: 3 })).toBe('Semana 2 - Dia 3');
  });

  it('leaves placeholders without a param untouched', () => {
    expect(translate('en', 'workout.title', { week: 1 })).toBe('Week 1 - Day {day}');
  });

  it('falls back to the default language, then to the key', () => {
    expect(translate('xx', 'workout.start')).toBe(pt['workout.start']);
    expect(translate('en', 'no.such.key')).toBe('no.such.key');
  });
});

describe('formatDuration', () => {
  it('uses whole units when possible', () => {
    expect(formatDuration(300, 'en')).toBe('5 minutes');
    expect(formatDuration(60, 'en')).toBe('1 minute');
    expect(formatDuration(45, 'en')).toBe('45 seconds');
    expect(formatDuration(1, 'en')).toBe('1 second');
    expect(formatDuration(0, 'en')).toBe('0 seconds');
  });

  it('combines units', () => {
    expect(formatDuration(90, 'en')).toBe('1 minute and 30 seconds');
  });

  it('is translated', () => {
    expect(formatDuration(300, 'pt')).toBe('5 minutos');
    expect(formatDuration(90, 'pt')).toBe('1 minuto e 30 segundos');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/i18n/i18n.test.js`
Expected: FAIL — cannot resolve `../../src/i18n/pt.js`.

- [ ] **Step 3: Create the resource files**

`src/i18n/pt.js`:
```js
export default {
  'app.title': 'Correndo para a perda de peso',
  'lang.switch': 'EN',
  'plan.continue': 'Continuar: Semana {week} - Dia {day}',
  'plan.allDone': 'Programa concluído! 🎉',
  'plan.week': 'Semana {week}',
  'plan.day': 'Dia {day}',
  'plan.done': 'Concluído',
  'workout.title': 'Semana {week} - Dia {day}',
  'workout.total': '{value} min',
  'workout.start': 'Vamos!',
  'workout.back': 'Voltar',
  'workout.done': 'Concluído em {date}.',
  'workout.unmark': 'Desmarcar',
  'phase.walk': 'Caminhar',
  'phase.jog': 'Trotar',
  'phase.run': 'Correr',
  'run.next': 'Próximo: {phase} {time}',
  'run.last': 'Última fase',
  'run.remaining': 'Restante: {time}',
  'run.paused': 'Pausado',
  'run.pause': 'Pausar',
  'run.resume': 'Continuar',
  'run.skip': 'Pular fase',
  'run.stop': 'Parar',
  'run.stopConfirm': 'Parar o treino? Ele não será marcado como concluído.',
  'run.noAudio': 'Áudio indisponível. Acompanhe o cronômetro na tela.',
  'cue.phase': '{phase} por {duration}',
  'cue.finish': 'Treino concluído!',
  'finished.title': 'Treino concluído!',
  'finished.back': 'Voltar ao plano',
  'resume.title': 'Treino em andamento',
  'resume.text': 'Semana {week} - Dia {day} não foi terminado.',
  'resume.resume': 'Retomar',
  'resume.discard': 'Descartar',
  'unit.minute.one': '{n} minuto',
  'unit.minute.other': '{n} minutos',
  'unit.second.one': '{n} segundo',
  'unit.second.other': '{n} segundos',
  'unit.and': ' e ',
};
```

`src/i18n/en.js`:
```js
export default {
  'app.title': 'Running for weight loss',
  'lang.switch': 'PT',
  'plan.continue': 'Continue: Week {week} - Day {day}',
  'plan.allDone': 'Program complete! 🎉',
  'plan.week': 'Week {week}',
  'plan.day': 'Day {day}',
  'plan.done': 'Done',
  'workout.title': 'Week {week} - Day {day}',
  'workout.total': '{value} min',
  'workout.start': "Let's go!",
  'workout.back': 'Back',
  'workout.done': 'Completed on {date}.',
  'workout.unmark': 'Unmark',
  'phase.walk': 'Walk',
  'phase.jog': 'Jog',
  'phase.run': 'Run',
  'run.next': 'Next: {phase} {time}',
  'run.last': 'Last phase',
  'run.remaining': 'Remaining: {time}',
  'run.paused': 'Paused',
  'run.pause': 'Pause',
  'run.resume': 'Resume',
  'run.skip': 'Skip phase',
  'run.stop': 'Stop',
  'run.stopConfirm': 'Stop the workout? It will not be marked as completed.',
  'run.noAudio': 'Audio unavailable. Follow the on-screen timer.',
  'cue.phase': '{phase} for {duration}',
  'cue.finish': 'Workout complete!',
  'finished.title': 'Workout complete!',
  'finished.back': 'Back to plan',
  'resume.title': 'Workout in progress',
  'resume.text': 'Week {week} - Day {day} was not finished.',
  'resume.resume': 'Resume',
  'resume.discard': 'Discard',
  'unit.minute.one': '{n} minute',
  'unit.minute.other': '{n} minutes',
  'unit.second.one': '{n} second',
  'unit.second.other': '{n} seconds',
  'unit.and': ' and ',
};
```

- [ ] **Step 4: Implement `src/i18n/index.js`**

```js
import pt from './pt.js';
import en from './en.js';

export const LANGS = ['pt', 'en'];
export const DEFAULT_LANG = 'pt';
export const LOCALES = { pt: 'pt-BR', en: 'en-US' };

const DICTIONARIES = { pt, en };

/**
 * @param {string} lang
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 */
export function translate(lang, key, params = {}) {
  const template = DICTIONARIES[lang]?.[key] ?? DICTIONARIES[DEFAULT_LANG][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (placeholder, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  );
}

/** Spoken/readable duration, e.g. "5 minutes" or "1 minute and 30 seconds". */
export function formatDuration(seconds, lang) {
  const whole = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const unit = (n, name) => translate(lang, `unit.${name}.${n === 1 ? 'one' : 'other'}`, { n });
  const parts = [];
  if (whole > 0) parts.push(unit(whole, 'minute'));
  if (rest > 0 || whole === 0) parts.push(unit(rest, 'second'));
  return parts.join(translate(lang, 'unit.and'));
}
```

- [ ] **Step 5: Run tests**

Run: `npm test` → Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/i18n tests/i18n
git commit -m "feat: add Portuguese and English string resources" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Storage adapter

**Files:**
- Create: `src/platform/storage.js`
- Test: `tests/platform/storage.test.js`

**Interfaces:**
- Consumes: `emptyProgress` from `src/core/progress.js`
- Produces:
  - `STORAGE_KEYS = { progress: 'runningAssistant.progress', session: 'runningAssistant.session', lang: 'runningAssistant.lang' }`
  - `createStorage(backend?)` where `backend` is a `Storage`-like `{ getItem, setItem, removeItem }` or `null`; defaults to `globalThis.localStorage` when accessible. Returns:
    - `loadProgress(): Progress` (default `emptyProgress()`), `saveProgress(progress)`
    - `loadSession(): Session | null`, `saveSession(session)`, `clearSession()`
    - `loadLang(): string | null`, `saveLang(lang)`
- Never throws.

- [ ] **Step 1: Write the failing tests** — `tests/platform/storage.test.js`

```js
import { describe, it, expect } from 'vitest';
import { createStorage, STORAGE_KEYS } from '../../src/platform/storage.js';

function fakeBackend(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const throwingBackend = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); },
  removeItem() { throw new Error('SecurityError'); },
};

const session = { workoutId: 'w1d1', startedAt: 1000, pausedAt: null, pausedTotalMs: 0, skippedMs: 0 };

describe('createStorage', () => {
  it('uses the runningAssistant.* keys with a version envelope', () => {
    const backend = fakeBackend();
    createStorage(backend).saveLang('en');
    expect(STORAGE_KEYS).toEqual({
      progress: 'runningAssistant.progress',
      session: 'runningAssistant.session',
      lang: 'runningAssistant.lang',
    });
    expect(JSON.parse(backend.data.get('runningAssistant.lang'))).toEqual({ version: 1, data: 'en' });
  });

  it('round-trips progress, session and language', () => {
    const storage = createStorage(fakeBackend());
    storage.saveProgress({ completed: { w1d1: '2026-09-26T10:00:00.000Z' } });
    storage.saveSession(session);
    storage.saveLang('en');
    expect(storage.loadProgress()).toEqual({ completed: { w1d1: '2026-09-26T10:00:00.000Z' } });
    expect(storage.loadSession()).toEqual(session);
    expect(storage.loadLang()).toBe('en');
  });

  it('clears the session', () => {
    const storage = createStorage(fakeBackend());
    storage.saveSession(session);
    storage.clearSession();
    expect(storage.loadSession()).toBeNull();
  });

  it('returns defaults when nothing is saved', () => {
    const storage = createStorage(fakeBackend());
    expect(storage.loadProgress()).toEqual({ completed: {} });
    expect(storage.loadSession()).toBeNull();
    expect(storage.loadLang()).toBeNull();
  });

  it('returns defaults for corrupt JSON, wrong version or wrong shape', () => {
    const storage = createStorage(fakeBackend({
      [STORAGE_KEYS.progress]: '{not json',
      [STORAGE_KEYS.session]: JSON.stringify({ version: 1, data: { workoutId: 'w1d1' } }),
      [STORAGE_KEYS.lang]: JSON.stringify({ version: 99, data: 'en' }),
    }));
    expect(storage.loadProgress()).toEqual({ completed: {} });
    expect(storage.loadSession()).toBeNull();
    expect(storage.loadLang()).toBeNull();
  });

  it('works with no backend at all', () => {
    const storage = createStorage(null);
    expect(() => storage.saveSession(session)).not.toThrow();
    expect(storage.loadSession()).toBeNull();
    expect(storage.loadProgress()).toEqual({ completed: {} });
  });

  it('swallows errors thrown by the backend', () => {
    const storage = createStorage(throwingBackend);
    expect(() => storage.saveProgress({ completed: {} })).not.toThrow();
    expect(() => storage.clearSession()).not.toThrow();
    expect(storage.loadProgress()).toEqual({ completed: {} });
    expect(storage.loadLang()).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/platform/storage.test.js`
Expected: FAIL — cannot resolve `../../src/platform/storage.js`.

- [ ] **Step 3: Implement `src/platform/storage.js`**

```js
import { emptyProgress } from '../core/progress.js';

const VERSION = 1;

export const STORAGE_KEYS = {
  progress: 'runningAssistant.progress',
  session: 'runningAssistant.session',
  lang: 'runningAssistant.lang',
};

function defaultBackend() {
  try {
    // Accessing localStorage itself can throw when site data is blocked.
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const isObject = (value) => typeof value === 'object' && value !== null;

const isProgress = (value) => isObject(value) && isObject(value.completed);

const isSession = (value) =>
  isObject(value) &&
  typeof value.workoutId === 'string' &&
  typeof value.startedAt === 'number' &&
  (value.pausedAt === null || typeof value.pausedAt === 'number') &&
  typeof value.pausedTotalMs === 'number' &&
  typeof value.skippedMs === 'number';

/** @param {Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null} [backend] */
export function createStorage(backend = defaultBackend()) {
  function read(key, isValid, fallback) {
    try {
      const raw = backend?.getItem(key);
      if (raw == null) return fallback;
      const envelope = JSON.parse(raw);
      if (envelope?.version !== VERSION || !isValid(envelope.data)) return fallback;
      return envelope.data;
    } catch {
      return fallback;
    }
  }

  function write(key, data) {
    try {
      backend?.setItem(key, JSON.stringify({ version: VERSION, data }));
    } catch {
      // Storage full or blocked: the app keeps working without persistence.
    }
  }

  function remove(key) {
    try {
      backend?.removeItem(key);
    } catch {
      // See write().
    }
  }

  return {
    loadProgress: () => read(STORAGE_KEYS.progress, isProgress, emptyProgress()),
    saveProgress: (progress) => write(STORAGE_KEYS.progress, progress),
    loadSession: () => read(STORAGE_KEYS.session, isSession, null),
    saveSession: (session) => write(STORAGE_KEYS.session, session),
    clearSession: () => remove(STORAGE_KEYS.session),
    loadLang: () => read(STORAGE_KEYS.lang, (value) => typeof value === 'string', null),
    saveLang: (lang) => write(STORAGE_KEYS.lang, lang),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test` → Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/platform/storage.js tests/platform/storage.test.js
git commit -m "feat: add versioned localStorage adapter" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Audio, speech and wake lock adapters

These wrap browser APIs that vitest cannot meaningfully exercise; they are verified by build here and by hand in Tasks 9–10.

**Files:**
- Create: `src/platform/audio.js`, `src/platform/speech.js`, `src/platform/wakeLock.js`

**Interfaces:**
- Consumes: `upcomingCues` from `src/core/cues.js`
- Produces:
  - `createCuePlayer(): { supported: boolean, start(session, workout, now): boolean, stop(): void }`
    - `start` must be called from a user gesture; returns `false` when Web Audio is unavailable or fails.
    - `start` first stops anything scheduled, then schedules all `upcomingCues` plus a near-silent keep-alive tone.
  - `speak(text: string, locale: string): void` — no-op when hidden or unsupported
  - `createWakeLock(): { acquire(): void, release(): void }`

- [ ] **Step 1: Implement `src/platform/audio.js`**

```js
import { upcomingCues } from '../core/cues.js';

// `at` (offset from the cue) and `dur` are in seconds, matching AudioContext time.
/** @typedef {{ freq: number, at: number, dur: number }} Note */

/** @type {Record<import('../core/cues.js').CueKind, Note[]>} */
const TONES = {
  pip: [{ freq: 880, at: 0, dur: 0.08 }],
  walk: [{ freq: 440, at: 0, dur: 0.5 }],
  jog: [{ freq: 660, at: 0, dur: 0.5 }],
  run: [{ freq: 990, at: 0, dur: 0.15 }, { freq: 990, at: 0.25, dur: 0.15 }],
  finish: [
    { freq: 523, at: 0, dur: 0.2 },
    { freq: 659, at: 0.22, dur: 0.2 },
    { freq: 784, at: 0.44, dur: 0.45 },
  ],
};

const VOLUME = 0.4;
// Quiet enough to be inaudible, loud enough for Chrome to treat the tab as
// "playing audio", which exempts it from intensive background throttling.
const KEEP_ALIVE_VOLUME = 0.001;
const KEEP_ALIVE_FREQ = 40;

export function createCuePlayer() {
  const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  /** @type {AudioContext | null} */
  let ctx = null;
  /** @type {OscillatorNode[]} */
  let nodes = [];

  function oscillator(freq, volume) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain).connect(ctx.destination);
    nodes.push(osc);
    return { osc, gain };
  }

  function note(freq, startAt, dur) {
    const { osc, gain } = oscillator(freq, 0);
    // Short ramps avoid clicks at note start and end.
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(VOLUME, startAt + 0.01);
    gain.gain.setValueAtTime(VOLUME, startAt + dur - 0.02);
    gain.gain.linearRampToValueAtTime(0, startAt + dur);
    osc.start(startAt);
    osc.stop(startAt + dur);
  }

  function stop() {
    for (const osc of nodes) {
      try {
        osc.stop();
      } catch {
        // Already stopped.
      }
      osc.disconnect();
    }
    nodes = [];
  }

  function start(session, workout, now) {
    if (!AudioContextClass) return false;
    try {
      stop();
      ctx ??= new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();
      const base = ctx.currentTime;
      for (const cue of upcomingCues(session, workout, now)) {
        for (const n of TONES[cue.kind]) note(n.freq, base + cue.inMs / 1000 + n.at, n.dur);
      }
      oscillator(KEEP_ALIVE_FREQ, KEEP_ALIVE_VOLUME).osc.start(base);
      return true;
    } catch {
      return false;
    }
  }

  return { supported: Boolean(AudioContextClass), start, stop };
}
```

- [ ] **Step 2: Implement `src/platform/speech.js`**

```js
/**
 * Speaks a cue when the page is visible. In the background, browsers may
 * hold speech back, so the pre-scheduled beeps are the reliable cue there.
 */
export function speak(text, locale) {
  const synth = globalThis.speechSynthesis;
  if (!synth || document.visibilityState !== 'visible') return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  synth.speak(utterance);
}
```

- [ ] **Step 3: Implement `src/platform/wakeLock.js`**

```js
/** Keeps the screen on while wanted; the browser drops the lock when the tab is hidden. */
export function createWakeLock() {
  let wanted = false;
  /** @type {WakeLockSentinel | null} */
  let sentinel = null;

  async function request() {
    if (!wanted || !navigator.wakeLock || document.visibilityState !== 'visible') return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
    } catch {
      sentinel = null;
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') request();
  }

  return {
    acquire() {
      wanted = true;
      document.addEventListener('visibilitychange', onVisibilityChange);
      request();
    },
    release() {
      wanted = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      sentinel?.release().catch(() => {});
      sentinel = null;
    },
  };
}
```

- [ ] **Step 4: Verify build and tests**

Run: `npm test` → Expected: all PASS (no new tests; nothing broken).
Run: `npm run build` → Expected: succeeds (the adapters are not imported yet, so this only proves the rest still builds; they are compiled in Task 8).

- [ ] **Step 5: Commit**

```bash
git add src/platform/audio.js src/platform/speech.js src/platform/wakeLock.js
git commit -m "feat: add Web Audio cue player, speech and wake lock adapters" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Controller, styles, Plan and Workout screens

**Files:**
- Create: `src/ui/controller.svelte.js`, `src/app.css`, `src/ui/PlanScreen.svelte`, `src/ui/WorkoutScreen.svelte`, `src/ui/components/PhaseIcon.svelte`
- Modify: `src/ui/App.svelte` (replace placeholder), `src/main.js`
- `App.svelte` only switches between the screens that exist so far; Task 9 adds the run and finish screens and the resume dialog.

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces (from `src/ui/controller.svelte.js`):
  - `app` — `$state` object: `{ screen: 'plan'|'workout'|'run'|'finished', workoutId: string|null, session: Session|null, pendingResume: Session|null, progress: Progress, lang: 'pt'|'en', now: number, audioAvailable: boolean }`
  - `init()`, `t(key, params?)`, `formatDate(iso)`, `setLang(lang)`
  - `openWorkout(id)`, `goToPlan()`, `unmarkWorkout(id)`
  - `startWorkout()`, `pause()`, `resume()`, `skip()`, `stop()`
  - `acceptResume()`, `discardResume()`

- [ ] **Step 1: Create `src/ui/controller.svelte.js`**

```js
import { findWorkout } from '../core/plan.js';
import {
  startSession, pauseSession, resumeSession, skipPhase, getState, shouldOfferResume,
} from '../core/timer.js';
import { markDone, unmark } from '../core/progress.js';
import { translate, formatDuration, LANGS, DEFAULT_LANG, LOCALES } from '../i18n/index.js';
import { createStorage } from '../platform/storage.js';
import { createCuePlayer } from '../platform/audio.js';
import { speak } from '../platform/speech.js';
import { createWakeLock } from '../platform/wakeLock.js';

/** @typedef {import('../core/timer.js').Session} Session */

// UI refresh rate while visible. Correctness never depends on it: state is
// derived from timestamps and cues are pre-scheduled on the audio clock.
const TICK_MS = 250;
// Lets the scheduled finish melody play before audio is torn down.
const FINISH_AUDIO_GRACE_MS = 2000;

const storage = createStorage();
const cuePlayer = createCuePlayer();
const wakeLock = createWakeLock();

export const app = $state({
  /** @type {'plan' | 'workout' | 'run' | 'finished'} */
  screen: 'plan',
  /** @type {string | null} */
  workoutId: null,
  /** @type {Session | null} */
  session: null,
  /** @type {Session | null} */
  pendingResume: null,
  progress: storage.loadProgress(),
  lang: DEFAULT_LANG,
  now: Date.now(),
  audioAvailable: true,
});

let ticker = null;
let finishTimer = null;
let lastPhaseIndex = -1;

export function init() {
  const savedLang = storage.loadLang();
  applyLang(LANGS.includes(savedLang) ? savedLang : DEFAULT_LANG);

  const saved = storage.loadSession();
  if (!saved) return;
  if (shouldOfferResume(saved, Date.now())) app.pendingResume = saved;
  else storage.clearSession();
}

export function t(key, params) {
  return translate(app.lang, key, params);
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(LOCALES[app.lang]);
}

export function setLang(lang) {
  applyLang(lang);
  storage.saveLang(lang);
}

export function openWorkout(id) {
  app.workoutId = id;
  app.screen = 'workout';
}

export function goToPlan() {
  app.workoutId = null;
  app.screen = 'plan';
}

export function unmarkWorkout(id) {
  saveProgress(unmark(app.progress, id));
}

export function startWorkout() {
  beginRun(startSession(app.workoutId, Date.now()));
}

export function acceptResume() {
  const session = app.pendingResume;
  app.pendingResume = null;
  beginRun(session);
}

export function discardResume() {
  app.pendingResume = null;
  storage.clearSession();
}

export function pause() {
  cuePlayer.stop();
  setSession(pauseSession(app.session, Date.now()));
}

export function resume() {
  setSession(resumeSession(app.session, Date.now()));
  playCues();
}

export function skip() {
  cuePlayer.stop();
  setSession(skipPhase(app.session, currentWorkout(), Date.now()));
  if (app.session.pausedAt === null) playCues();
  tick();
}

export function stop() {
  cuePlayer.stop();
  endRun();
  app.screen = 'workout';
}

function applyLang(lang) {
  app.lang = lang;
  document.documentElement.lang = LOCALES[lang];
}

function currentWorkout() {
  return findWorkout(app.session.workoutId);
}

function setSession(session) {
  app.session = session;
  storage.saveSession($state.snapshot(session));
}

function saveProgress(progress) {
  app.progress = progress;
  storage.saveProgress($state.snapshot(progress));
}

function beginRun(session) {
  clearTimeout(finishTimer);
  app.workoutId = session.workoutId;
  app.screen = 'run';
  lastPhaseIndex = -1;
  setSession(session);
  if (session.pausedAt === null) playCues();
  wakeLock.acquire();
  startTicking();
}

function playCues() {
  app.audioAvailable = cuePlayer.start($state.snapshot(app.session), currentWorkout(), Date.now());
}

function startTicking() {
  stopTicking();
  ticker = setInterval(tick, TICK_MS);
  document.addEventListener('visibilitychange', tick);
  tick();
}

function stopTicking() {
  clearInterval(ticker);
  ticker = null;
  document.removeEventListener('visibilitychange', tick);
}

function tick() {
  if (!app.session) return;
  const workout = currentWorkout();
  app.now = Date.now();
  const state = getState(app.session, workout, app.now);
  if (state.finished) {
    finish(workout);
    return;
  }
  if (state.phaseIndex !== lastPhaseIndex) {
    lastPhaseIndex = state.phaseIndex;
    announcePhase(workout.phases[state.phaseIndex]);
  }
}

function announcePhase(phase) {
  const text = t('cue.phase', {
    phase: t(`phase.${phase.type}`),
    duration: formatDuration(phase.seconds, app.lang),
  });
  speak(text, LOCALES[app.lang]);
}

function finish(workout) {
  saveProgress(markDone(app.progress, workout.id, new Date().toISOString()));
  endRun();
  app.screen = 'finished';
  speak(t('cue.finish'), LOCALES[app.lang]);
  finishTimer = setTimeout(() => cuePlayer.stop(), FINISH_AUDIO_GRACE_MS);
}

function endRun() {
  stopTicking();
  wakeLock.release();
  storage.clearSession();
  app.session = null;
}
```

- [ ] **Step 2: Create `src/app.css`**

```css
:root {
  --bg: #15161b;
  --surface: #23242b;
  --text: #ffffff;
  --muted: #a3a6ad;
  --accent: #7fd6a4;
  --primary: #16c07c;
  --separator: #34353c;
  --danger: #ff6b6b;
  --walk: #2b5f9e;
  --jog: #b7791f;
  --run: #c0392b;
  --heading-font: 'Oswald', system-ui, sans-serif;
  --body-font: 'Inter', system-ui, sans-serif;
  color-scheme: dark;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--body-font);
  -webkit-tap-highlight-color: transparent;
}

.app {
  max-width: 560px;
  margin: 0 auto;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
}

h1, h2 {
  font-family: var(--heading-font);
  font-weight: 600;
  color: var(--accent);
  margin: 0;
}

button { font: inherit; cursor: pointer; border: none; }

.primary {
  background: var(--primary);
  color: var(--text);
  font-weight: 600;
  font-size: 1.1rem;
  padding: 18px;
  border-radius: 12px;
  width: 100%;
}

.secondary {
  background: var(--surface);
  color: var(--text);
  font-size: 1rem;
  padding: 14px;
  border-radius: 12px;
  width: 100%;
}

.link { background: none; color: var(--accent); text-decoration: underline; padding: 0; }
.danger { color: var(--danger); }

/* Plan */
.plan-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; }
.plan-header h1 { font-size: 1.6rem; }
.lang { background: var(--surface); color: var(--text); padding: 8px 12px; border-radius: 8px; font-weight: 600; }
.all-done { text-align: center; color: var(--accent); font-size: 1.1rem; }
.week { margin-top: 24px; }
.week h2 { font-size: 1.2rem; margin-bottom: 10px; }
.days { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.day {
  position: relative;
  background: var(--surface);
  color: var(--text);
  border: 2px solid transparent;
  border-radius: 12px;
  padding: 14px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.day.next { border-color: var(--primary); }
.day.done { opacity: 0.7; }
.day-label { font-weight: 600; }
.day-total { color: var(--muted); font-size: 0.9rem; }
.check { position: absolute; top: 6px; right: 8px; color: var(--primary); font-weight: 700; }

/* Workout */
.back {
  align-self: flex-start;
  background: #3a3b42;
  color: var(--text);
  width: 36px;
  height: 36px;
  border-radius: 8px;
  font-size: 1.4rem;
  line-height: 1;
}
.title { text-align: center; font-size: 2rem; margin-top: 24px; }
.subtitle { text-align: center; font-size: 1.6rem; margin-top: 12px; }
.total { text-align: center; font-weight: 600; margin: 16px 0 24px; }
.phases { list-style: none; padding: 0 8px; margin: 0 0 24px; }
.phases li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 0;
  border-bottom: 1px solid var(--separator);
  font-size: 1.5rem;
}
.phases li:last-child { border-bottom: none; }
.phase-name { flex: 1; text-transform: uppercase; }
.phase-time { font-variant-numeric: tabular-nums; }
.done-note { text-align: center; color: var(--muted); margin: 0 0 16px; }
.bottom { margin-top: auto; }

.phase-icon { width: 1.5em; text-align: center; }
.phase-icon.big { font-size: 3rem; width: auto; }

/* Run */
.run {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  padding: 24px 16px calc(24px + env(safe-area-inset-bottom));
  transition: background-color 0.4s;
}
.run.walk { background: var(--walk); }
.run.jog { background: var(--jog); }
.run.run { background: var(--run); }
.run-label { margin: 0; opacity: 0.85; }
.current { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px; }
.run-phase { color: var(--text); font-size: 3rem; text-transform: uppercase; }
.countdown {
  font-family: var(--heading-font);
  font-size: clamp(5rem, 28vw, 9rem);
  line-height: 1;
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.countdown.paused { opacity: 0.5; }
.paused-label { margin: 0; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
.next, .remaining { margin: 0; font-size: 1.1rem; }
.bar { width: 100%; height: 8px; background: rgb(0 0 0 / 0.3); border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; background: var(--text); }
.notice { margin: 0; padding: 8px 12px; border-radius: 8px; background: rgb(0 0 0 / 0.35); }
.controls { width: 100%; display: grid; gap: 10px; }
.run .primary { background: var(--text); color: var(--bg); }
.run .secondary { background: rgb(0 0 0 / 0.3); }

/* Finished */
.finished { justify-content: center; align-items: center; text-align: center; gap: 16px; }
.trophy { font-size: 4rem; }

/* Resume dialog */
.overlay {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.dialog {
  width: 100%;
  max-width: 400px;
  background: var(--surface);
  border-radius: 16px;
  padding: 24px;
  display: grid;
  gap: 12px;
}
.dialog p { margin: 0 0 8px; }
```

- [ ] **Step 3: Create `src/ui/components/PhaseIcon.svelte`**

```svelte
<script>
  /** @type {{ type: 'walk' | 'jog' | 'run', big?: boolean }} */
  let { type, big = false } = $props();
  const ICONS = { walk: '🚶', jog: '🏃', run: '🔥' };
</script>

<span class="phase-icon" class:big aria-hidden="true">{ICONS[type]}</span>
```

- [ ] **Step 4: Create `src/ui/PlanScreen.svelte`**

```svelte
<script>
  import { PLAN, groupByWeek, totalSeconds } from '../core/plan.js';
  import { isDone, nextWorkout } from '../core/progress.js';
  import { app, t, openWorkout, setLang } from './controller.svelte.js';

  const weeks = groupByWeek(PLAN);
  const next = $derived(nextWorkout(PLAN, app.progress));
  const otherLang = $derived(app.lang === 'pt' ? 'en' : 'pt');
</script>

<div class="screen">
  <header class="plan-header">
    <h1>{t('app.title')}</h1>
    <button class="lang" onclick={() => setLang(otherLang)}>{t('lang.switch')}</button>
  </header>

  {#if next}
    <button class="primary" onclick={() => openWorkout(next.id)}>
      {t('plan.continue', { week: next.week, day: next.day })}
    </button>
  {:else}
    <p class="all-done">{t('plan.allDone')}</p>
  {/if}

  {#each weeks as { week, workouts } (week)}
    <section class="week">
      <h2>{t('plan.week', { week })}</h2>
      <div class="days">
        {#each workouts as workout (workout.id)}
          {@const done = isDone(app.progress, workout.id)}
          <button
            class="day"
            class:done
            class:next={next?.id === workout.id}
            onclick={() => openWorkout(workout.id)}
          >
            <span class="day-label">{t('plan.day', { day: workout.day })}</span>
            <span class="day-total">{t('workout.total', { value: Math.round(totalSeconds(workout) / 60) })}</span>
            {#if done}<span class="check" title={t('plan.done')}>✓</span>{/if}
          </button>
        {/each}
      </div>
    </section>
  {/each}
</div>
```

- [ ] **Step 5: Create `src/ui/WorkoutScreen.svelte`**

```svelte
<script>
  import { findWorkout, totalSeconds } from '../core/plan.js';
  import { formatClock } from '../core/timer.js';
  import { app, t, formatDate, goToPlan, startWorkout, unmarkWorkout } from './controller.svelte.js';
  import PhaseIcon from './components/PhaseIcon.svelte';

  const workout = $derived(findWorkout(app.workoutId));
  const completedAt = $derived(app.progress.completed[app.workoutId]);
</script>

<div class="screen">
  <button class="back" onclick={goToPlan} aria-label={t('workout.back')}>‹</button>
  <h1 class="title">{t('workout.title', { week: workout.week, day: workout.day })}</h1>
  <h2 class="subtitle">{t('app.title')}</h2>
  <p class="total">⏳ {t('workout.total', { value: Math.round(totalSeconds(workout) / 60) })}</p>

  <ul class="phases">
    {#each workout.phases as phase, i (i)}
      <li>
        <PhaseIcon type={phase.type} />
        <span class="phase-name">{t(`phase.${phase.type}`)}</span>
        <span class="phase-time">⏱ {formatClock(phase.seconds * 1000)}</span>
      </li>
    {/each}
  </ul>

  {#if completedAt}
    <p class="done-note">
      {t('workout.done', { date: formatDate(completedAt) })}
      <button class="link" onclick={() => unmarkWorkout(workout.id)}>{t('workout.unmark')}</button>
    </p>
  {/if}

  <button class="primary bottom" onclick={startWorkout}>{t('workout.start')}</button>
</div>
```

- [ ] **Step 6: Replace `src/ui/App.svelte` and update `src/main.js`**

`src/ui/App.svelte`:
```svelte
<script>
  import { app } from './controller.svelte.js';
  import PlanScreen from './PlanScreen.svelte';
  import WorkoutScreen from './WorkoutScreen.svelte';
</script>

<main class="app">
  {#if app.screen === 'workout'}
    <WorkoutScreen />
  {:else}
    <PlanScreen />
  {/if}
</main>
```

`src/main.js`:
```js
import { mount } from 'svelte';
import './app.css';
import App from './ui/App.svelte';
import { init } from './ui/controller.svelte.js';

init();
mount(App, { target: document.getElementById('app') });
```

- [ ] **Step 7: Verify**

Run: `npm test` → Expected: all PASS.
Run: `npm run build` → Expected: succeeds with no Svelte warnings about unknown runes or a11y errors.
Run: `npm run dev`, open the printed URL at a phone-sized viewport (375×812) and check:
- Plan shows "Correndo para a perda de peso", the "Continuar: Semana 1 - Dia 1" button, 5 weeks × 3 day cards with totals (21, 23, 23 min for week 1).
- Tapping a day opens the workout screen that matches its screenshot in `image-sources/` (phases, durations, total).
- The back button returns to the plan; "EN" switches all text to English and survives a reload.
- No horizontal scrolling at 375 px width.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat: add app controller, plan and workout screens" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Run screen, finish screen and resume flow

**Files:**
- Create: `src/ui/RunScreen.svelte`, `src/ui/FinishedScreen.svelte`, `src/ui/components/ResumeDialog.svelte`
- Modify: `src/ui/App.svelte`, `src/ui/PlanScreen.svelte`

**Interfaces:**
- Consumes: `app`, `t`, `pause`, `resume`, `skip`, `stop`, `goToPlan`, `acceptResume`, `discardResume` from `src/ui/controller.svelte.js`; `getState`, `formatClock` from `src/core/timer.js`; `findWorkout` from `src/core/plan.js`.
- Note: `endRun()` sets `app.session = null` just before the screen changes, so `RunScreen` must guard every use of the session (`{#if state}`).

- [ ] **Step 1: Create `src/ui/RunScreen.svelte`**

```svelte
<script>
  import { findWorkout } from '../core/plan.js';
  import { getState, formatClock } from '../core/timer.js';
  import { app, t, pause, resume, skip, stop } from './controller.svelte.js';
  import PhaseIcon from './components/PhaseIcon.svelte';

  const workout = $derived(app.session ? findWorkout(app.session.workoutId) : null);
  const state = $derived(workout ? getState(app.session, workout, app.now) : null);
  const phase = $derived(state ? workout.phases[state.phaseIndex] : null);
  const nextPhase = $derived(state ? workout.phases[state.phaseIndex + 1] : null);
  const percent = $derived(state ? (state.elapsedMs / (state.elapsedMs + state.totalRemainingMs)) * 100 : 0);

  function confirmStop() {
    if (confirm(t('run.stopConfirm'))) stop();
  }
</script>

{#if state}
  <div class="run {phase.type}">
    <p class="run-label">{t('workout.title', { week: workout.week, day: workout.day })}</p>

    <div class="current">
      <PhaseIcon type={phase.type} big />
      <h1 class="run-phase">{t(`phase.${phase.type}`)}</h1>
      <p class="countdown" class:paused={state.paused}>{formatClock(state.phaseRemainingMs)}</p>
      {#if state.paused}<p class="paused-label">{t('run.paused')}</p>{/if}
    </div>

    <p class="next">
      {nextPhase
        ? t('run.next', { phase: t(`phase.${nextPhase.type}`), time: formatClock(nextPhase.seconds * 1000) })
        : t('run.last')}
    </p>
    <div class="bar"><div class="bar-fill" style:width="{percent}%"></div></div>
    <p class="remaining">{t('run.remaining', { time: formatClock(state.totalRemainingMs) })}</p>

    {#if !app.audioAvailable}<p class="notice">{t('run.noAudio')}</p>{/if}

    <div class="controls">
      {#if state.paused}
        <button class="primary" onclick={resume}>{t('run.resume')}</button>
      {:else}
        <button class="primary" onclick={pause}>{t('run.pause')}</button>
      {/if}
      <button class="secondary" onclick={skip}>{t('run.skip')}</button>
      <button class="secondary danger" onclick={confirmStop}>{t('run.stop')}</button>
    </div>
  </div>
{/if}
```

- [ ] **Step 2: Create `src/ui/FinishedScreen.svelte`**

```svelte
<script>
  import { findWorkout } from '../core/plan.js';
  import { app, t, goToPlan } from './controller.svelte.js';

  const workout = $derived(findWorkout(app.workoutId));
</script>

<div class="screen finished">
  <div class="trophy" aria-hidden="true">🏁</div>
  <h1>{t('finished.title')}</h1>
  {#if workout}<p>{t('workout.title', { week: workout.week, day: workout.day })}</p>{/if}
  <button class="primary" onclick={goToPlan}>{t('finished.back')}</button>
</div>
```

- [ ] **Step 3: Create `src/ui/components/ResumeDialog.svelte`**

```svelte
<script>
  import { findWorkout } from '../../core/plan.js';
  import { app, t, acceptResume, discardResume } from '../controller.svelte.js';

  const workout = $derived(findWorkout(app.pendingResume.workoutId));
</script>

<div class="overlay">
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="resume-title">
    <h2 id="resume-title">{t('resume.title')}</h2>
    <p>{t('resume.text', { week: workout.week, day: workout.day })}</p>
    <button class="primary" onclick={acceptResume}>{t('resume.resume')}</button>
    <button class="secondary" onclick={discardResume}>{t('resume.discard')}</button>
  </div>
</div>
```

- [ ] **Step 4: Wire the screens into `src/ui/App.svelte`**

```svelte
<script>
  import { app } from './controller.svelte.js';
  import PlanScreen from './PlanScreen.svelte';
  import WorkoutScreen from './WorkoutScreen.svelte';
  import RunScreen from './RunScreen.svelte';
  import FinishedScreen from './FinishedScreen.svelte';
</script>

<main class="app">
  {#if app.screen === 'workout'}
    <WorkoutScreen />
  {:else if app.screen === 'run'}
    <RunScreen />
  {:else if app.screen === 'finished'}
    <FinishedScreen />
  {:else}
    <PlanScreen />
  {/if}
</main>
```

- [ ] **Step 5: Show the resume dialog on the plan screen**

In `src/ui/PlanScreen.svelte`, add to the imports:
```js
  import ResumeDialog from './components/ResumeDialog.svelte';
```
and add as the last child inside `<div class="screen">`:
```svelte
  {#if app.pendingResume}<ResumeDialog />{/if}
```

- [ ] **Step 6: Verify**

Run: `npm test` → Expected: all PASS.
Run: `npm run build` → Expected: succeeds, no warnings.
Run `npm run dev` and check in the browser (desktop Chrome is fine here):
- "Vamos!" on Semana 1 - Dia 1 → blue WALK screen, countdown 06:00 counting down, a low beep plays and "Caminhar por 6 minutos" is spoken.
- Pause freezes the countdown and shows "Pausado"; Resume continues from the same time.
- "Pular fase" jumps to TROTAR 02:00 (amber) with the jog tone; skipping while paused stays paused on the next phase.
- Skip until the last phase and skip again → "Treino concluído!" screen; back to plan shows ✓ on Dia 1 and "Continuar" now points to Dia 2.
- Start a workout, reload the page → resume dialog appears; "Retomar" continues at the right time; "Descartar" removes it and it does not reappear after another reload.
- "Parar" asks for confirmation and returns to the workout screen without marking it done.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: add run, finish and resume screens" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: PWA manifest and icon

**Files:**
- Create: `public/manifest.webmanifest`, `public/icon.svg`
- Modify: `index.html`

- [ ] **Step 1: Create `public/manifest.webmanifest`**

```json
{
  "name": "Running Assistant",
  "short_name": "Running",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#15161b",
  "theme_color": "#15161b",
  "icons": [
    { "src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }
  ]
}
```

- [ ] **Step 2: Create `public/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#15161b"/>
  <circle cx="300" cy="120" r="44" fill="#16c07c"/>
  <path d="M190 250 L270 190 L330 250 L390 270 M270 190 L240 300 L300 360 L290 440 M240 300 L180 380 L110 380"
        fill="none" stroke="#16c07c" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- [ ] **Step 3: Link them from `index.html`**

Add inside `<head>`, after the `theme-color` meta:
```html
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="icon" href="./icon.svg" type="image/svg+xml" />
```

- [ ] **Step 4: Verify**

Run: `npm test` → Expected: all PASS.
Run: `npm run build` → Expected: succeeds; `dist/manifest.webmanifest` and `dist/icon.svg` exist.
Run: `npm run preview`, open the URL, and check DevTools → Application → Manifest shows "Running Assistant" with the icon and no errors.

- [ ] **Step 5: Commit**

```bash
git add public index.html
git commit -m "feat: add web app manifest and icon" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Repository docs for humans and agents

**Files:**
- Create: `README.md`, `AGENTS.md`, `CLAUDE.md`

`AGENTS.md` is the single source of agent instructions (read natively by Codex, Cursor and others). `CLAUDE.md` only imports it, so Claude Code gets the same rules without duplication.

- [ ] **Step 1: Create `README.md`**

````markdown
# Running Assistant

A mobile-friendly interval timer and progress tracker for a 5-week walk/jog/run
program ("Correndo para a perda de peso"). Frontend only: no backend, no login;
progress is stored in the browser's localStorage. UI in Portuguese (default)
and English.

## Requirements

Node 24+ and npm.

## Commands

```bash
npm install
npm run dev              # local dev server
npm run dev -- --host    # also reachable from a phone on the same Wi-Fi
npm test                 # unit tests (vitest)
npm run build            # static site in dist/
npm run preview          # serve the built site
```

`dist/` can be hosted on any static host (GitHub Pages, Netlify). The build
uses relative paths, so it works from a sub-path.

## Project layout

- `src/core/` — plan data, timer, cue schedule, progress. Pure JavaScript, no browser APIs.
- `src/platform/` — browser adapters: Web Audio, speech, wake lock, localStorage.
- `src/i18n/` — text resources (`pt.js` default, `en.js`).
- `src/ui/` — Svelte 5 screens; `controller.svelte.js` holds app state and actions.
- `image-sources/` — screenshots the workout plan was transcribed from.
- `docs/superpowers/` — design spec and implementation plan.

## How the timer stays accurate in the background

Timer state is derived from timestamps, never from counting ticks, so a
throttled or reloaded page always shows the correct phase. All beeps for a
workout are scheduled on the Web Audio clock when it starts, so they fire on
time while Chrome is in the background; a near-silent tone keeps the tab
"audible" so Chrome does not throttle it heavily. Spoken cues only play while
the page is visible.

## Manual phone test (Android, Chrome)

1. Run `npm run dev -- --host` and open the Network URL on the phone
   (Wake Lock needs HTTPS, so it is inactive over a LAN IP; that is expected).
2. Open Semana 1 - Dia 1 and tap "Vamos!". Confirm the beep and spoken cue.
3. Tap "Pular fase" until a phase is running, wait until ~20 s remain, then switch to another app.
4. Confirm the countdown pips and the next phase tone arrive on time.
5. Return to the browser: the countdown shows the correct phase and time.
6. Pause, wait, resume: time continues from where it paused.
7. Reload mid-workout: the resume dialog appears and resumes correctly.
````

- [ ] **Step 2: Create `AGENTS.md`**

````markdown
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
````

- [ ] **Step 3: Create `CLAUDE.md`**

```markdown
@AGENTS.md
```

- [ ] **Step 4: Verify**

Check every command in `README.md` and `AGENTS.md` runs: `npm install`, `npm test`, `npm run build` → all succeed.
Check every path mentioned in both files exists: `src/core/`, `src/platform/`, `src/i18n/pt.js`, `src/i18n/en.js`, `src/ui/controller.svelte.js`, `tests/core/plan.test.js`, `image-sources/`, `docs/superpowers/`.

- [ ] **Step 5: Commit**

```bash
git add README.md AGENTS.md CLAUDE.md
git commit -m "docs: add README and agent instructions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Hand over the manual phone test**

The background-audio check (README "Manual phone test", steps 1–7) needs the user's Android phone. Report the LAN URL from `npm run dev -- --host` and ask the user to run it; do not claim background audio works until they confirm.
