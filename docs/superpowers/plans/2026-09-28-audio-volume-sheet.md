# Audio & Volume Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The header speaker opens an "Audio & Volume" bottom sheet with master volume, per-cue toggles (countdown beeps, voice coach, finish fanfare), a coach style (commands / intense) and an audio test, all persisted and applied live, including mid-run.

**Architecture:** Pure settings, cue-filtering and coach-line logic live in `src/core/` (tested first). `src/platform/storage.js` gains per-key envelope versions with a v1→v2 settings migration; `audio.js`/`speech.js` accept a volume. `controller.svelte.js` owns `app.settings` and `app.audioSheetOpen`, and re-schedules cues on every change. A new `AudioSheet.svelte` renders the mockup.

**Tech Stack:** Vite, Svelte 5 runes, plain JavaScript, Vitest, Web Audio API, Web Speech API.

**Spec:** `docs/superpowers/specs/2026-09-28-audio-volume-sheet-design.md` (mockup: `layout-target/volume/screen.png`, `code.html`, `DESIGN.md`).

## Global Constraints

- `src/core/` is pure JS: no DOM, no Svelte, no browser APIs, no imports from outside `core/`.
- `src/platform/` may import from `core/` only. Components never call `platform/` directly; they call controller actions.
- Svelte 5 runes only (`$state`, `$derived`, `$props`, `onclick=`); no `export let`, `$:`, `on:click`.
- Code, identifiers, comments, commit messages in English; Portuguese only in `src/i18n/pt.js`, Spanish only in `src/i18n/es.js`.
- Every new i18n key goes into `pt.js`, `en.js` and `es.js` (a test enforces matching keys).
- localStorage keys stay `runningAssistant.*` in `{ "version": N, "data": ... }`; settings move to version 2 with migration from 1. Storage code must never throw.
- Any action that changes audio behavior during a session must `cuePlayer.stop()` and, if the session is running (not paused), start it again. `cuePlayer.start()` / `cuePlayer.test()` only from a user gesture.
- 100% volume = today's loudness: tone gain `0.95`, speech `utterance.volume = 1`.
- Defaults: `{ volume: 100, beeps: true, voice: true, voiceStyle: 'commands', fanfare: true }`. Presets `[0, 50, 80, 100]`.
- Conventional commits; end each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- Layout must work at 360px width.

## Review Focus

1. Range input values arrive as strings (`"50"`): `normalizeAudioSettings` must coerce numeric strings, clamp to 0–100 and round; garbage falls back to the default. (Task 1 test.)
2. Stored settings that are stale or corrupt (v1 with non-boolean `muted`, v2 partial object, `volume: 150`, `volume: -3`, unknown `voiceStyle`, unknown version) must load as valid settings, never throw. (Tasks 1 and 4 tests.)
3. Volume 0 must silence everything — no tones scheduled and no speech — even with every switch on. (Task 2 test for tones; Task 6 `say()` guard + manual check.)
4. Intense coach when the halfway phase is also the last phase must say only "last phase", and phase 0 never gets "halfway". (Task 3 tests.)
5. Changing a setting while the run is paused must not start cues; changing it while running must keep cues in sync with the timer. (Task 6 code + Task 7 manual check.)

---

## File Structure

- Create `src/core/audioSettings.js` — settings shape, defaults, presets, normalization, level, muted rule.
- Modify `src/core/cues.js` — add `filterCues`.
- Create `src/core/coach.js` — `coachExtras` for intense style.
- Modify `src/platform/storage.js` — per-key versions, settings v2 + migration.
- Modify `src/platform/audio.js` — volume-scaled gain, filtered cues, `test()`.
- Modify `src/platform/speech.js` — volume option.
- Modify `src/i18n/pt.js`, `en.js`, `es.js` — new keys.
- Modify `src/ui/controller.svelte.js` — settings state, sheet state, actions.
- Modify `src/ui/components/AppHeader.svelte`, `src/ui/RunScreen.svelte`, `src/ui/WorkoutScreen.svelte` — use the new muted rule; speaker opens the sheet.
- Modify `src/ui/components/Icon.svelte` — new icons.
- Create `src/ui/components/Switch.svelte` — accessible on/off switch.
- Create `src/ui/components/AudioSheet.svelte` — the sheet.
- Modify `src/ui/App.svelte` — mount the sheet.
- Tests: create `tests/core/audioSettings.test.js`, `tests/core/coach.test.js`; modify `tests/core/cues.test.js`, `tests/platform/storage.test.js`, `tests/i18n/i18n.test.js`.

---

### Task 1: Audio settings model

**Files:**
- Create: `src/core/audioSettings.js`
- Test: `tests/core/audioSettings.test.js`

**Interfaces:**
- Produces:
  - `/** @typedef {{ volume: number, beeps: boolean, voice: boolean, voiceStyle: 'commands' | 'intense', fanfare: boolean }} AudioSettings */`
  - `DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings>`
  - `VOLUME_PRESETS: number[]` = `[0, 50, 80, 100]`
  - `VOICE_STYLES: string[]` = `['intense', 'commands']`
  - `normalizeAudioSettings(value: unknown): AudioSettings` (always a fresh object)
  - `volumeLevel(volume: number): 'off' | 'low' | 'normal' | 'high'`
  - `isMuted(settings: AudioSettings): boolean`

- [ ] **Step 1: Write the failing test**

`tests/core/audioSettings.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_AUDIO_SETTINGS, VOLUME_PRESETS, VOICE_STYLES,
  normalizeAudioSettings, volumeLevel, isMuted,
} from '../../src/core/audioSettings.js';

describe('audio settings defaults', () => {
  it('keep today\'s behavior: full volume, everything on, plain commands', () => {
    expect(DEFAULT_AUDIO_SETTINGS).toEqual({
      volume: 100, beeps: true, voice: true, voiceStyle: 'commands', fanfare: true,
    });
    expect(Object.isFrozen(DEFAULT_AUDIO_SETTINGS)).toBe(true);
  });

  it('offer mute, medium, strong and max presets and two coach styles', () => {
    expect(VOLUME_PRESETS).toEqual([0, 50, 80, 100]);
    expect(VOICE_STYLES).toEqual(['intense', 'commands']);
  });
});

describe('normalizeAudioSettings', () => {
  it('returns a fresh copy of the defaults for non-objects', () => {
    for (const value of [undefined, null, 'x', 42, []]) {
      const settings = normalizeAudioSettings(value);
      expect(settings).toEqual(DEFAULT_AUDIO_SETTINGS);
      expect(settings).not.toBe(DEFAULT_AUDIO_SETTINGS);
    }
  });

  it('keeps valid fields and fills missing ones from the defaults', () => {
    expect(normalizeAudioSettings({ volume: 40, voice: false })).toEqual({
      volume: 40, beeps: true, voice: false, voiceStyle: 'commands', fanfare: true,
    });
    expect(normalizeAudioSettings({ voiceStyle: 'intense', beeps: false, fanfare: false })).toEqual({
      volume: 100, beeps: false, voice: true, voiceStyle: 'intense', fanfare: false,
    });
  });

  it('clamps and rounds the volume, and accepts numeric strings from range inputs', () => {
    expect(normalizeAudioSettings({ volume: 150 }).volume).toBe(100);
    expect(normalizeAudioSettings({ volume: -3 }).volume).toBe(0);
    expect(normalizeAudioSettings({ volume: 42.6 }).volume).toBe(43);
    expect(normalizeAudioSettings({ volume: '50' }).volume).toBe(50);
  });

  it('replaces invalid fields with the defaults', () => {
    expect(normalizeAudioSettings({
      volume: 'loud', beeps: 'yes', voice: 1, voiceStyle: 'shouty', fanfare: null,
    })).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(normalizeAudioSettings({ volume: Number.NaN }).volume).toBe(100);
    expect(normalizeAudioSettings({ volume: '' }).volume).toBe(100);
  });
});

describe('volumeLevel', () => {
  it('names the level shown under the slider', () => {
    expect(volumeLevel(0)).toBe('off');
    expect(volumeLevel(1)).toBe('low');
    expect(volumeLevel(39)).toBe('low');
    expect(volumeLevel(40)).toBe('normal');
    expect(volumeLevel(84)).toBe('normal');
    expect(volumeLevel(85)).toBe('high');
    expect(volumeLevel(100)).toBe('high');
  });
});

describe('isMuted', () => {
  it('is true only at volume 0', () => {
    expect(isMuted({ ...DEFAULT_AUDIO_SETTINGS, volume: 0 })).toBe(true);
    expect(isMuted({ ...DEFAULT_AUDIO_SETTINGS, volume: 1 })).toBe(false);
    expect(isMuted({ ...DEFAULT_AUDIO_SETTINGS, beeps: false, voice: false, fanfare: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/audioSettings.test.js`
