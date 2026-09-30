# Android App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sideloaded Android build of PulseRun whose voice and beep cues play on time with the screen locked or YouTube in the foreground.

**Architecture:** Capacitor 8 wraps the existing Svelte build. A pure `buildTimeline()` in `src/core/` lists every remaining tone and spoken line; the controller talks to a `CueEngine` (web: today's Web Audio + speechSynthesis; native: sends the whole timeline to a Java plugin). The Java side runs a foreground service with a partial wake lock that plays tones through `AudioTrack` and speech through `TextToSpeech`, ducking other apps with transient audio focus.

**Tech Stack:** Svelte 5, Vite 8, Vitest 5, Capacitor 8.5 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`), Java (Android SDK, AndroidX from the Capacitor template), Android Studio's bundled JDK.

**Spec:** `docs/superpowers/specs/2026-09-29-android-app-design.md`

## Global Constraints

- `src/core/` stays pure JavaScript: no DOM, no Svelte, no browser APIs, no imports from outside `core/`.
- `src/platform/` may import from `core/` only. `src/ui/controller.svelte.js` is the only module wiring `core/` and `platform/`.
- Svelte 5 runes only. No router, no TypeScript, no SvelteKit, no i18n library, no backend.
- Everything in code is English. Portuguese lives only in `src/i18n/pt.js` (and tests asserting it). Every new i18n key goes in `pt.js`, `en.js` and `es.js`.
- Durations are passed in seconds; spoken durations use `formatDuration(seconds, lang)`.
- Timer state is always derived from `Session` timestamps via `getState`. Pause, resume, skip, stop and settings changes stop the cue engine and, if still running, start it again with a fresh timeline. `start()` is called from a user gesture.
- The web build and its GitHub Pages deploy keep today's behavior. `.github/workflows/deploy.yml` is not changed.
- `appId: "io.github.willenjs.pulserun"`, `appName: "PulseRun"`, `webDir: "dist"`. Java package `io.github.willenjs.pulserun`.
- Only `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` are added to `package.json`. No other Capacitor plugins.
- Conventional commit prefixes; every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- Before claiming a task is done: `npm test` and `npm run build` pass.

## Review Focus

- **Pause/resume or stop during the first-run notification permission prompt:** a `start()` still waiting on the prompt must not start the service after a later `stop()`. Pinned in Task 4 (generation guard test).
- **Tapping "test audio" twice quickly:** only the latest test calls `onDone`, so the sheet's "testing" state is not cleared early. Pinned in Task 4.
- **Resume after a reload mid-phase / skip:** the current phase is announced once, with its remaining time rounded like the web version, and a skip announces the new phase. Pinned in Task 1.
- **Switching language during a run:** upcoming lines are spoken in the new language, not the language at start. Implemented in Task 8 (controller) and checked in its manual step; the language-parameterized text is pinned in Task 2.
- **Voice or tones muted:** muted kinds produce no events, and speech still follows each tone at the same instant (tone first). Pinned in Task 1 and Task 4 (volumes resolved per kind).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/timeline.js` (new) | Pure list of remaining tone and speech events for a session. |
| `src/i18n/cueText.js` (new) | Turns a phase or speech event into spoken text for a language. |
| `src/platform/webCueEngine.js` (new) | `CueEngine` for the browser: wraps `audio.js` and `speech.js`, owns the audio-test sequencing. |
| `src/platform/native/payload.js` (new) | Pure conversion of timeline/test data to the plugin's JSON shape. |
| `src/platform/native/nativeCueEngine.js` (new) | `CueEngine` that calls the native plugin (plugin injected). |
| `src/platform/native/coachPlugin.js` (new) | `registerPlugin('Coach')` and `isNativeApp()`. |
| `src/ui/controller.svelte.js` (modify) | Uses a `CueEngine` instead of `cuePlayer`; picks web or native. |
| `capacitor.config.json`, `scripts/android-build.mjs`, `assets/` (new) | Capacitor config, build/install script, icon sources. |
| `android/` (new, generated) | Capacitor Android project. |
| `android/app/src/main/java/io/github/willenjs/pulserun/coach/ToneBank.java` | PCM for each cue kind (same notes as `audio.js`). |
| `.../coach/CuePlayer.java` | Plays tones and speech with audio focus; used by the service and the plugin's test. |
| `.../coach/CoachService.java` | Foreground service: schedules the timeline, holds the wake lock. |
| `.../coach/CoachPlugin.java` | Capacitor bridge: `start`, `stop`, `test`, permissions. |
| `README.md`, `AGENTS.md` (modify) | Android build/install and manual phone test. |

---

### Task 1: Pure cue timeline

**Files:**
- Create: `src/core/timeline.js`
- Test: `tests/core/timeline.test.js`

**Interfaces:**
- Consumes: `getState`, `phaseBoundaries` (`src/core/timer.js`); `upcomingCues`, `filterCues` (`src/core/cues.js`); `coachExtras` (`src/core/coach.js`).
- Produces: `buildTimeline(session, workout, now, settings, { announceCurrent }) → TimelineEvent[]` where
  `TimelineEvent = { kind: 'tone', tone: CueKind, inMs: number } | { kind: 'speech', inMs: number, phaseType: 'walk'|'jog'|'run', seconds: number, extraKeys: string[] } | { kind: 'speech', inMs: number, finish: true }`.

- [ ] **Step 1: Write the failing test**

Create `tests/core/timeline.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { findWorkout } from '../../src/core/plan.js';
import { startSession, pauseSession, skipPhase } from '../../src/core/timer.js';
import { upcomingCues } from '../../src/core/cues.js';
import { coachExtras } from '../../src/core/coach.js';
import { DEFAULT_AUDIO_SETTINGS } from '../../src/core/audioSettings.js';
import { buildTimeline } from '../../src/core/timeline.js';

const w = findWorkout('w1d1'); // 360/120/360/120/300 s; phases start at 0, 360, 480, 840, 960; ends at 1260
const T0 = 1_000_000;
const s = (seconds) => seconds * 1000;
const fresh = () => startSession('w1d1', T0);
const settings = (patch = {}) => ({ ...DEFAULT_AUDIO_SETTINGS, ...patch });
const speech = (events) => events.filter((e) => e.kind === 'speech');
const tones = (events) => events.filter((e) => e.kind === 'tone');
const announce = { announceCurrent: true };

describe('buildTimeline', () => {
  it('has a tone for every upcoming cue', () => {
    const events = buildTimeline(fresh(), w, T0, settings(), announce);
    expect(tones(events)).toEqual(
      upcomingCues(fresh(), w, T0).map((c) => ({ kind: 'tone', tone: c.kind, inMs: c.inMs })),
    );
  });

  it('announces every phase at its start and the finish at the end', () => {
    expect(speech(buildTimeline(fresh(), w, T0, settings(), announce))).toEqual([
      { kind: 'speech', inMs: 0, phaseType: 'walk', seconds: 360, extraKeys: [] },
      { kind: 'speech', inMs: s(360), phaseType: 'jog', seconds: 120, extraKeys: [] },
      { kind: 'speech', inMs: s(480), phaseType: 'walk', seconds: 360, extraKeys: [] },
      { kind: 'speech', inMs: s(840), phaseType: 'jog', seconds: 120, extraKeys: [] },
      { kind: 'speech', inMs: s(960), phaseType: 'run', seconds: 300, extraKeys: [] },
      { kind: 'speech', inMs: s(1260), finish: true },
    ]);
  });

  it('puts a tone before speech at the same moment and keeps time order', () => {
    const events = buildTimeline(fresh(), w, T0, settings(), announce);
    expect(events.slice(0, 2)).toEqual([
      { kind: 'tone', tone: 'walk', inMs: 0 },
      { kind: 'speech', inMs: 0, phaseType: 'walk', seconds: 360, extraKeys: [] },
    ]);
    expect(events.at(-2)).toEqual({ kind: 'tone', tone: 'finish', inMs: s(1260) });
    expect(events.at(-1)).toEqual({ kind: 'speech', inMs: s(1260), finish: true });
    const times = events.map((e) => e.inMs);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('announces the current phase with its remaining time only when asked', () => {
    const now = T0 + s(100);
    expect(speech(buildTimeline(fresh(), w, now, settings(), { announceCurrent: true }))[0])
      .toEqual({ kind: 'speech', inMs: 0, phaseType: 'walk', seconds: 260, extraKeys: [] });
    expect(speech(buildTimeline(fresh(), w, now, settings(), { announceCurrent: false }))[0])
      .toEqual({ kind: 'speech', inMs: s(260), phaseType: 'jog', seconds: 120, extraKeys: [] });
  });

  it('rounds the remaining seconds of the current phase', () => {
    // 259.6 s left in the first walk.
    expect(speech(buildTimeline(fresh(), w, T0 + 100_400, settings(), announce))[0].seconds).toBe(260);
  });

  it('announces the new phase after a skip', () => {
    const skipped = skipPhase(fresh(), w, T0 + s(30));
    expect(buildTimeline(skipped, w, T0 + s(30), settings(), announce).slice(0, 2)).toEqual([
      { kind: 'tone', tone: 'jog', inMs: 0 },
      { kind: 'speech', inMs: 0, phaseType: 'jog', seconds: 120, extraKeys: [] },
    ]);
  });

  it('has no speech when the voice is off', () => {
    const events = buildTimeline(fresh(), w, T0, settings({ voiceVolume: 0 }), announce);
    expect(speech(events)).toEqual([]);
    expect(tones(events)).toHaveLength(21);
  });

  it('drops tones whose volume is off', () => {
    const events = buildTimeline(fresh(), w, T0, settings({ beepVolume: 0, fanfareVolume: 0 }), announce);
    expect(tones(events)).toEqual([]);
    expect(speech(events)).toHaveLength(6);
  });

  it('adds coach lines in intense style', () => {
    const events = buildTimeline(fresh(), w, T0, settings({ voiceStyle: 'intense' }), announce);
    speech(events).slice(0, 5).forEach((event, i) => {
      expect(event.extraKeys).toEqual(coachExtras(w, i, 'intense'));
    });
  });

  it('is empty while paused or once finished', () => {
    const paused = pauseSession(fresh(), T0 + s(10));
    expect(buildTimeline(paused, w, T0 + s(20), settings(), announce)).toEqual([]);
    expect(buildTimeline(fresh(), w, T0 + s(1260), settings(), announce)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/timeline.test.js`
Expected: FAIL, cannot resolve `../../src/core/timeline.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/timeline.js`:

```js
import { getState, phaseBoundaries } from './timer.js';
import { upcomingCues, filterCues } from './cues.js';
import { coachExtras } from './coach.js';

/** @typedef {import('./cues.js').CueKind} CueKind */
/** @typedef {import('./plan.js').PhaseType} PhaseType */
/**
 * @typedef {{ kind: 'tone', tone: CueKind, inMs: number }
 *   | { kind: 'speech', inMs: number, phaseType: PhaseType, seconds: number, extraKeys: string[] }
 *   | { kind: 'speech', inMs: number, finish: true }} TimelineEvent
 * Speech events carry i18n keys and numbers, not text: core cannot translate.
 */

/**
 * Everything the runner will hear from `now` on, as delays from `now`: the
 * cue tones plus a spoken line at each phase start and at the finish. The
 * native app schedules all of it at once, because the page's JavaScript may
 * not run while the phone is locked.
 * @param {import('./timer.js').Session} session
 * @param {import('./plan.js').Workout} workout
 * @param {import('./audioSettings.js').AudioSettings} settings
 * @param {{ announceCurrent?: boolean }} [options] also announce the phase
 *   already under way, with its remaining time (start, resume after reload, skip)
 * @returns {TimelineEvent[]}
 */
export function buildTimeline(session, workout, now, settings, { announceCurrent = false } = {}) {
  const state = getState(session, workout, now);
  if (state.paused || state.finished) return [];
  const elapsed = state.elapsedMs;

  /** @type {TimelineEvent[]} */
  const events = filterCues(upcomingCues(session, workout, now), settings)
    .map((cue) => ({ kind: 'tone', tone: cue.kind, inMs: cue.inMs }));

  if (settings.voiceVolume > 0) {
    const bounds = phaseBoundaries(workout);
    bounds.forEach(({ startMs, endMs }, i) => {
      const isCurrent = startMs <= elapsed && elapsed < endMs;
      if (startMs <= elapsed && !(isCurrent && announceCurrent)) return;
      events.push({
        kind: 'speech',
        inMs: Math.max(0, startMs - elapsed),
        phaseType: workout.phases[i].type,
        seconds: Math.round((endMs - Math.max(startMs, elapsed)) / 1000),
        extraKeys: coachExtras(workout, i, settings.voiceStyle),
      });
    });
    events.push({ kind: 'speech', inMs: bounds.at(-1).endMs - elapsed, finish: true });
  }

  // At the same moment the tone plays first, then the voice.
  const order = (event) => (event.kind === 'tone' ? 0 : 1);
  return events.sort((a, b) => a.inMs - b.inMs || order(a) - order(b));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS, including the 10 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/core/timeline.js tests/core/timeline.test.js
git commit -m "feat: add a pure cue timeline with spoken phase events" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Spoken text for timeline events

**Files:**
- Create: `src/i18n/cueText.js`
- Modify: `src/i18n/pt.js`, `src/i18n/en.js`, `src/i18n/es.js` (two new keys each)
- Modify: `src/ui/controller.svelte.js` (use the shared `phaseLine`)
- Test: `tests/i18n/cueText.test.js`

**Interfaces:**
- Consumes: `translate`, `formatDuration` (`src/i18n/index.js`); `TimelineEvent` from Task 1.
- Produces:
  - `phaseLine(lang, type, seconds, extraKeys) → string`, e.g. `"Walk for 5 minutes"` or `"Walk for 5 minutes. Breathe and recover."`
  - `speechText(event, lang) → string` for a Task 1 speech event.
  - i18n keys `notification.channel` and `notification.running`.

- [ ] **Step 1: Write the failing test**

Create `tests/i18n/cueText.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { phaseLine, speechText } from '../../src/i18n/cueText.js';
import { translate } from '../../src/i18n/index.js';

describe('phaseLine', () => {
  it('says the phase and its duration', () => {
    expect(phaseLine('en', 'walk', 300, [])).toBe('Walk for 5 minutes');
    expect(phaseLine('pt', 'run', 90, [])).toBe('Correr por 1 minuto e 30 segundos');
  });

  it('appends coach lines', () => {
    expect(phaseLine('en', 'walk', 300, ['coach.walk', 'coach.halfway']))
      .toBe('Walk for 5 minutes. Breathe and recover. Halfway there, keep it up!');
  });
});

describe('speechText', () => {
  it('speaks a phase event in the given language', () => {
    const event = { kind: 'speech', inMs: 0, phaseType: 'jog', seconds: 120, extraKeys: [] };
    expect(speechText(event, 'en')).toBe('Jog for 2 minutes');
    expect(speechText(event, 'pt')).toBe('Trotar por 2 minutos');
  });

  it('speaks the finish line', () => {
    const event = { kind: 'speech', inMs: 0, finish: true };
    expect(speechText(event, 'en')).toBe('Workout complete!');
    expect(speechText(event, 'pt')).toBe('Treino concluído!');
  });
});

describe('notification text', () => {
  it('exists in every language', () => {
    expect(translate('pt', 'notification.running')).toBe('Treino em andamento');
    expect(translate('en', 'notification.running')).toBe('Workout in progress');
    expect(translate('en', 'notification.channel')).toBe('Workout');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/i18n/cueText.test.js`
Expected: FAIL, cannot resolve `../../src/i18n/cueText.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/i18n/cueText.js`:

```js
import { translate, formatDuration } from './index.js';

/**
 * "Walk for 5 minutes", followed by any coach lines (i18n keys).
 * @param {string} lang
 * @param {import('../core/plan.js').PhaseType} type
 * @param {number} seconds
 * @param {string[]} extraKeys
 */
export function phaseLine(lang, type, seconds, extraKeys) {
  const command = translate(lang, 'cue.phase', {
    phase: translate(lang, `phase.${type}`),
    duration: formatDuration(seconds, lang),
  });
  const extras = extraKeys.map((key) => translate(lang, key));
  return extras.length ? `${command}. ${extras.join(' ')}` : command;
}

/**
 * Text for a speech event from `buildTimeline`.
 * @param {Extract<import('../core/timeline.js').TimelineEvent, { kind: 'speech' }>} event
 * @param {string} lang
 */
export function speechText(event, lang) {
  if ('finish' in event) return translate(lang, 'cue.finish');
  return phaseLine(lang, event.phaseType, event.seconds, event.extraKeys);
}
```

Add after the `'cue.finish'` line in each dictionary:

`src/i18n/pt.js`:
```js
  'notification.channel': 'Treino',
  'notification.running': 'Treino em andamento',
```

`src/i18n/en.js`:
```js
  'notification.channel': 'Workout',
  'notification.running': 'Workout in progress',
```

`src/i18n/es.js`:
```js
  'notification.channel': 'Entrenamiento',
  'notification.running': 'Entrenamiento en curso',
```

In `src/ui/controller.svelte.js`:
- Add the import: `import { phaseLine } from '../i18n/cueText.js';`
- Delete the local `phaseLine(type, seconds, extraKeys)` function (the one documented as `"Walk for 5 minutes", followed by any coach lines`).
- In `announcePhase`, change the call to `say(phaseLine(app.lang, phase.type, Math.round(remainingMs / 1000), extras));`
- In `testAudio`, change the call to `phaseLine(app.lang, 'run', TEST_PHASE_SECONDS, voiceExtras)`.
- Remove `formatDuration` from the `../i18n/index.js` import if nothing else in the controller uses it (check with a search first).

- [ ] **Step 4: Run tests and build**

Run: `npm test` then `npm run build`
Expected: all tests PASS (the key-parity test in `tests/i18n/i18n.test.js` included); build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/i18n tests/i18n/cueText.test.js src/ui/controller.svelte.js
git commit -m "feat: share spoken cue text and add notification strings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Web cue engine seam

Refactor only: the web app must behave exactly as before.

**Files:**
- Create: `src/platform/webCueEngine.js`
- Modify: `src/ui/controller.svelte.js`

**Interfaces:**
- Consumes: `createCuePlayer` (`src/platform/audio.js`), `speak` (`src/platform/speech.js`), `testSequence` (`src/core/audioSettings.js`).
- Produces: `createWebCueEngine({ locales: () => string[] }) → CueEngine` where
  `CueEngine = { speaksInBackground: boolean, start(session, workout, now, settings, { announceCurrent }): boolean, stop(): void, test(settings, sampleText: string | null, onDone: () => void): void }`.

- [ ] **Step 1: Create the web engine**

Create `src/platform/webCueEngine.js`:

```js
import { createCuePlayer } from './audio.js';
import { speak } from './speech.js';
import { testSequence } from '../core/audioSettings.js';

/**
 * @typedef {{
 *   speaksInBackground: boolean,
 *   start(session: import('../core/timer.js').Session, workout: import('../core/plan.js').Workout,
 *     now: number, settings: import('../core/audioSettings.js').AudioSettings,
 *     options: { announceCurrent: boolean }): boolean,
 *   stop(): void,
 *   test(settings: import('../core/audioSettings.js').AudioSettings, sampleText: string | null,
 *     onDone: () => void): void,
 * }} CueEngine
 * Plays a workout's cues. `speaksInBackground` engines speak the phase
 * lines themselves; otherwise the controller speaks them while visible.
 */

/**
 * Browser cues: tones pre-scheduled on the Web Audio clock; the controller
 * speaks phase lines from its tick while the page is visible.
 * @param {{ locales: () => string[] }} options voice locales, best first
 * @returns {CueEngine}
 */
export function createWebCueEngine({ locales }) {
  const player = createCuePlayer();
  let testTimer = null;
  // Bumped on each test so callbacks from an earlier test are ignored.
  let testRun = 0;

  return {
    speaksInBackground: false,
    // announceCurrent is ignored: the controller's tick announces phases here.
    start(session, workout, now, settings) {
      return player.start(session, workout, now, settings);
    },
    stop() {
      player.stop();
    },
    test(settings, sampleText, onDone) {
      const run = ++testRun;
      clearTimeout(testTimer);
      const { tones } = testSequence(settings);
      const playTones = () => {
        if (run !== testRun) return;
        const ms = player.test(tones, settings);
        testTimer = setTimeout(() => { if (run === testRun) onDone(); }, ms);
      };
      // Unlock audio within the tap, even when the voice goes first.
      player.test([], settings);
      const spoke = sampleText !== null
        && speak(sampleText, locales(), { volume: settings.voiceVolume, onEnd: playTones });
      if (!spoke) playTones();
    },
  };
}
```

- [ ] **Step 2: Switch the controller to the engine**

In `src/ui/controller.svelte.js`:

1. Replace `import { createCuePlayer } from '../platform/audio.js';` with `import { createWebCueEngine } from '../platform/webCueEngine.js';`.
2. Delete `const cuePlayer = createCuePlayer();`.
3. Right after the `export const app = $state({ ... });` block, add:
   ```js
   /** @type {import('../platform/webCueEngine.js').CueEngine} */
   let engine = createWebCueEngine({ locales: () => VOICE_LOCALES[app.lang] });
   ```
4. Delete the module variables `testTimer` and `testRun` (and the comment above `testRun`).
5. Replace every `cuePlayer.stop()` with `engine.stop()` (in `pause`, `skip`, `stop`, `setAudio`, and the `finishTimer` callback in `finish`).
6. Replace `playCues` with:
   ```js
   function playCues(announceCurrent = false) {
     app.audioAvailable = engine.start(
       $state.snapshot(app.session), currentWorkout(), Date.now(), $state.snapshot(app.settings),
       { announceCurrent },
     );
   }
   ```
7. In `beginRun` change `playCues()` to `playCues(true)`; in `skip` change `playCues()` to `playCues(true)`. Leave `resume`, `setAudio` and `onVisibilityChange` calling `playCues()`.
8. Replace `testAudio` with:
   ```js
   /**
    * Plays each sound that has volume, in the order of the sliders: a sample
    * announcement, then the beeps, then the fanfare. Called from a tap.
    */
   export function testAudio() {
     const settings = $state.snapshot(app.settings);
     const { speak: withVoice, voiceExtras } = testSequence(settings);
     const sample = withVoice ? phaseLine(app.lang, 'run', TEST_PHASE_SECONDS, voiceExtras) : null;
     app.audioTesting = true;
     engine.test(settings, sample, () => { app.audioTesting = false; });
   }
   ```

- [ ] **Step 3: Run tests and build**

Run: `npm test` then `npm run build`
Expected: PASS and build succeeds. Search the controller for `cuePlayer`, `testRun` and `testTimer`: no matches.

- [ ] **Step 4: Check the web app in the preview browser**

Start the dev server with `preview_start` (`.claude/launch.json` already has it). Open Semana 1 - Dia 1, tap "Vamos!", tap skip twice, pause, resume, stop; open the audio sheet and tap the test button. Expected: no console errors (`read_console_messages`), the run screen timer and phase labels update, the test button returns from its "testing" state.

- [ ] **Step 5: Commit**

```bash
git add src/platform/webCueEngine.js src/ui/controller.svelte.js
git commit -m "refactor: play cues through a web cue engine" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Native cue engine (JavaScript side)

**Files:**
- Create: `src/platform/native/payload.js`
- Create: `src/platform/native/nativeCueEngine.js`
- Test: `tests/platform/native/payload.test.js`
- Test: `tests/platform/native/nativeCueEngine.test.js`

**Interfaces:**
- Consumes: `buildTimeline` (Task 1), `cueVolume` (`src/core/cues.js`), `testSequence` (`src/core/audioSettings.js`), `CueEngine` typedef (Task 3).
- Produces:
  - `nativeEvents(timeline, settings, speechText) → NativeEvent[]`, `NativeEvent = { type: 'tone', atMs, tone, volume } | { type: 'speech', atMs, text, volume }`.
  - `nativeTest(settings, sampleText) → { speech: { text, volume } | null, tones: { tone, volume }[] }`.
  - `createNativeCueEngine({ plugin, locales, speechText, notification, onFailure }) → CueEngine` with `speaksInBackground: true`. `plugin` has `start(data)`, `stop()`, `test(data)`, `requestPermissions()`, all returning promises. `notification(workout) → { channel, title, text }`.
  - Plugin payloads: `start({ events: NativeEvent[], locales: string[], notification: { channel, title, text } })`, `test({ speech, tones, locales })`.

- [ ] **Step 1: Write the failing payload test**

Create `tests/platform/native/payload.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS } from '../../../src/core/audioSettings.js';
import { nativeEvents, nativeTest } from '../../../src/platform/native/payload.js';

const settings = { ...DEFAULT_AUDIO_SETTINGS, voiceVolume: 80, beepVolume: 40, fanfareVolume: 70 };

describe('nativeEvents', () => {
  it('resolves text and per-kind volume', () => {
    const timeline = [
      { kind: 'tone', tone: 'walk', inMs: 0 },
      { kind: 'speech', inMs: 0, phaseType: 'walk', seconds: 360, extraKeys: [] },
      { kind: 'tone', tone: 'pip', inMs: 357_000 },
      { kind: 'tone', tone: 'finish', inMs: 1_260_000 },
      { kind: 'speech', inMs: 1_260_000, finish: true },
    ];
    const text = (event) => ('finish' in event ? 'done' : `${event.phaseType} ${event.seconds}`);
    expect(nativeEvents(timeline, settings, text)).toEqual([
      { type: 'tone', atMs: 0, tone: 'walk', volume: 40 },
      { type: 'speech', atMs: 0, text: 'walk 360', volume: 80 },
      { type: 'tone', atMs: 357_000, tone: 'pip', volume: 40 },
      { type: 'tone', atMs: 1_260_000, tone: 'finish', volume: 70 },
      { type: 'speech', atMs: 1_260_000, text: 'done', volume: 80 },
    ]);
  });
});

describe('nativeTest', () => {
  it('plays the sample line, then the countdown and the fanfare', () => {
    expect(nativeTest(settings, 'Run for 5 minutes')).toEqual({
      speech: { text: 'Run for 5 minutes', volume: 80 },
      tones: [
        { tone: 'pip', volume: 40 },
        { tone: 'pip', volume: 40 },
        { tone: 'lastPip', volume: 40 },
        { tone: 'finish', volume: 70 },
      ],
    });
  });

  it('has no speech without a sample line', () => {
    expect(nativeTest({ ...settings, voiceVolume: 0 }, null).speech).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing engine test**

Create `tests/platform/native/nativeCueEngine.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { findWorkout } from '../../../src/core/plan.js';
import { startSession } from '../../../src/core/timer.js';
import { DEFAULT_AUDIO_SETTINGS } from '../../../src/core/audioSettings.js';
import { createNativeCueEngine } from '../../../src/platform/native/nativeCueEngine.js';

const w = findWorkout('w1d1');
const T0 = 1_000_000;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakePlugin() {
  let grant;
  return {
    permission: new Promise((resolve) => { grant = resolve; }),
    grant: () => grant(),
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
    test: vi.fn(() => Promise.resolve()),
    requestPermissions() { return this.permission; },
  };
}

function engineWith(plugin, onFailure = vi.fn()) {
  return createNativeCueEngine({
    plugin,
    locales: () => ['en-US'],
    speechText: (event) => ('finish' in event ? 'done' : event.phaseType),
    notification: (workout) => ({ channel: 'Workout', title: `W${workout.week}D${workout.day}`, text: 'Running' }),
    onFailure,
  });
}

describe('createNativeCueEngine', () => {
  it('speaks in the background', () => {
    expect(engineWith(fakePlugin()).speaksInBackground).toBe(true);
  });

  it('asks for permission once, then sends the timeline', async () => {
    const plugin = fakePlugin();
    const engine = engineWith(plugin);
    expect(engine.start(startSession('w1d1', T0), w, T0, DEFAULT_AUDIO_SETTINGS, { announceCurrent: true })).toBe(true);
    plugin.grant();
    await flush();
    expect(plugin.start).toHaveBeenCalledTimes(1);
    const data = plugin.start.mock.calls[0][0];
    expect(data.locales).toEqual(['en-US']);
    expect(data.notification).toEqual({ channel: 'Workout', title: 'W1D1', text: 'Running' });
    expect(data.events[0]).toEqual({ type: 'tone', atMs: 0, tone: 'walk', volume: DEFAULT_AUDIO_SETTINGS.beepVolume });
    expect(data.events[1]).toEqual({ type: 'speech', atMs: 0, text: 'walk', volume: DEFAULT_AUDIO_SETTINGS.voiceVolume });
  });

  it('does not start after a stop that came while waiting for permission', async () => {
    const plugin = fakePlugin();
    const engine = engineWith(plugin);
    engine.start(startSession('w1d1', T0), w, T0, DEFAULT_AUDIO_SETTINGS, { announceCurrent: true });
    engine.stop();
    plugin.grant();
    await flush();
    expect(plugin.start).not.toHaveBeenCalled();
    expect(plugin.stop).toHaveBeenCalledTimes(1);
  });

  it('reports a failed start', async () => {
    const plugin = fakePlugin();
    const error = new Error('no service');
    plugin.start = vi.fn(() => Promise.reject(error));
    const onFailure = vi.fn();
    engineWith(plugin, onFailure).start(startSession('w1d1', T0), w, T0, DEFAULT_AUDIO_SETTINGS, { announceCurrent: true });
    plugin.grant();
    await flush();
    expect(onFailure).toHaveBeenCalledWith(error);
  });

  it('only finishes the latest audio test', async () => {
    const plugin = fakePlugin();
    const resolvers = [];
    plugin.test = vi.fn(() => new Promise((resolve) => resolvers.push(resolve)));
    const engine = engineWith(plugin);
    const first = vi.fn();
    const second = vi.fn();
    engine.test(DEFAULT_AUDIO_SETTINGS, 'sample', first);
    engine.test(DEFAULT_AUDIO_SETTINGS, 'sample', second);
    resolvers[0]();
    await flush();
    expect(first).not.toHaveBeenCalled();
    resolvers[1]();
    await flush();
    expect(second).toHaveBeenCalledTimes(1);
    expect(plugin.test.mock.calls[0][0]).toEqual(expect.objectContaining({ locales: ['en-US'] }));
  });

  it('finishes a failed audio test too', async () => {
    const plugin = fakePlugin();
    plugin.test = vi.fn(() => Promise.reject(new Error('no audio')));
    const onDone = vi.fn();
    engineWith(plugin).test(DEFAULT_AUDIO_SETTINGS, null, onDone);
    await flush();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/platform/native`
Expected: FAIL, cannot resolve `payload.js` / `nativeCueEngine.js`.

- [ ] **Step 4: Write the implementation**

Create `src/platform/native/payload.js`:

```js
import { cueVolume } from '../../core/cues.js';
import { testSequence } from '../../core/audioSettings.js';

/**
 * @typedef {{ type: 'tone', atMs: number, tone: import('../../core/cues.js').CueKind, volume: number }
 *   | { type: 'speech', atMs: number, text: string, volume: number }} NativeEvent
 * Volumes are 0–100. The native side needs no settings or translations.
 */

/**
 * @param {import('../../core/timeline.js').TimelineEvent[]} timeline
 * @param {import('../../core/audioSettings.js').AudioSettings} settings
 * @param {(event: any) => string} speechText
 * @returns {NativeEvent[]}
 */
export function nativeEvents(timeline, settings, speechText) {
  return timeline.map((event) => (event.kind === 'tone'
    ? { type: 'tone', atMs: event.inMs, tone: event.tone, volume: cueVolume(event.tone, settings) }
    : { type: 'speech', atMs: event.inMs, text: speechText(event), volume: settings.voiceVolume }));
}

/**
 * The audio-sheet test for the native side: the sample line, then the tones.
 * @param {import('../../core/audioSettings.js').AudioSettings} settings
 * @param {string | null} sampleText
 */
export function nativeTest(settings, sampleText) {
  const { tones } = testSequence(settings);
  return {
    speech: sampleText === null ? null : { text: sampleText, volume: settings.voiceVolume },
    tones: tones.map((tone) => ({ tone, volume: cueVolume(tone, settings) })),
  };
}
```

Create `src/platform/native/nativeCueEngine.js`:

```js
import { buildTimeline } from '../../core/timeline.js';
import { nativeEvents, nativeTest } from './payload.js';

/**
 * Cues played by the Android app's Coach plugin, which schedules the whole
 * timeline (tones and speech) in a foreground service, so they keep playing
 * with the screen locked or another app in front.
 * @param {{
 *   plugin: {
 *     start(data: object): Promise<unknown>, stop(): Promise<unknown>,
 *     test(data: object): Promise<unknown>, requestPermissions(): Promise<unknown>,
 *   },
 *   locales: () => string[],
 *   speechText: (event: any) => string,
 *   notification: (workout: import('../../core/plan.js').Workout) => { channel: string, title: string, text: string },
 *   onFailure: (error: unknown) => void,
 * }} options
 * @returns {import('../webCueEngine.js').CueEngine}
 */
export function createNativeCueEngine({ plugin, locales, speechText, notification, onFailure }) {
  /** @type {Promise<unknown> | null} */
  let permission = null;
  // Bumped on every start and stop, so a start still waiting for the
  // permission prompt does not revive cues after a later stop.
  let generation = 0;
  let testRun = 0;

  return {
    speaksInBackground: true,
    start(session, workout, now, settings, { announceCurrent }) {
      const run = ++generation;
      const data = {
        events: nativeEvents(buildTimeline(session, workout, now, settings, { announceCurrent }), settings, speechText),
        locales: locales(),
        notification: notification(workout),
      };
      permission ??= plugin.requestPermissions().catch(() => {});
      permission
        .then(() => (run === generation ? plugin.start(data) : undefined))
        .catch(onFailure);
      return true;
    },
    stop() {
      generation++;
      plugin.stop().catch(() => {});
    },
    test(settings, sampleText, onDone) {
      const run = ++testRun;
      plugin.test({ ...nativeTest(settings, sampleText), locales: locales() })
        .catch(() => {})
        .then(() => { if (run === testRun) onDone(); });
    },
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test` then `npm run build`
Expected: PASS (the new native tests included); build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/platform/native tests/platform/native
git commit -m "feat: add the native cue engine and plugin payloads" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Capacitor Android project and build script

**Files:**
- Modify: `package.json`, `package-lock.json`, `.gitignore`
- Create: `capacitor.config.json`, `scripts/android-build.mjs`
- Create (generated): `android/`
- Create: `assets/icon-only.png`, `assets/icon-foreground.png`, `assets/icon-background.png` and the generated `android/app/src/main/res/mipmap-*` icons

**Interfaces:**
- Produces: `npm run android:sync`, `npm run android:build` (debug APK at `android/app/build/outputs/apk/debug/app-debug.apk`), `npm run android:install` (build, then `adb install -r`). Java sources live under `android/app/src/main/java/io/github/willenjs/pulserun/`.

- [ ] **Step 1: Add Capacitor**

```bash
npm install @capacitor/core@^8.5.2 @capacitor/android@^8.5.2
npm install -D @capacitor/cli@^8.5.2
```

Create `capacitor.config.json`:

```json
{
  "appId": "io.github.willenjs.pulserun",
  "appName": "PulseRun",
  "webDir": "dist"
}
```

- [ ] **Step 2: Generate the Android project**

```bash
npm run build
npx cap add android
```

Expected: `android/` exists with `android/app/src/main/java/io/github/willenjs/pulserun/MainActivity.java`. Run `git status --short android | head -50` and confirm the generated `android/.gitignore` already excludes `build/`, `.gradle/`, `local.properties` and `app/src/main/assets/public`. Add any of those that are missing to `android/.gitignore`.

- [ ] **Step 3: Add the build script and npm scripts**

Create `scripts/android-build.mjs`:

```js
// Builds the debug APK (web build → cap sync → Gradle) and, with --install,
// installs it on the USB-connected phone. Uses Android Studio's bundled JDK
// and the default SDK location when JAVA_HOME / ANDROID_HOME are not set.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const APK = 'android/app/build/outputs/apk/debug/app-debug.apk';
const isWindows = process.platform === 'win32';
const env = { ...process.env };

const studioJdk = {
  win32: 'C:\\Program Files\\Android\\Android Studio\\jbr',
  darwin: '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
}[process.platform];
if (!env.JAVA_HOME && studioJdk && existsSync(studioJdk)) env.JAVA_HOME = studioJdk;

const defaultSdk = isWindows
  ? join(env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
  : join(env.HOME ?? '', process.platform === 'darwin' ? 'Library/Android/sdk' : 'Android/Sdk');
if (!env.ANDROID_HOME && existsSync(defaultSdk)) env.ANDROID_HOME = defaultSdk;

function run(command, args, cwd = '.') {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: isWindows });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('npm', ['run', 'android:sync']);
run(isWindows ? 'gradlew.bat' : './gradlew', ['assembleDebug'], 'android');
console.log(`APK: ${APK}`);

if (process.argv.includes('--install')) {
  const adb = env.ANDROID_HOME ? join(env.ANDROID_HOME, 'platform-tools', isWindows ? 'adb.exe' : 'adb') : 'adb';
  run(adb, ['install', '-r', APK]);
}
```

In `package.json` `scripts`, add:

```json
    "android:sync": "vite build && cap sync android",
    "android:build": "node scripts/android-build.mjs",
    "android:install": "node scripts/android-build.mjs --install"
```

- [ ] **Step 4: Generate the app icon**

The logo (`src/ui/logo.svg`) is wide, so it is centered on a square at about 55% width, inside the adaptive-icon safe zone, on the app background `#0C0D12`.

```bash
mkdir -p assets
npm install --no-save sharp @capacitor/assets
node --input-type=module -e "
import sharp from 'sharp';
const logo = await sharp('src/ui/logo.svg', { density: 600 }).resize({ width: 560 }).png().toBuffer();
const square = (background) => sharp({ create: { width: 1024, height: 1024, channels: 4, background } });
const bg = { r: 12, g: 13, b: 18, alpha: 1 };
await square(bg).composite([{ input: logo, gravity: 'center' }]).png().toFile('assets/icon-only.png');
await square({ r: 0, g: 0, b: 0, alpha: 0 }).composite([{ input: logo, gravity: 'center' }]).png().toFile('assets/icon-foreground.png');
await square(bg).png().toFile('assets/icon-background.png');
"
npx capacitor-assets generate --android
```

Expected: the command reports generated `mipmap-*` icons under `android/app/src/main/res/`. Then run `git status --short package.json` and confirm `sharp` and `@capacitor/assets` were not added to `package.json` (they were installed with `--no-save`).

- [ ] **Step 5: Build the APK**

Run: `npm run android:build`
Expected: Gradle ends with `BUILD SUCCESSFUL` and the script prints `APK: android/app/build/outputs/apk/debug/app-debug.apk`; the file exists. (The first build downloads Gradle and dependencies and may install a missing SDK platform; that can take several minutes.) If Gradle reports a missing SDK platform or build-tools that it cannot install, install that exact version from Android Studio's SDK Manager and rerun.

- [ ] **Step 6: Run tests and web build**

Run: `npm test` then `npm run build`
Expected: PASS and build succeeds (the web build is unaffected by Capacitor).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json capacitor.config.json scripts/android-build.mjs assets android .gitignore
git status --short
git commit -m "chore: add the Capacitor Android project and build script" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Before committing, check `git status --short` lists no `android/app/build`, `android/.gradle`, `android/local.properties` or `android/app/src/main/assets/public` paths.

---

### Task 6: Native tones, speech and audio test

**Files:**
- Create: `android/app/src/main/java/io/github/willenjs/pulserun/coach/ToneBank.java`
- Create: `android/app/src/main/java/io/github/willenjs/pulserun/coach/CuePlayer.java`
- Create: `android/app/src/main/java/io/github/willenjs/pulserun/coach/CoachPlugin.java`
- Modify: `android/app/src/main/java/io/github/willenjs/pulserun/MainActivity.java`
- Modify: `android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Consumes: `test({ speech: { text, volume } | null, tones: { tone, volume }[], locales: string[] })` from Task 4.
- Produces (Java, package `io.github.willenjs.pulserun.coach`):
  - `ToneBank.has(String kind)`, `ToneBank.durationMs(String kind) → long`, `ToneBank.pcm(String kind) → short[]`, `ToneBank.SAMPLE_RATE`.
  - `new CuePlayer(Context, Handler, List<String> locales)`; `playTone(String kind, int volume)`, `speak(String text, int volume, Runnable onDone)`, `setLocales(List<String>)`, `stopAll()`, `shutdown()`; `static List<String> strings(JSONArray)`; `static final boolean USE_AUDIO_FOCUS`.
  - Capacitor plugin `Coach` with `test` and the built-in `requestPermissions` (alias `notifications`). `start`/`stop` come in Task 7.

- [ ] **Step 1: Tone synthesis**

Create `ToneBank.java`:

```java
package io.github.willenjs.pulserun.coach;

import java.util.HashMap;
import java.util.Map;

/** 16-bit mono PCM for each cue kind, with the same notes as src/platform/audio.js. */
final class ToneBank {
    static final int SAMPLE_RATE = 44100;
    // Peak level at 100% volume, like MAX_GAIN in audio.js.
    private static final double MAX_GAIN = 0.95;
    // Short ramps avoid clicks at note start and end.
    private static final double ATTACK_S = 0.01;
    private static final double RELEASE_S = 0.02;

    /** Notes as { frequency Hz, start s, duration s }. */
    private static final Map<String, double[][]> NOTES = new HashMap<>();
    private static final Map<String, short[]> PCM = new HashMap<>();

    static {
        NOTES.put("pip", new double[][] {{880, 0, 0.15}});
        NOTES.put("lastPip", new double[][] {{1320, 0, 0.5}});
        NOTES.put("walk", new double[][] {{440, 0, 0.35}, {440, 0.5, 0.35}});
        NOTES.put("jog", new double[][] {{660, 0, 0.2}, {660, 0.3, 0.2}, {660, 0.6, 0.2}});
        NOTES.put("run", new double[][] {{990, 0, 0.1}, {990, 0.16, 0.1}, {990, 0.32, 0.1}, {990, 0.48, 0.1}});
        double[][] first = fanfare(0);
        double[][] second = fanfare(1.3);
        double[][] finish = new double[first.length + second.length][];
        System.arraycopy(first, 0, finish, 0, first.length);
        System.arraycopy(second, 0, finish, first.length, second.length);
        NOTES.put("finish", finish);
    }

    private ToneBank() {}

    private static double[][] fanfare(double offset) {
        return new double[][] {
            {523, offset, 0.15}, {659, offset + 0.18, 0.15}, {784, offset + 0.36, 0.15}, {1047, offset + 0.54, 0.55},
        };
    }

    static boolean has(String kind) {
        return NOTES.containsKey(kind);
    }

    static long durationMs(String kind) {
        double end = 0;
        for (double[] note : NOTES.get(kind)) end = Math.max(end, note[1] + note[2]);
        return Math.round(end * 1000);
    }

    static synchronized short[] pcm(String kind) {
        short[] cached = PCM.get(kind);
        if (cached != null) return cached;
        int length = (int) Math.ceil(durationMs(kind) / 1000.0 * SAMPLE_RATE);
        double[] mix = new double[length];
        for (double[] note : NOTES.get(kind)) addNote(mix, note[0], note[1], note[2]);
        short[] out = new short[length];
        for (int i = 0; i < length; i++) {
            out[i] = (short) Math.round(Math.max(-1, Math.min(1, mix[i])) * Short.MAX_VALUE);
        }
        PCM.put(kind, out);
        return out;
    }

    /** Triangle wave: full-sounding near maximum volume without the harshness of square waves. */
    private static void addNote(double[] mix, double frequency, double at, double duration) {
        int start = (int) Math.round(at * SAMPLE_RATE);
        int count = (int) Math.round(duration * SAMPLE_RATE);
        for (int i = 0; i < count && start + i < mix.length; i++) {
            double t = (double) i / SAMPLE_RATE;
            double cycle = t * frequency;
            double triangle = 2 * Math.abs(2 * (cycle - Math.floor(cycle + 0.5))) - 1;
            double envelope = Math.max(0, Math.min(1, Math.min(t / ATTACK_S, (duration - t) / RELEASE_S)));
            mix[start + i] += MAX_GAIN * envelope * triangle;
        }
    }
}
```

- [ ] **Step 2: Cue player (tones, speech, audio focus)**

Create `CuePlayer.java`:

```java
package io.github.willenjs.pulserun.coach;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.SystemClock;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.json.JSONArray;

/**
 * Plays cue tones and spoken lines. While anything plays it holds transient
 * "may duck" audio focus, so other apps (e.g. YouTube) lower their volume
 * and come back afterwards. Every method must run on the handler's thread.
 */
final class CuePlayer {
    // Set to false if another app pauses instead of ducking: cues then play over it.
    static final boolean USE_AUDIO_FOCUS = true;
    // Matches SPEECH_RATE in src/platform/speech.js.
    private static final float SPEECH_RATE = 1.5f;
    // Extra time before a finished tone's track is released.
    private static final long TONE_RELEASE_MARGIN_MS = 100;

    private final Handler handler;
    private final AudioManager audioManager;
    private final AudioAttributes attributes = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build();
    private final Object focusRequest;
    private final Object releaseToken = new Object();
    private final List<AudioTrack> tracks = new ArrayList<>();
    private final Map<String, Runnable> speechDone = new HashMap<>();
    private final List<Runnable> pendingSpeech = new ArrayList<>();
    private List<String> locales;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private boolean ttsFailed = false;
    private int holds = 0;
    private int nextUtterance = 0;

    CuePlayer(Context context, Handler handler, List<String> locales) {
        this.handler = handler;
        this.locales = locales;
        audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        focusRequest = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attributes)
                .setOnAudioFocusChangeListener(change -> {})
                .build()
            : null;
        // Created up front so the engine is warm before the first cue.
        tts = new TextToSpeech(context.getApplicationContext(), status -> handler.post(() -> onTtsInit(status)));
    }

    static List<String> strings(JSONArray array) {
        List<String> out = new ArrayList<>();
        if (array == null) return out;
        for (int i = 0; i < array.length(); i++) {
            String value = array.optString(i, null);
            if (value != null) out.add(value);
        }
        return out;
    }

    void setLocales(List<String> locales) {
        this.locales = locales;
        if (ttsReady) applyLocale();
    }

    void playTone(String kind, int volume) {
        if (volume <= 0 || !ToneBank.has(kind)) return;
        short[] pcm = ToneBank.pcm(kind);
        AudioTrack track;
        try {
            track = new AudioTrack.Builder()
                .setAudioAttributes(attributes)
                .setAudioFormat(new AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(ToneBank.SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build())
                .setTransferMode(AudioTrack.MODE_STATIC)
                .setBufferSizeInBytes(pcm.length * 2)
                .build();
            track.write(pcm, 0, pcm.length);
            track.setVolume(volume / 100f);
        } catch (RuntimeException e) {
            return;
        }
        hold();
        tracks.add(track);
        track.play();
        long releaseAt = SystemClock.uptimeMillis() + ToneBank.durationMs(kind) + TONE_RELEASE_MARGIN_MS;
        handler.postAtTime(() -> {
            if (tracks.remove(track)) {
                track.release();
                release();
            }
        }, releaseToken, releaseAt);
    }

    /** Speaks `text`, then runs `onDone` (also when speech is off or fails). */
    void speak(String text, int volume, Runnable onDone) {
        if (volume <= 0 || ttsFailed || tts == null) {
            onDone.run();
            return;
        }
        if (!ttsReady) {
            pendingSpeech.add(() -> speak(text, volume, onDone));
            return;
        }
        String id = "cue" + nextUtterance++;
        Bundle params = new Bundle();
        params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume / 100f);
        hold();
        speechDone.put(id, onDone);
        if (tts.speak(text, TextToSpeech.QUEUE_ADD, params, id) != TextToSpeech.SUCCESS) finishSpeech(id);
    }

    /** Silences everything now; pending onDone callbacks are dropped. */
    void stopAll() {
        handler.removeCallbacksAndMessages(releaseToken);
        pendingSpeech.clear();
        speechDone.clear();
        if (tts != null) tts.stop();
        for (AudioTrack track : tracks) {
            try {
                track.stop();
            } catch (IllegalStateException ignored) {
                // Already stopped.
            }
            track.release();
        }
        tracks.clear();
        holds = 0;
        abandonFocus();
    }

    void shutdown() {
        stopAll();
        if (tts != null) {
            tts.shutdown();
            tts = null;
        }
    }

    private void onTtsInit(int status) {
        if (tts == null) return;
        if (status != TextToSpeech.SUCCESS) {
            ttsFailed = true;
        } else {
            ttsReady = true;
            tts.setAudioAttributes(attributes);
            tts.setSpeechRate(SPEECH_RATE);
            applyLocale();
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) {}
                @Override public void onDone(String id) { handler.post(() -> finishSpeech(id)); }
                @Override public void onError(String id) { handler.post(() -> finishSpeech(id)); }
                @Override public void onStop(String id, boolean interrupted) { handler.post(() -> finishSpeech(id)); }
            });
        }
        List<Runnable> pending = new ArrayList<>(pendingSpeech);
        pendingSpeech.clear();
        for (Runnable speech : pending) speech.run();
    }

    /** First locale the engine supports (language match is enough); otherwise its default voice. */
    private void applyLocale() {
        for (String tag : locales) {
            Locale locale = Locale.forLanguageTag(tag);
            if (tts.isLanguageAvailable(locale) >= TextToSpeech.LANG_AVAILABLE) {
                tts.setLanguage(locale);
                return;
            }
        }
    }

    private void finishSpeech(String id) {
        Runnable done = speechDone.remove(id);
        if (done == null) return;
        release();
        done.run();
    }

    private void hold() {
        if (holds++ == 0) requestFocus();
    }

    private void release() {
        if (holds > 0 && --holds == 0) abandonFocus();
    }

    private void requestFocus() {
        if (USE_AUDIO_FOCUS && focusRequest != null) {
            audioManager.requestAudioFocus((AudioFocusRequest) focusRequest);
        }
    }

    private void abandonFocus() {
        if (USE_AUDIO_FOCUS && focusRequest != null) {
            audioManager.abandonAudioFocusRequest((AudioFocusRequest) focusRequest);
        }
    }
}
```

- [ ] **Step 3: Plugin with the audio test**

Create `CoachPlugin.java`:

```java
package io.github.willenjs.pulserun.coach;

import android.Manifest;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import org.json.JSONArray;
import org.json.JSONObject;

/** Bridge for src/platform/native/nativeCueEngine.js. */
@CapacitorPlugin(
    name = "Coach",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class CoachPlugin extends Plugin {
    // Silence between consecutive tones in the audio test (TEST_GAP_S in audio.js).
    private static final long TEST_GAP_MS = 250;
    private static final long TEST_LEAD_MS = 50;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final Object testToken = new Object();
    private CuePlayer testPlayer;
    private int testRun = 0;

    /** Plays the sample line (if any), then the tones one after another; resolves when done. */
    @PluginMethod
    public void test(PluginCall call) {
        main.post(() -> runTest(call));
    }

    private void runTest(PluginCall call) {
        int run = ++testRun;
        main.removeCallbacksAndMessages(testToken);
        java.util.List<String> locales = CuePlayer.strings(call.getArray("locales"));
        if (testPlayer == null) {
            testPlayer = new CuePlayer(getContext(), main, locales);
        } else {
            testPlayer.stopAll();
            testPlayer.setLocales(locales);
        }
        JSONArray tones = call.getArray("tones");
        JSObject speech = call.getObject("speech");
        Runnable playTones = () -> {
            if (run != testRun) {
                call.resolve();
                return;
            }
            long at = android.os.SystemClock.uptimeMillis() + TEST_LEAD_MS;
            for (int i = 0; tones != null && i < tones.length(); i++) {
                JSONObject tone = tones.optJSONObject(i);
                if (tone == null || !ToneBank.has(tone.optString("tone"))) continue;
                String kind = tone.optString("tone");
                int volume = tone.optInt("volume");
                main.postAtTime(() -> testPlayer.playTone(kind, volume), testToken, at);
                at += ToneBank.durationMs(kind) + TEST_GAP_MS;
            }
            main.postAtTime(call::resolve, testToken, at);
        };
        if (speech != null) {
            testPlayer.speak(speech.optString("text"), speech.optInt("volume"), playTones);
        } else {
            playTones.run();
        }
    }

    @Override
    protected void handleOnDestroy() {
        main.removeCallbacksAndMessages(testToken);
        if (testPlayer != null) testPlayer.shutdown();
        super.handleOnDestroy();
    }
}
```

Note: a test call superseded by a newer one is resolved by `stopAll()` dropping its callbacks only if its tones had not been scheduled yet; the JS engine ignores stale resolutions (Task 4), so an unresolved stale call is harmless.

- [ ] **Step 4: Register the plugin and declare TTS visibility**

Replace `android/app/src/main/java/io/github/willenjs/pulserun/MainActivity.java` with:

```java
package io.github.willenjs.pulserun;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.github.willenjs.pulserun.coach.CoachPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before super.onCreate.
        registerPlugin(CoachPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```

In `android/app/src/main/AndroidManifest.xml`, inside `<manifest>` and before `<application>`, add:

```xml
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <!-- Android 11+ package visibility: lets TextToSpeech find the TTS engine. -->
    <queries>
        <intent>
            <action android:name="android.intent.action.TTS_SERVICE" />
        </intent>
    </queries>
```

- [ ] **Step 5: Build**

Run: `npm run android:build`
Expected: `BUILD SUCCESSFUL`. Fix any compile error it reports before continuing.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main
git commit -m "feat: add native tones, speech and audio test to the Android app" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Foreground coach service

**Files:**
- Create: `android/app/src/main/java/io/github/willenjs/pulserun/coach/CoachService.java`
- Create: `android/app/src/main/res/drawable/ic_notification.xml`
- Modify: `android/app/src/main/java/io/github/willenjs/pulserun/coach/CoachPlugin.java` (add `start`, `stop`)
- Modify: `android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Consumes: `CuePlayer`, `ToneBank` (Task 6); plugin payload `start({ events, locales, notification: { channel, title, text } })` (Task 4).
- Produces: `CoachService.start(Context, String payloadJson)`, `CoachService.stop(Context)`; plugin methods `start` and `stop`.

- [ ] **Step 1: Notification icon**

Create `android/app/src/main/res/drawable/ic_notification.xml` (a bolt, monochrome as status-bar icons must be):

```xml
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M13,2L3,14h7l-1,8 10,-12h-7z" />
</vector>
```

- [ ] **Step 2: The service**

Create `CoachService.java`:

```java
package io.github.willenjs.pulserun.coach;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import io.github.willenjs.pulserun.R;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Plays a workout's whole cue timeline in the foreground, so cues stay on
 * time with the screen locked or another app in front. A partial wake lock
 * keeps the CPU (and the uptime clock the handler uses) running until the
 * last cue has played.
 */
public class CoachService extends Service {
    private static final String ACTION_START = "io.github.willenjs.pulserun.coach.START";
    private static final String EXTRA_PAYLOAD = "payload";
    private static final String CHANNEL_ID = "workout";
    private static final int NOTIFICATION_ID = 1;
    // Keeps the service up after the last cue starts, so the fanfare and finish line play out.
    private static final long FINISH_GRACE_MS = 15_000;

    private final Object eventsToken = new Object();
    private HandlerThread thread;
    private Handler handler;
    private CuePlayer player;
    private PowerManager.WakeLock wakeLock;

    static void start(Context context, String payload) {
        Intent intent = new Intent(context, CoachService.class).setAction(ACTION_START).putExtra(EXTRA_PAYLOAD, payload);
        ContextCompat.startForegroundService(context, intent);
    }

    static void stop(Context context) {
        context.stopService(new Intent(context, CoachService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        thread = new HandlerThread("coach");
        thread.start();
        handler = new Handler(thread.getLooper());
        PowerManager power = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PulseRun:workout");
        wakeLock.setReferenceCounted(false);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        JSONObject payload = null;
        try {
            if (intent != null && ACTION_START.equals(intent.getAction())) {
                payload = new JSONObject(intent.getStringExtra(EXTRA_PAYLOAD));
            }
        } catch (JSONException | NullPointerException ignored) {
            // Handled below.
        }
        // Must reach the foreground promptly after startForegroundService, even on bad input.
        startInForeground(payload == null ? new JSONObject() : payload.optJSONObject("notification"));
        if (payload == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        JSONObject timeline = payload;
        handler.post(() -> schedule(timeline));
        return START_NOT_STICKY;
    }

    private void startInForeground(JSONObject notification) {
        JSONObject text = notification == null ? new JSONObject() : notification;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(new NotificationChannel(
                CHANNEL_ID, text.optString("channel", "PulseRun"), NotificationManager.IMPORTANCE_LOW));
        }
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent content = open == null ? null : PendingIntent.getActivity(
            this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification built = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(text.optString("title", "PulseRun"))
            .setContentText(text.optString("text", ""))
            .setContentIntent(content)
            .setOngoing(true)
            .setSilent(true)
            .build();
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, built, type);
    }

    /** Replaces whatever was scheduled with this timeline. Runs on the coach thread. */
    private void schedule(JSONObject payload) {
        handler.removeCallbacksAndMessages(eventsToken);
        if (player == null) {
            player = new CuePlayer(this, handler, CuePlayer.strings(payload.optJSONArray("locales")));
        } else {
            player.stopAll();
            player.setLocales(CuePlayer.strings(payload.optJSONArray("locales")));
        }
        JSONArray events = payload.optJSONArray("events");
        if (events == null) events = new JSONArray();

        // Speech waits for the tone at the same moment: tone first, then voice.
        Map<Long, Long> toneLength = new HashMap<>();
        for (int i = 0; i < events.length(); i++) {
            JSONObject event = events.optJSONObject(i);
            if (event == null || !"tone".equals(event.optString("type"))) continue;
            String tone = event.optString("tone");
            if (!ToneBank.has(tone)) continue;
            long atMs = event.optLong("atMs");
            toneLength.put(atMs, Math.max(lengthAt(toneLength, atMs), ToneBank.durationMs(tone)));
        }

        long base = SystemClock.uptimeMillis();
        long lastMs = 0;
        for (int i = 0; i < events.length(); i++) {
            JSONObject event = events.optJSONObject(i);
            if (event == null) continue;
            long atMs = event.optLong("atMs");
            int volume = event.optInt("volume");
            if ("tone".equals(event.optString("type"))) {
                String tone = event.optString("tone");
                if (!ToneBank.has(tone)) continue;
                handler.postAtTime(() -> player.playTone(tone, volume), eventsToken, base + atMs);
                lastMs = Math.max(lastMs, atMs + ToneBank.durationMs(tone));
            } else if ("speech".equals(event.optString("type"))) {
                String text = event.optString("text");
                long speakAt = atMs + lengthAt(toneLength, atMs);
                handler.postAtTime(() -> player.speak(text, volume, () -> {}), eventsToken, base + speakAt);
                lastMs = Math.max(lastMs, speakAt);
            }
        }

        long endMs = lastMs + FINISH_GRACE_MS;
        wakeLock.acquire(endMs);
        handler.postAtTime(this::stopSelf, eventsToken, base + endMs);
    }

    private static long lengthAt(Map<Long, Long> toneLength, long atMs) {
        Long length = toneLength.get(atMs);
        return length == null ? 0 : length;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        handler.post(() -> {
            if (player != null) player.shutdown();
            player = null;
        });
        thread.quitSafely();
        if (wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
```

- [ ] **Step 3: Plugin `start` and `stop`**

In `CoachPlugin.java`, add these two methods above `test`:

```java
    /** Starts (or replaces) the workout timeline in the foreground service. */
    @PluginMethod
    public void start(PluginCall call) {
        try {
            CoachService.start(getContext(), call.getData().toString());
            call.resolve();
        } catch (RuntimeException e) {
            call.reject("Could not start the workout service", e);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        CoachService.stop(getContext());
        call.resolve();
    }
```

- [ ] **Step 4: Manifest**

In `AndroidManifest.xml`, next to the `POST_NOTIFICATIONS` line from Task 6, add:

```xml
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
```

Inside `<application>`, after the `<activity>` element, add:

```xml
        <service
            android:name=".coach.CoachService"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback" />
```

- [ ] **Step 5: Build**

Run: `npm run android:build`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main
git commit -m "feat: schedule workout cues in an Android foreground service" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Wire the native engine into the controller, document, phone test

**Files:**
- Create: `src/platform/native/coachPlugin.js`
- Modify: `src/ui/controller.svelte.js`
- Modify: `README.md`, `AGENTS.md`

**Interfaces:**
- Consumes: `createNativeCueEngine` (Task 4), `createWebCueEngine` (Task 3), `speechText` (Task 2), plugin `Coach` (Tasks 6–7).
- Produces: `Coach` (Capacitor plugin proxy) and `isNativeApp() → boolean` from `src/platform/native/coachPlugin.js`.

- [ ] **Step 1: Plugin proxy**

Create `src/platform/native/coachPlugin.js`:

```js
import { Capacitor, registerPlugin } from '@capacitor/core';

/** Java side: android/app/src/main/java/io/github/willenjs/pulserun/coach/CoachPlugin.java */
export const Coach = registerPlugin('Coach');

/** True inside the Android app, false in a browser. */
export function isNativeApp() {
  return Capacitor.isNativePlatform();
}
```

- [ ] **Step 2: Pick the engine and skip web-only work on native**

In `src/ui/controller.svelte.js`:

1. Add imports:
   ```js
   import { createNativeCueEngine } from '../platform/native/nativeCueEngine.js';
   import { Coach, isNativeApp } from '../platform/native/coachPlugin.js';
   ```
   and change the cueText import to `import { phaseLine, speechText } from '../i18n/cueText.js';`.
2. Replace the engine declaration added in Task 3 with:
   ```js
   const webEngine = createWebCueEngine({ locales: () => VOICE_LOCALES[app.lang] });
   /** @type {import('../platform/webCueEngine.js').CueEngine} */
   let engine = isNativeApp()
     ? createNativeCueEngine({
       plugin: Coach,
       locales: () => VOICE_LOCALES[app.lang],
       speechText: (event) => speechText(event, app.lang),
       notification: (workout) => ({
         channel: t('notification.channel'),
         title: t('workout.title', { week: workout.week, day: workout.day }),
         text: t('notification.running'),
       }),
       onFailure: useWebEngine,
     })
     : webEngine;

   /** The native cue service failed: finish the session with web audio. */
   function useWebEngine(error) {
     console.warn('Native cues failed; using web audio.', error);
     if (engine === webEngine) return;
     engine = webEngine;
     if (app.session && app.session.pausedAt === null) playCues();
   }
   ```
3. In `setLang`, after `storage.saveLang(lang);`, add:
   ```js
     // The native engine speaks pre-rendered text: re-send it in the new language.
     if (engine.speaksInBackground && app.session && app.session.pausedAt === null) {
       engine.stop();
       playCues();
     }
   ```
4. In `say`, change the guard to `if (!canSpeak() || engine.speaksInBackground) return false;` (the native engine speaks phase and finish lines itself).
5. In `beginRun`, change `wakeLock.acquire();` to `if (!engine.speaksInBackground) wakeLock.acquire();` (the service holds its own wake lock).
6. In `onVisibilityChange`, change the re-sync line to
   `if (app.session && app.session.pausedAt === null && !engine.speaksInBackground) playCues();`
   (the native clock does not stall; re-sending would cut speech in progress).
7. In `finish`, change `finishTimer = setTimeout(() => engine.stop(), FINISH_AUDIO_GRACE_MS);` to
   `if (!engine.speaksInBackground) finishTimer = setTimeout(() => engine.stop(), FINISH_AUDIO_GRACE_MS);`
   (the service stops itself after the finish line).

- [ ] **Step 3: Tests, web build, web check**

Run: `npm test` then `npm run build`
Expected: PASS; build succeeds. In the preview browser, run the same checks as Task 3 Step 4 and confirm no console errors: in a browser `isNativeApp()` is false, so behavior must be unchanged.

- [ ] **Step 4: Document the Android app**

In `README.md`, after the "Commands" section, add:

````markdown
## Android app

The same app, wrapped with Capacitor, with cues played by a native
foreground service so voice and beeps keep time with the screen locked or
another app (e.g. YouTube) in front. Other apps' audio is ducked while a cue
plays.

Prerequisites: Android Studio 2025.2.1+ with its Android SDK. The build
script uses Android Studio's bundled JDK and the default SDK location unless
`JAVA_HOME` / `ANDROID_HOME` are set.

```bash
npm run android:build     # debug APK: android/app/build/outputs/apk/debug/app-debug.apk
npm run android:install   # build, then install on the phone over USB
```

For `android:install`, enable Developer options and USB debugging on the
phone and accept the computer's key when prompted. Native code lives in
`android/app/src/main/java/io/github/willenjs/pulserun/coach/`. App icons
were generated from `assets/` with `npx capacitor-assets generate --android`.

### Manual phone test (Android app)

1. Start Semana 1 - Dia 1, lock the screen, wait through two phase changes:
   voice and beeps arrive on time.
2. Play a YouTube video in the foreground with PulseRun in the background:
   each cue lowers YouTube briefly, then it returns. If YouTube pauses
   instead, set `USE_AUDIO_FOCUS = false` in `CuePlayer.java` and retest.
3. Pause, resume and skip in the app, then lock again: cues follow the new
   timing. Switch the language mid-run: the next line uses the new language.
4. Remove the app from recents mid-workout, reopen, resume from the dialog:
   cues resume.
5. Leave the phone locked for a full 30+ minute workout: no cue is missed or
   more than about a second late.
````

Also in `README.md`, add to "Project layout":

```markdown
- `src/platform/native/` — the Android app's cue engine and plugin bridge.
- `android/` — Capacitor Android project, including the native coach service.
```

In `AGENTS.md` "Commands", add:

```markdown
- Android APK: `npm run android:build` (install over USB: `npm run android:install`)
```

and in "Architecture rules", add:

```markdown
- `src/platform/native/` talks to the Android `Coach` plugin. In the app the
  native engine speaks every cue itself (`speaksInBackground`), so the
  controller must not speak or hold the screen wake lock there.
```

- [ ] **Step 5: Build and install the APK**

Run: `npm run android:build`
Expected: `BUILD SUCCESSFUL`. If a phone is connected with USB debugging (`adb devices` lists it), run `npm run android:install` and expect `Success`.

- [ ] **Step 6: Commit**

```bash
git add src/platform/native/coachPlugin.js src/ui/controller.svelte.js README.md AGENTS.md
git commit -m "feat: use native cues in the Android app" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Hand over the phone test**

Background audio cannot be claimed to work without a real phone (AGENTS.md). Ask the user to run "Manual phone test (Android app)" from the README during a treadmill session and report results for steps 1, 2 and 5. Those decide whether this approach stays or the full native rewrite is revisited.