Expected: FAIL — cannot resolve `../../src/core/audioSettings.js`.

- [ ] **Step 3: Write the implementation**

`src/core/audioSettings.js`:

```js
/** @typedef {'commands' | 'intense'} VoiceStyle */
/**
 * @typedef {{
 *   volume: number,
 *   beeps: boolean,
 *   voice: boolean,
 *   voiceStyle: VoiceStyle,
 *   fanfare: boolean,
 * }} AudioSettings
 * volume: 0–100, where 100 is the loudest the app plays.
 * beeps: the 3-2-1 countdown before each phase change.
 * voice: spoken phase announcements.
 * fanfare: the finish melody.
 */

/** @type {Readonly<AudioSettings>} */
export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  volume: 100,
  beeps: true,
  voice: true,
  voiceStyle: 'commands',
  fanfare: true,
});

export const VOLUME_PRESETS = [0, 50, 80, 100];

/** @type {VoiceStyle[]} */
export const VOICE_STYLES = ['intense', 'commands'];

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

/** Range inputs report their value as a string, so numeric strings count. */
function toVolume(value) {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.round(Math.min(100, Math.max(0, n)));
}

/**
 * Any input to a valid AudioSettings; invalid or missing fields take the default.
 * @returns {AudioSettings}
 */
export function normalizeAudioSettings(value) {
  const input = isObject(value) ? value : {};
  const d = DEFAULT_AUDIO_SETTINGS;
  return {
    volume: toVolume(input.volume) ?? d.volume,
    beeps: bool(input.beeps, d.beeps),
    voice: bool(input.voice, d.voice),
    voiceStyle: VOICE_STYLES.includes(input.voiceStyle) ? input.voiceStyle : d.voiceStyle,
    fanfare: bool(input.fanfare, d.fanfare),
  };
}

/** @returns {'off' | 'low' | 'normal' | 'high'} */
export function volumeLevel(volume) {
  if (volume <= 0) return 'off';
  if (volume < 40) return 'low';
  if (volume < 85) return 'normal';
  return 'high';
}

/** @param {AudioSettings} settings */
export function isMuted(settings) {
  return settings.volume === 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/audioSettings.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/audioSettings.js tests/core/audioSettings.test.js
git commit -m "feat: add audio settings model with presets and normalization"
```

---

### Task 2: Filter cues by audio settings

**Files:**
- Modify: `src/core/cues.js` (append a function)
- Test: `tests/core/cues.test.js` (append a `describe`)

**Interfaces:**
- Consumes: `Cue` (`{ kind: CueKind, inMs: number }`) from `upcomingCues`; `AudioSettings` from Task 1.
- Produces: `filterCues(cues: Cue[], settings: Pick<AudioSettings, 'volume' | 'beeps' | 'fanfare'>): Cue[]`

- [ ] **Step 1: Write the failing test**

In `tests/core/cues.test.js`, change the import line to:

```js
import { upcomingCues, filterCues } from '../../src/core/cues.js';
```

Append:

```js
describe('filterCues', () => {
  const all = upcomingCues(fresh(), w, T0);
  const on = { volume: 100, beeps: true, fanfare: true };
  const kinds = (cues) => new Set(cues.map((c) => c.kind));

  it('keeps everything when all cues are on', () => {
    expect(filterCues(all, on)).toEqual(all);
  });

  it('drops the countdown pips when beeps are off, keeping phase tones', () => {
    const cues = filterCues(all, { ...on, beeps: false });
    expect(kinds(cues)).toEqual(new Set(['walk', 'jog', 'run', 'finish']));
    expect(cues).toHaveLength(5 + 1);
  });

  it('drops the finish melody when the fanfare is off', () => {
    const cues = filterCues(all, { ...on, fanfare: false });
    expect(cues.some((c) => c.kind === 'finish')).toBe(false);
    expect(cues).toHaveLength(all.length - 1);
  });

  it('keeps phase-start tones even with beeps and fanfare off', () => {
    const cues = filterCues(all, { volume: 50, beeps: false, fanfare: false });
    expect(cues.map((c) => c.kind)).toEqual(['walk', 'jog', 'walk', 'jog', 'run']);
  });

  it('schedules nothing at volume 0', () => {
    expect(filterCues(all, { ...on, volume: 0 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/cues.test.js`
Expected: FAIL — `filterCues is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/core/cues.js`:

```js
const COUNTDOWN_KINDS = new Set(['pip', 'lastPip']);

/**
 * Cues the runner asked to hear. Phase-start tones always stay (unless
 * muted): they are how phases are told apart without looking.
 * @param {Cue[]} cues
 * @param {{ volume: number, beeps: boolean, fanfare: boolean }} settings
 * @returns {Cue[]}
 */
export function filterCues(cues, { volume, beeps, fanfare }) {
  if (volume <= 0) return [];
  return cues.filter((cue) =>
    (beeps || !COUNTDOWN_KINDS.has(cue.kind)) && (fanfare || cue.kind !== 'finish'));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/cues.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/cues.js tests/core/cues.test.js
git commit -m "feat: filter audio cues by beeps, fanfare and volume settings"
```

---

### Task 3: Intense coach lines

**Files:**
- Create: `src/core/coach.js`
- Test: `tests/core/coach.test.js`

**Interfaces:**
- Consumes: `phaseBoundaries(workout)` from `src/core/timer.js` (returns `{ startMs, endMs }[]`); `Workout` from `src/core/plan.js`.
- Produces: `coachExtras(workout: Workout, phaseIndex: number, style: 'commands' | 'intense'): string[]` — i18n keys among `coach.walk`, `coach.jog`, `coach.run`, `coach.halfway`, `coach.last`.

- [ ] **Step 1: Write the failing test**

`tests/core/coach.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { findWorkout } from '../../src/core/plan.js';
import { coachExtras } from '../../src/core/coach.js';

const w1d1 = findWorkout('w1d1'); // walk 6, jog 2, walk 6, jog 2, run 5 (min); half = 10.5 min
const w4d2 = findWorkout('w4d2'); // 5/2/5/2/5/2/5 (min); half = 13 min

describe('coachExtras', () => {
  it('adds nothing in commands style', () => {
    for (let i = 0; i < w1d1.phases.length; i++) expect(coachExtras(w1d1, i, 'commands')).toEqual([]);
  });

  it('adds a line for the phase type in intense style', () => {
    expect(coachExtras(w1d1, 0, 'intense')).toEqual(['coach.walk']);
    expect(coachExtras(w1d1, 1, 'intense')).toEqual(['coach.jog']);
  });

  it('marks the first phase starting at or past half the workout', () => {
    // w1d1 starts: 0, 6, 8, 14, 16 min → phase 3 is the first at/after 10.5.
    expect(coachExtras(w1d1, 2, 'intense')).toEqual(['coach.walk']);
    expect(coachExtras(w1d1, 3, 'intense')).toEqual(['coach.jog', 'coach.halfway']);
    // w4d2 starts: 0, 5, 7, 12, 14, 19, 21 → phase 4.
    expect(coachExtras(w4d2, 3, 'intense')).toEqual(['coach.jog']);
    expect(coachExtras(w4d2, 4, 'intense')).toEqual(['coach.walk', 'coach.halfway']);
    expect(coachExtras(w4d2, 5, 'intense')).toEqual(['coach.jog']);
  });

  it('announces the last phase', () => {
    expect(coachExtras(w1d1, 4, 'intense')).toEqual(['coach.run', 'coach.last']);
  });

  it('says only "last" when the halfway phase is also the last one', () => {
    const workout = { id: 'x', week: 1, day: 1, phases: [{ type: 'walk', seconds: 600 }, { type: 'run', seconds: 60 }] };
    expect(coachExtras(workout, 1, 'intense')).toEqual(['coach.run', 'coach.last']);
  });

  it('never says halfway on the first phase', () => {
    const single = { id: 'y', week: 1, day: 1, phases: [{ type: 'jog', seconds: 60 }] };
    expect(coachExtras(single, 0, 'intense')).toEqual(['coach.jog', 'coach.last']);
    expect(coachExtras(w1d1, 0, 'intense')).not.toContain('coach.halfway');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/coach.test.js`
Expected: FAIL — cannot resolve `../../src/core/coach.js`.

- [ ] **Step 3: Write the implementation**

`src/core/coach.js`:

```js
import { phaseBoundaries } from './timer.js';

/**
 * Extra lines the voice coach says after the phase command ("Walk for 5
 * minutes"), as i18n keys in speaking order.
 * @param {import('./plan.js').Workout} workout
 * @param {number} phaseIndex
 * @param {'commands' | 'intense'} style
 * @returns {string[]}
 */
export function coachExtras(workout, phaseIndex, style) {
  if (style !== 'intense') return [];
  const keys = [`coach.${workout.phases[phaseIndex].type}`];
  const bounds = phaseBoundaries(workout);
  const halfMs = bounds.at(-1).endMs / 2;
  const isLast = phaseIndex === bounds.length - 1;
  const firstPastHalf = phaseIndex > 0
    && bounds[phaseIndex].startMs >= halfMs
    && bounds[phaseIndex - 1].startMs < halfMs;
  if (isLast) keys.push('coach.last');
  else if (firstPastHalf) keys.push('coach.halfway');
  return keys;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/coach.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/coach.js tests/core/coach.test.js
git commit -m "feat: add intense coach lines for halfway and last phase"
```

---

### Task 4: Settings storage v2 with migration

**Files:**
- Modify: `src/platform/storage.js`
- Test: `tests/platform/storage.test.js` (replace the three settings tests at the end)

**Interfaces:**
- Consumes: `DEFAULT_AUDIO_SETTINGS`, `normalizeAudioSettings` from `src/core/audioSettings.js`.
- Produces: `storage.loadSettings(): AudioSettings`, `storage.saveSettings(settings: AudioSettings): void` (writes `{ version: 2, data }`). Other keys unchanged (version 1).

- [ ] **Step 1: Write the failing test**

In `tests/platform/storage.test.js`, add the import:

```js
import { DEFAULT_AUDIO_SETTINGS } from '../../src/core/audioSettings.js';
```

Delete the three tests `'round-trips settings in a version envelope'`, `'defaults settings to unmuted when missing, stale or malformed'` and `'never throws on settings with a broken backend'`, and add inside the `describe('createStorage', ...)` block:

```js
  const audio = { volume: 60, beeps: false, voice: true, voiceStyle: 'intense', fanfare: false };
  const settingsEntry = (version, data) => ({ [STORAGE_KEYS.settings]: JSON.stringify({ version, data }) });

  it('round-trips audio settings in a version 2 envelope', () => {
    const backend = fakeBackend();
    const storage = createStorage(backend);
    storage.saveSettings(audio);
    expect(storage.loadSettings()).toEqual(audio);
    expect(JSON.parse(backend.data.get('runningAssistant.settings'))).toEqual({ version: 2, data: audio });
  });

  it('keeps other keys on version 1', () => {
    const backend = fakeBackend();
    const storage = createStorage(backend);
    storage.saveSettings(audio);
    storage.saveLang('pt');
    expect(JSON.parse(backend.data.get('runningAssistant.lang')).version).toBe(1);
  });

  it('migrates version 1 { muted } settings', () => {
    expect(createStorage(fakeBackend(settingsEntry(1, { muted: true }))).loadSettings())
      .toEqual({ ...DEFAULT_AUDIO_SETTINGS, volume: 0 });
    expect(createStorage(fakeBackend(settingsEntry(1, { muted: false }))).loadSettings())
      .toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('defaults audio settings when missing, unknown version or malformed', () => {
    expect(createStorage(fakeBackend()).loadSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(createStorage(fakeBackend(settingsEntry(99, audio))).loadSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(createStorage(fakeBackend(settingsEntry(1, { muted: 'yes' }))).loadSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(createStorage(fakeBackend(settingsEntry(2, 'loud'))).loadSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(createStorage(fakeBackend({ [STORAGE_KEYS.settings]: '{oops' })).loadSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('repairs partial or out-of-range version 2 settings', () => {
    expect(createStorage(fakeBackend(settingsEntry(2, { volume: 150, voiceStyle: 'shouty' }))).loadSettings())
      .toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(createStorage(fakeBackend(settingsEntry(2, { volume: -3, voice: false }))).loadSettings())
      .toEqual({ ...DEFAULT_AUDIO_SETTINGS, volume: 0, voice: false });
  });

  it('returns a fresh settings object each time', () => {
    const storage = createStorage(fakeBackend());
    const first = storage.loadSettings();
    first.volume = 5;
    expect(storage.loadSettings().volume).toBe(100);
  });

  it('never throws on settings with a broken backend', () => {
    const storage = createStorage(throwingBackend);
    expect(() => storage.saveSettings(audio)).not.toThrow();
    expect(storage.loadSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/platform/storage.test.js`
Expected: FAIL — settings round-trip returns `{ muted: false }` / envelope version 1.

- [ ] **Step 3: Write the implementation**

In `src/platform/storage.js`:

Add after the first import:

```js
import { DEFAULT_AUDIO_SETTINGS, normalizeAudioSettings } from '../core/audioSettings.js';
```

Replace `const VERSION = 1;` with:

```js
const VERSION = 1;
// v1 stored { muted }; v2 stores AudioSettings.
const SETTINGS_VERSION = 2;
```

Replace `const isSettings = ...` with:

```js
/** v1 → v2: a muted app starts at volume 0, otherwise at full volume. */
function migrateSettings(version, data) {
  if (version === 1 && isObject(data) && typeof data.muted === 'boolean') {
    return { ...DEFAULT_AUDIO_SETTINGS, volume: data.muted ? 0 : 100 };
  }
  return undefined;
}
```

Replace `read` and `write` inside `createStorage` with:

```js
  /**
   * @param {{ version?: number, migrate?: (version: unknown, data: unknown) => unknown }} [options]
   *   migrate: turns data saved under an older version into the current shape.
   */
  function read(key, isValid, fallback, { version = VERSION, migrate } = {}) {
    try {
      const raw = backend?.getItem(key);
      if (raw == null) return fallback;
      const envelope = JSON.parse(raw);
      const data = envelope?.version === version ? envelope.data : migrate?.(envelope?.version, envelope?.data);
      return isValid(data) ? data : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, data, version = VERSION) {
    try {
      backend?.setItem(key, JSON.stringify({ version, data }));
    } catch {
      // Storage full or blocked: the app keeps working without persistence.
    }
  }
```

Replace the `loadSettings` / `saveSettings` entries in the returned object with:

```js
    loadSettings: () => normalizeAudioSettings(
      read(STORAGE_KEYS.settings, isObject, null, { version: SETTINGS_VERSION, migrate: migrateSettings }),
    ),
    saveSettings: (settings) => write(STORAGE_KEYS.settings, settings, SETTINGS_VERSION),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/platform/storage.test.js`
Expected: PASS (all storage tests, including the untouched ones).

- [ ] **Step 5: Commit**

```bash
git add src/platform/storage.js tests/platform/storage.test.js
git commit -m "feat: store audio settings as version 2 and migrate muted flag"
```

---

### Task 5: Translations for the sheet and coach

**Files:**
- Modify: `src/i18n/pt.js`, `src/i18n/en.js`, `src/i18n/es.js`
- Test: `tests/i18n/i18n.test.js` (append)

**Interfaces:**
- Consumes: `VOLUME_PRESETS` from Task 1; the key list from Task 3.
- Produces keys used by Tasks 6 and 7: `header.audio`, `audio.title`, `audio.subtitle`, `audio.close`, `audio.master`, `audio.level.{off,low,normal,high}`, `audio.preset.{0,50,80,100}`, `audio.section`, `audio.beeps`, `audio.beepsHint`, `audio.voice`, `audio.voiceHint`, `audio.styleLabel`, `audio.style.intense`, `audio.style.commands`, `audio.fanfare`, `audio.fanfareHint`, `audio.test`, `audio.testPhrase`, `audio.save`, `coach.walk`, `coach.jog`, `coach.run`, `coach.halfway`, `coach.last`, `run.beepsOnly`. (`audio.sliderLabel` from the spec is dropped: the slider reuses `audio.master`. `run.beepsOnly` is added so the run chip is honest when voice is off.) `header.mute`/`header.unmute` are removed in Task 6, not here.

- [ ] **Step 1: Write the failing test**

Append to `tests/i18n/i18n.test.js` (add `import { VOLUME_PRESETS, VOICE_STYLES } from '../../src/core/audioSettings.js';` at the top):

```js
describe('audio sheet and coach texts', () => {
  const keys = [
    'header.audio', 'audio.title', 'audio.subtitle', 'audio.close', 'audio.master',
    'audio.section', 'audio.beeps', 'audio.beepsHint', 'audio.voice', 'audio.voiceHint',
    'audio.styleLabel', 'audio.fanfare', 'audio.fanfareHint', 'audio.test', 'audio.testPhrase',
    'audio.save', 'run.beepsOnly',
    ...['off', 'low', 'normal', 'high'].map((level) => `audio.level.${level}`),
    ...VOLUME_PRESETS.map((preset) => `audio.preset.${preset}`),
    ...VOICE_STYLES.map((style) => `audio.style.${style}`),
    ...['walk', 'jog', 'run', 'halfway', 'last'].map((line) => `coach.${line}`),
  ];

  it('exist in the default language', () => {
    for (const key of keys) expect(pt[key], key).toBeTruthy();
  });

  it('end coach lines with punctuation so they can be joined into one utterance', () => {
    for (const lang of LANGS) {
      for (const line of ['walk', 'jog', 'run', 'halfway', 'last']) {
        expect(translate(lang, `coach.${line}`)).toMatch(/[.!]$/);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/i18n/i18n.test.js`
Expected: FAIL — `header.audio` missing.

- [ ] **Step 3: Add the keys**

In each file, add these entries (keep existing entries; place `header.audio` after `header.home`, `run.beepsOnly` after `run.voiceOff`, and the `audio.*` / `coach.*` block after `cue.finish`). Also replace the `workout.voiceOff` value.

`src/i18n/pt.js`:

```js
  'header.audio': 'Áudio e volume',
  'run.beepsOnly': 'Só bips',
  'workout.voiceOff': 'Áudio desativado. Toque no alto-falante para ajustar o som.',
  'audio.title': 'Áudio & Volume',
  'audio.subtitle': 'Otimizado para fones ou alto-falante da esteira',
  'audio.close': 'Fechar',
  'audio.master': 'Volume geral',
  'audio.level.off': 'Mudo',
  'audio.level.low': 'Nível baixo',
  'audio.level.normal': 'Nível recomendado',
  'audio.level.high': 'Potência alta',
  'audio.preset.0': 'Mudo',
  'audio.preset.50': 'Médio',
  'audio.preset.80': 'Forte',
  'audio.preset.100': 'Máx',
  'audio.section': 'Sinais & voz na pista',
  'audio.beeps': 'Bips de transição',
  'audio.beepsHint': 'Contagem de 3s antes da troca',
  'audio.voice': 'Treinador por voz',
  'audio.voiceHint': 'Anuncia cada fase em voz alta',
  'audio.styleLabel': 'Estilo do treinador',
  'audio.style.intense': 'Intenso / Foco',
  'audio.style.commands': 'Só comandos',
  'audio.fanfare': 'Fanfarra de conquista',
  'audio.fanfareHint': 'Melodia ao concluir o treino',
  'audio.test': 'Testar bip & áudio',
  'audio.testPhrase': 'Teste de áudio. Bora correr!',
  'audio.save': 'Salvar & continuar',
  'coach.walk': 'Respire e recupere.',
  'coach.jog': 'Encontre seu ritmo.',
  'coach.run': 'Dá tudo agora!',
  'coach.halfway': 'Metade do treino, segue firme!',
  'coach.last': 'Última fase, termine forte!',
```

`src/i18n/en.js`:

```js
  'header.audio': 'Audio & volume',
  'run.beepsOnly': 'Beeps only',
  'workout.voiceOff': 'Audio is off. Tap the speaker to adjust sound.',
  'audio.title': 'Audio & Volume',
  'audio.subtitle': 'Tuned for headphones or the treadmill speaker',
  'audio.close': 'Close',
  'audio.master': 'Master volume',
  'audio.level.off': 'Muted',
  'audio.level.low': 'Low',
  'audio.level.normal': 'Recommended',
  'audio.level.high': 'Loud',
  'audio.preset.0': 'Mute',
  'audio.preset.50': 'Medium',
  'audio.preset.80': 'Strong',
  'audio.preset.100': 'Max',
  'audio.section': 'Signals & voice',
  'audio.beeps': 'Transition beeps',
  'audio.beepsHint': '3-second countdown before each change',
  'audio.voice': 'Voice coach',
  'audio.voiceHint': 'Announces every phase out loud',
  'audio.styleLabel': 'Coach style',
  'audio.style.intense': 'Intense / Focus',
  'audio.style.commands': 'Commands only',
  'audio.fanfare': 'Achievement fanfare',
  'audio.fanfareHint': 'Melody when you finish the workout',
  'audio.test': 'Test beep & voice',
  'audio.testPhrase': "Audio check. Let's run!",
  'audio.save': 'Save & continue',
  'coach.walk': 'Breathe and recover.',
  'coach.jog': 'Find your rhythm.',
  'coach.run': 'Give it everything!',
  'coach.halfway': 'Halfway there, keep it up!',
  'coach.last': 'Last phase, finish strong!',
```

`src/i18n/es.js`:

```js
  'header.audio': 'Audio y volumen',
  'run.beepsOnly': 'Solo pitidos',
  'workout.voiceOff': 'Audio desactivado. Toca el altavoz para ajustar el sonido.',
  'audio.title': 'Audio y volumen',
  'audio.subtitle': 'Optimizado para audífonos o el altavoz de la caminadora',
  'audio.close': 'Cerrar',
  'audio.master': 'Volumen general',
  'audio.level.off': 'Silenciado',
  'audio.level.low': 'Nivel bajo',
  'audio.level.normal': 'Nivel recomendado',
  'audio.level.high': 'Potencia alta',
  'audio.preset.0': 'Silencio',
  'audio.preset.50': 'Medio',
  'audio.preset.80': 'Fuerte',
  'audio.preset.100': 'Máx',
  'audio.section': 'Señales y voz',
  'audio.beeps': 'Pitidos de transición',
  'audio.beepsHint': 'Cuenta de 3 s antes de cada cambio',
  'audio.voice': 'Entrenador por voz',
  'audio.voiceHint': 'Anuncia cada fase en voz alta',
  'audio.styleLabel': 'Estilo del entrenador',
  'audio.style.intense': 'Intenso / Enfoque',
  'audio.style.commands': 'Solo comandos',
  'audio.fanfare': 'Fanfarria de logro',
  'audio.fanfareHint': 'Melodía al terminar el entrenamiento',
  'audio.test': 'Probar pitido y voz',
  'audio.testPhrase': 'Prueba de audio. ¡A correr!',
  'audio.save': 'Guardar y continuar',
  'coach.walk': 'Respira y recupérate.',
  'coach.jog': 'Encuentra tu ritmo.',
  'coach.run': '¡Dalo todo!',
  'coach.halfway': '¡Ya vas a la mitad, sigue así!',
  'coach.last': '¡Última fase, termina fuerte!',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all suites, including key parity).

- [ ] **Step 5: Commit**

```bash
git add src/i18n tests/i18n/i18n.test.js
git commit -m "feat: add audio sheet and coach texts in pt, en and es"
```

---

### Task 6: Volume-aware audio, speech and controller

**Files:**
- Modify: `src/platform/audio.js`, `src/platform/speech.js`
- Modify: `src/ui/controller.svelte.js`
- Modify: `src/ui/components/AppHeader.svelte`, `src/ui/RunScreen.svelte:23-24`, `src/ui/WorkoutScreen.svelte:81-83`
- Modify: `src/i18n/pt.js`, `en.js`, `es.js` (remove `header.mute`, `header.unmute`)

No unit tests: platform audio/speech and the controller are verified manually (AGENTS.md). Gate is `npm test` + `npm run build`.

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces (used by Task 7):
  - `app.settings: AudioSettings`, `app.audioSheetOpen: boolean` (`app.muted` is removed)
  - `openAudioSheet(): void`, `closeAudioSheet(): void`
  - `setAudio(patch: Partial<AudioSettings>): void`
  - `testAudio(): void`
  - `audioMuted(): boolean`, `volumeIcon(): 'speaker-off' | 'speaker-low' | 'speaker'`, `volumeLabel(): string`, `voiceTag(): string`
  - re-export `VOLUME_PRESETS`, `VOICE_STYLES`
  - `createCuePlayer().start(session, workout, now, settings: AudioSettings): boolean`, `createCuePlayer().test(volume: number): boolean`
  - `speak(text, locales, { volume }?)`

- [ ] **Step 1: Update `src/platform/audio.js`**

Change the import:

```js
import { upcomingCues, filterCues } from '../core/cues.js';
import { DEFAULT_AUDIO_SETTINGS } from '../core/audioSettings.js';
```

Replace `const VOLUME = 0.95;` with:

```js
// Gain at 100% volume; the master volume scales it down linearly.
const MAX_GAIN = 0.95;
const gainFor = (volume) => MAX_GAIN * Math.min(100, Math.max(0, volume)) / 100;
// Countdown sound played by the audio test.
const TEST_TONES = [...TONES.pip, ...TONES.pip.map((n) => ({ ...n, at: n.at + 0.4 })), ...TONES.lastPip.map((n) => ({ ...n, at: n.at + 0.8 }))];
```

(Place `TEST_TONES` after the `TONES` definition.)

Replace `note()`:

```js
  function note(freq, startAt, dur, level) {
    const { osc, gain } = oscillator(freq, 0, WAVE);
    // Short ramps avoid clicks at note start and end.
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(level, startAt + 0.01);
    gain.gain.setValueAtTime(level, startAt + dur - 0.02);
    gain.gain.linearRampToValueAtTime(0, startAt + dur);
    osc.start(startAt);
    osc.stop(startAt + dur);
  }

  function ensureContext() {
    ctx ??= new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
```

Replace `start()` and add `test()`:

```js
  /**
   * Schedules every upcoming cue the settings allow. The keep-alive tone
   * always runs, even when muted, so the tab is not throttled.
   * @param {import('../core/audioSettings.js').AudioSettings} [settings]
   */
  function start(session, workout, now, settings = DEFAULT_AUDIO_SETTINGS) {
    if (!AudioContextClass) return false;
    try {
      stop();
      ensureContext();
      const base = ctx.currentTime;
      const level = gainFor(settings.volume);
      for (const cue of filterCues(upcomingCues(session, workout, now), settings)) {
        for (const n of TONES[cue.kind]) note(n.freq, base + cue.inMs / 1000 + n.at, n.dur, level);
      }
      oscillator(KEEP_ALIVE_FREQ, KEEP_ALIVE_VOLUME).osc.start(base);
      return true;
    } catch {
      return false;
    }
  }

  /** Plays a short countdown now at the given volume. Call from a user gesture. */
  function test(volume) {
    if (!AudioContextClass) return false;
    try {
      ensureContext();
      const level = gainFor(volume);
      if (level > 0) {
        const base = ctx.currentTime + 0.05;
        for (const n of TEST_TONES) note(n.freq, base + n.at, n.dur, level);
      }
      return true;
    } catch {
      return false;
    }
  }

  return { supported: Boolean(AudioContextClass), start, stop, test };
```

- [ ] **Step 2: Update `src/platform/speech.js`**

Change `speak`'s signature and JSDoc:

```js
/**
 * Speaks a cue when the page is visible. In the background, browsers may
 * hold speech back, so the pre-scheduled beeps are the reliable cue there.
 * @param {string} text
 * @param {string[]} locales preferred voice locales, best first
 * @param {{ volume?: number }} [options] volume 0–100
 */
export function speak(text, locales, { volume = 100 } = {}) {
```

and, after `utterance.rate = SPEECH_RATE;`, add:

```js
  utterance.volume = Math.min(100, Math.max(0, volume)) / 100;
```

- [ ] **Step 3: Update `src/ui/controller.svelte.js`**

Add imports:

```js
import { normalizeAudioSettings, isMuted, volumeLevel } from '../core/audioSettings.js';
import { coachExtras } from '../core/coach.js';
```

and below the imports:

```js
export { VOLUME_PRESETS, VOICE_STYLES } from '../core/audioSettings.js';
```

In `app`, replace `muted: storage.loadSettings().muted,` with:

```js
  settings: storage.loadSettings(),
  audioSheetOpen: false,
```

Replace `toggleMute()` with:

```js
export function openAudioSheet() {
  app.audioSheetOpen = true;
}

export function closeAudioSheet() {
  app.audioSheetOpen = false;
}

/** Applies and saves audio settings; called from taps and slider input (user gestures). */
export function setAudio(patch) {
  app.settings = normalizeAudioSettings({ ...$state.snapshot(app.settings), ...patch });
  storage.saveSettings($state.snapshot(app.settings));
  if (!canSpeak()) cancelSpeech();
  // Re-schedule so the change applies now.
  if (app.session) {
    cuePlayer.stop();
    if (app.session.pausedAt === null) playCues();
  }
}

export function testAudio() {
  cuePlayer.test(app.settings.volume);
  say(t('audio.testPhrase'));
}

export function audioMuted() {
  return isMuted(app.settings);
}

export function volumeIcon() {
  const level = volumeLevel(app.settings.volume);
  if (level === 'off') return 'speaker-off';
  return level === 'low' ? 'speaker-low' : 'speaker';
}

export function volumeLabel() {
  return t(`audio.level.${volumeLevel(app.settings.volume)}`);
}

/** Voice language tag shown next to the voice coach, e.g. "PT-BR". */
export function voiceTag() {
  return LOCALES[app.lang].toUpperCase();
}
```

Replace `playCues()`:

```js
function playCues() {
  app.audioAvailable = cuePlayer.start(
    $state.snapshot(app.session), currentWorkout(), Date.now(), $state.snapshot(app.settings),
  );
}
```

In `tick()`, change the announce call to pass the index:

```js
    announcePhase(workout, state.phaseIndex, state.phaseRemainingMs);
```

Replace `announcePhase()` and add `canSpeak()` / `say()`:

```js
function announcePhase(workout, phaseIndex, remainingMs) {
  const phase = workout.phases[phaseIndex];
  const command = t('cue.phase', {
    phase: t(`phase.${phase.type}`),
    duration: formatDuration(Math.round(remainingMs / 1000), app.lang),
  });
  const extras = coachExtras(workout, phaseIndex, app.settings.voiceStyle).map((key) => t(key));
  say(extras.length ? `${command}. ${extras.join(' ')}` : command);
}

function canSpeak() {
  return app.settings.voice && !isMuted(app.settings);
}

function say(text) {
  if (!canSpeak()) return;
  speak(text, VOICE_LOCALES[app.lang], { volume: app.settings.volume });
}
```

In `finish()`, replace `if (!app.muted) speak(t('cue.finish'), VOICE_LOCALES[app.lang]);` with:

```js
  say(t('cue.finish'));
```

Confirm no `app.muted` or `toggleMute` remain: `grep -rn "app.muted\|toggleMute" src` must print nothing after Step 4.

- [ ] **Step 4: Update the components**

`src/ui/components/AppHeader.svelte` — change the controller import to:

```js
  import { app, t, setLang, goHome, openAudioSheet, audioMuted, volumeIcon } from '../controller.svelte.js';
```

Replace the speaker button with:

```svelte
  <button
    class="icon-btn"
    class:muted={audioMuted()}
    onclick={openAudioSheet}
    aria-haspopup="dialog"
    aria-label={t('header.audio')}
  >
    <Icon name={volumeIcon()} />
  </button>
```

`src/ui/RunScreen.svelte` — import `audioMuted` from the controller (add it to the existing controller import) and replace the chip (lines 23–25) with:

```svelte
      <span class="chip" class:on={!audioMuted()}>
        <Icon name={audioMuted() ? 'speaker-off' : 'speaker'} size={14} />{t(audioMuted() ? 'run.voiceOff' : app.settings.voice ? 'run.voiceOn' : 'run.beepsOnly')}
      </span>
```

(Keep whatever closing tag the original chip had; only the class/icon/text expressions change.)

`src/ui/WorkoutScreen.svelte` — import `audioMuted` and replace lines 81–83:

```svelte
  <section class="card note" class:off={audioMuted()}>
    <span class="note-icon"><Icon name={audioMuted() ? 'speaker-off' : 'speaker'} size={20} /></span>
    <p>{t(audioMuted() ? 'workout.voiceOff' : 'workout.voiceOn')}</p>
```

- [ ] **Step 5: Remove the obsolete keys**

Delete `'header.mute'` and `'header.unmute'` lines from `src/i18n/pt.js`, `en.js` and `es.js`. Run `grep -rn "header.mute\|header.unmute" src` — expect no output.

- [ ] **Step 6: Verify**

Run: `npm test` — Expected: all PASS.
Run: `npm run build` — Expected: build succeeds, no Svelte errors.

- [ ] **Step 7: Commit**

```bash
git add src tests
git commit -m "feat: apply volume, beeps, voice and coach style to cues and speech"
```

---

### Task 7: Audio & Volume sheet UI

**Files:**
- Modify: `src/ui/components/Icon.svelte` (add paths)
- Create: `src/ui/components/Switch.svelte`
- Create: `src/ui/components/AudioSheet.svelte`
- Modify: `src/ui/App.svelte`

**Interfaces:**
- Consumes (Task 6): `app.settings`, `app.audioSheetOpen`, `t`, `setAudio`, `testAudio`, `closeAudioSheet`, `volumeIcon`, `volumeLabel`, `voiceTag`, `VOLUME_PRESETS`, `VOICE_STYLES`.
- Produces: `<Switch checked label onchange />` (`onchange(next: boolean)`), `<AudioSheet />`.

- [ ] **Step 1: Add icons**

In `PATHS` of `src/ui/components/Icon.svelte`, add:

```js
    'speaker-low': ['M4 9h4l5-4v14l-5-4H4z', 'M16.5 9a4 4 0 0 1 0 6'],
    tune: ['M4 7h9', 'M17 7h3', 'M15 5v4', 'M4 17h3', 'M11 17h9', 'M9 15v4'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    voice: ['M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M3 20a6 6 0 0 1 12 0', 'M17 6a4 4 0 0 1 0 6', 'M19.5 3.5a7.5 7.5 0 0 1 0 11'],
    medal: ['M8 3l4 7 4-7', 'M17 15a5 5 0 1 1-10 0 5 5 0 0 1 10 0z'],
    'check-circle': ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', 'M8 12.5l3 3 5-6'],
    bell: ['M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z', 'M10 21h4'],
```

- [ ] **Step 2: Create `src/ui/components/Switch.svelte`**

```svelte
<script>
  /** @type {{ checked: boolean, label: string, onchange: (next: boolean) => void }} */
  let { checked, label, onchange } = $props();
</script>

<button class="switch" class:on={checked} role="switch" aria-checked={checked} aria-label={label} onclick={() => onchange(!checked)}>
  <span class="knob"></span>
</button>

<style>
  .switch {
    flex: none;
    width: 56px;
    height: 32px;
    padding: 4px;
    display: flex;
    border-radius: 9999px;
    background: var(--surface-3);
    transition: background 0.15s;
  }
  .knob {
    width: 24px;
    height: 24px;
    border-radius: 9999px;
    background: var(--text-muted);
    transition: transform 0.15s, background 0.15s;
  }
  .switch.on { background: var(--mint); }
  .switch.on .knob { transform: translateX(24px); background: var(--on-mint); }
  @media (prefers-reduced-motion: reduce) {
    .switch, .knob { transition: none; }
  }
</style>
```

- [ ] **Step 3: Create `src/ui/components/AudioSheet.svelte`**

```svelte
<script>
  import {
    app, t, setAudio, testAudio, closeAudioSheet, volumeIcon, volumeLabel, voiceTag,
    VOLUME_PRESETS, VOICE_STYLES,
  } from '../controller.svelte.js';
  import Icon from './Icon.svelte';
  import Switch from './Switch.svelte';

  const TEST_ANIMATION_MS = 1600;
  const STYLE_ICONS = { intense: 'bolt', commands: 'bell' };

  const s = $derived(app.settings);
  let testing = $state(false);
  /** @type {HTMLButtonElement | undefined} */
  let closeButton = $state();

  $effect(() => closeButton?.focus());

  function onKeydown(event) {
    if (event.key === 'Escape') closeAudioSheet();
  }

  function runTest() {
    testAudio();
    testing = true;
    setTimeout(() => { testing = false; }, TEST_ANIMATION_MS);
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="sheet-layer">
  <button class="backdrop" tabindex="-1" aria-label={t('audio.close')} onclick={closeAudioSheet}></button>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="audio-title">
    <div class="handle" aria-hidden="true"></div>

    <header class="head">
      <div class="head-text">
        <h2 id="audio-title"><span class="head-icon"><Icon name="tune" size={20} /></span>{t('audio.title')}</h2>
        <p>{t('audio.subtitle')}</p>
      </div>
      <button class="round" bind:this={closeButton} onclick={closeAudioSheet} aria-label={t('audio.close')}>
        <Icon name="close" />
      </button>
    </header>

    <section class="panel">
      <div class="master">
        <span class="tile tone-mint"><Icon name={volumeIcon()} /></span>
        <span class="master-text">
          <span class="label">{t('audio.master')}</span>
          <span class="level">{volumeLabel()}</span>
        </span>
        <span class="readout num">{s.volume}<small>%</small></span>
      </div>
      <input
        class="slider"
        type="range"
        min="0"
        max="100"
        step="1"
        value={s.volume}
        style="--fill: {s.volume}%"
        aria-label={t('audio.master')}
        oninput={(event) => setAudio({ volume: Number(event.currentTarget.value) })}
      />
      <div class="presets">
        {#each VOLUME_PRESETS as preset (preset)}
          <button class="preset" class:active={s.volume === preset} aria-pressed={s.volume === preset} onclick={() => setAudio({ volume: preset })}>
            <span>{t(`audio.preset.${preset}`)}</span>
            <small class="num">{preset}%</small>
          </button>
        {/each}
      </div>
    </section>

    <p class="label section-label">{t('audio.section')}</p>

    <section class="row-card">
      <div class="row">
        <span class="tile tone-walk"><Icon name="timer" size={22} /></span>
        <span class="row-text">
          <strong>{t('audio.beeps')}</strong>
          <span>{t('audio.beepsHint')}</span>
        </span>
        <Switch checked={s.beeps} label={t('audio.beeps')} onchange={(beeps) => setAudio({ beeps })} />
      </div>
    </section>

    <section class="row-card">
      <div class="row">
        <span class="tile tone-mint"><Icon name="voice" size={22} /></span>
        <span class="row-text">
          <strong>{t('audio.voice')} <span class="lang-tag">{voiceTag()}</span></strong>
          <span>{t('audio.voiceHint')}</span>
        </span>
        <Switch checked={s.voice} label={t('audio.voice')} onchange={(voice) => setAudio({ voice })} />
      </div>
      <div class="styles" role="group" aria-label={t('audio.styleLabel')}>
        {#each VOICE_STYLES as style (style)}
          <button
            class="style"
            class:active={s.voiceStyle === style}
            aria-pressed={s.voiceStyle === style}
            disabled={!s.voice}
            onclick={() => setAudio({ voiceStyle: style })}
          >
            <Icon name={STYLE_ICONS[style]} size={16} />{t(`audio.style.${style}`)}
          </button>
        {/each}
      </div>
    </section>

    <section class="row-card">
      <div class="row">
        <span class="tile tone-run"><Icon name="medal" size={22} /></span>
        <span class="row-text">
          <strong>{t('audio.fanfare')}</strong>
          <span>{t('audio.fanfareHint')}</span>
        </span>
        <Switch checked={s.fanfare} label={t('audio.fanfare')} onchange={(fanfare) => setAudio({ fanfare })} />
      </div>
    </section>

    <button class="test" class:testing onclick={runTest}>
      <span class="play"><Icon name={testing ? 'check' : 'play'} size={18} /></span>
      <span class="test-label">{t('audio.test')}</span>
      <span class="waves" aria-hidden="true">
        {#each [8, 16, 12, 20, 8] as height, i (i)}<span style="--h: {height}px; --i: {i}"></span>{/each}
      </span>
    </button>

    <button class="btn btn-primary" onclick={closeAudioSheet}>
      <Icon name="check-circle" />{t('audio.save')}
    </button>
  </div>
</div>

<style>
  .sheet-layer {
    position: fixed;
    inset: 0;
    z-index: 15;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgb(12 13 18 / 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  .sheet {
    position: relative;
    width: 100%;
    max-width: 560px;
    max-height: calc(100dvh - 24px);
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
    background: var(--surface-1);
    border: 1px solid var(--surface-2);
    border-bottom: none;
    border-radius: 24px 24px 0 0;
    animation: rise 0.2s ease-out;
  }
  @keyframes rise { from { transform: translateY(24px); opacity: 0.6; } }
  .handle { align-self: center; width: 48px; height: 6px; border-radius: 9999px; background: var(--surface-3); }

  .head { display: flex; align-items: flex-start; gap: 12px; }
  .head-text { flex: 1; min-width: 0; }
  .head h2 { margin: 0; display: flex; align-items: center; gap: 6px; font-family: var(--display-font); font-size: 22px; }
  .head-icon { display: grid; color: var(--mint); }
  .head p { margin: 2px 0 0; font-size: 13px; color: var(--text-muted); }
  .round {
    flex: none;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 9999px;
    background: var(--surface-2);
  }
  .round:active { background: var(--surface-3); }

  .panel, .row-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: var(--radius);
    background: var(--surface-2);
  }
  .tile {
    flex: none;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 12px;
  }
  .tone-mint { background: var(--mint-soft); color: var(--mint); }
  .tone-walk { background: rgb(0 210 255 / 0.15); color: var(--walk); }
  .tone-run { background: rgb(255 51 75 / 0.15); color: var(--run); }

  .master { display: flex; align-items: center; gap: 10px; }
  .master-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .level { font-size: 13px; font-weight: 600; color: var(--mint); }
  .readout { font-size: 32px; font-weight: 700; color: var(--mint); }
  .readout small { font-size: 14px; margin-left: 2px; }

  .slider { width: 100%; height: 44px; margin: 0; appearance: none; -webkit-appearance: none; background: transparent; }
  .slider::-webkit-slider-runnable-track {
    height: 12px;
    border-radius: 9999px;
    background: linear-gradient(to right, var(--mint) var(--fill), var(--surface-3) var(--fill));
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 28px;
    height: 28px;
    margin-top: -8px;
    border-radius: 9999px;
    background: var(--mint);
    box-shadow: 0 0 0 6px var(--mint-soft);
  }
  .slider::-moz-range-track { height: 12px; border-radius: 9999px; background: var(--surface-3); }
  .slider::-moz-range-progress { height: 12px; border-radius: 9999px; background: var(--mint); }
  .slider::-moz-range-thumb { width: 28px; height: 28px; border: none; border-radius: 9999px; background: var(--mint); }
  .slider:focus-visible { outline: 2px solid var(--mint); outline-offset: 4px; border-radius: 8px; }

  .presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .preset {
    min-height: 52px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: var(--surface-1);
    font-family: var(--display-font);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .preset small { font-size: 11px; color: var(--text-muted); }
  .preset.active { background: var(--mint-soft); color: var(--mint); box-shadow: inset 0 0 0 1px var(--mint); }
  .preset.active small { color: var(--mint); }

  .section-label { padding: 4px 4px 0; }

  .row { display: flex; align-items: center; gap: 12px; }
  .row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .row-text strong { font-size: 17px; line-height: 1.25; }
  .row-text > span { font-size: 13px; color: var(--text-muted); }
  .lang-tag {
    display: inline-block;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    background: var(--surface-3);
    color: var(--walk);
    font-family: var(--display-font);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    vertical-align: middle;
  }

  .styles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .style {
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 8px;
    border-radius: 12px;
    background: var(--surface-1);
    color: var(--text-muted);
    font-family: var(--display-font);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .style.active { background: var(--mint-soft); color: var(--mint); box-shadow: inset 0 0 0 1px var(--mint); }
  .style:disabled { opacity: 0.4; cursor: default; }

  .test {
    min-height: 60px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 16px;
    border-radius: var(--radius);
    background: var(--surface-2);
    text-align: left;
  }
  .test:active { background: var(--surface-3); }
  .play { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 9999px; background: var(--mint); color: var(--on-mint); }
  .test-label { flex: 1; min-width: 0; font-family: var(--display-font); font-size: 15px; font-weight: 700; }
  .waves { flex: none; display: flex; align-items: center; gap: 4px; height: 24px; }
  .waves span { width: 4px; height: var(--h); border-radius: 9999px; background: var(--text-muted); }
  .testing .waves span {
    background: var(--mint);
    animation: wave 0.48s ease-in-out infinite alternate;
    animation-delay: calc(var(--i) * -0.12s);
  }
  @keyframes wave { from { height: 6px; } to { height: 22px; } }

  @media (prefers-reduced-motion: reduce) {
    .sheet { animation: none; }
    .testing .waves span { animation: none; }
  }
</style>
```

- [ ] **Step 4: Mount the sheet in `src/ui/App.svelte`**

Add the import `import AudioSheet from './components/AudioSheet.svelte';` and, before the toast line:

```svelte
  {#if app.audioSheetOpen}<AudioSheet />{/if}
```

- [ ] **Step 5: Build and test**

Run: `npm test` — Expected: all PASS.
Run: `npm run build` — Expected: success. Fix any Svelte a11y warnings the build prints for the new files.

- [ ] **Step 6: Manual check in the browser preview (360×800 and 390×844)**

Start the dev server with `preview_start` (`.claude/launch.json`), then verify:
1. Plan screen: tap the header speaker → sheet opens, close button focused, screen blurred behind.
2. Drag slider: readout, level text and header/speaker icon update live; presets highlight when volume equals 0/50/80/100; Mute → header icon `speaker-off`, workout screen shows the "audio is off" note.
3. Toggles flip with `aria-checked`; style pills disabled when voice is off.
4. "Test beep & voice": wave bars animate ~1.6 s, icon shows a check, then returns to play.
5. Close via X, backdrop tap, Escape and "Save & continue"; reload → settings persist (`localStorage['runningAssistant.settings']` is `{"version":2,...}`).
6. Start a workout, open the sheet mid-run, change volume and beeps; pause, change a setting, confirm no audio restarts while paused (`app.session.pausedAt` set); resume.
7. With intense style, skip to phase 3 of W1D1 and confirm (console or ear) the utterance "Jog for 2 minutes. Find your rhythm. Halfway there, keep it up!".
8. No horizontal scroll at 360px; nothing clipped; console has no errors.

Take a screenshot of the open sheet for the user.

- [ ] **Step 7: Commit**

```bash
git add src/ui
git commit -m "feat: add Audio & Volume sheet opened from the header speaker"
```

---

### Task 8: Final verification

- [ ] **Step 1:** Run `npm test` and `npm run build`; both must pass with output shown.
- [ ] **Step 2:** `grep -rn "app.muted\|toggleMute\|header.mute" src tests` → no output.
- [ ] **Step 3:** Report to the user: what shipped, the screenshot, and that background audio behavior still needs the real-Android manual test (README "Manual phone test"). Do not push unless asked.
