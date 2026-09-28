# Audio & Volume Sheet — Design

Date: 2026-09-28
Source mockup: `layout-target/volume/` (`screen.png`, `code.html`, `DESIGN.md`)

## Goal

Tapping the header speaker opens an "Audio & Volume" bottom sheet over the
current screen (blurred behind it). From there the runner sets a master
volume, turns countdown beeps, the voice coach and the finish fanfare on or
off independently, picks a coach style, and tests the audio. Changes apply
immediately, persist in localStorage, and take effect mid-run.

## Decisions

- The header speaker **opens the sheet**; it no longer toggles mute. Muting
  is the "Mute 0%" preset.
- **Both coach styles are built**: "Commands only" (today's behavior) and
  "Intense / Focus" (adds motivational lines).
- The mockup's **Bluetooth device row is dropped**: browsers only expose
  output device names with microphone permission.
- A web page cannot raise system volume. **100% = today's loudness** (tone
  gain 0.95, speech volume 1); lower values scale down.
- Changes are applied live. "Save & Continue" and the close button both just
  close the sheet (no draft/revert).

## 1. Settings model — `src/core/audioSettings.js` (pure)

```js
/** @typedef {{ volume: number, beeps: boolean, voice: boolean,
 *              voiceStyle: 'commands' | 'intense', fanfare: boolean }} AudioSettings */
export const DEFAULT_AUDIO_SETTINGS = { volume: 100, beeps: true, voice: true, voiceStyle: 'commands', fanfare: true };
export const VOLUME_PRESETS = [0, 50, 80, 100];
export const VOICE_STYLES = ['intense', 'commands'];
export function normalizeAudioSettings(value)  // any input → valid AudioSettings (merges over defaults, clamps volume to 0–100 integer, rejects bad types)
export function volumeLevel(volume)            // 'off' (0) | 'low' (<40) | 'normal' (<85) | 'high'
export function isMuted(settings)              // settings.volume === 0
```

"Muted" everywhere in the UI (header icon, run status chip, workout audio
line) means `isMuted(settings)`.

## 2. Cue filtering — `src/core/cues.js`

`upcomingCues()` is unchanged. New:

```js
export function filterCues(cues, settings)
```

- volume 0 → `[]`
- `beeps: false` → drops `pip` and `lastPip`
- `fanfare: false` → drops `finish`
- phase-start tones (`walk`, `jog`, `run`) always stay when volume > 0 — they
  are how phases are told apart without looking.

## 3. Coach lines — `src/core/coach.js` (pure)

```js
/** @returns {string[]} i18n keys to speak, in order, after the phase command */
export function coachExtras(workout, phaseIndex, style)
```

- `'commands'` → `[]`
- `'intense'` → `coach.<phaseType>` (walk "Breathe and recover", jog "Find
  your rhythm", run "Give it everything!"), then:
  - `coach.halfway` if this is the first phase whose start is at or past 50%
    of the workout's total time (never phase 0),
  - `coach.last` if this is the final phase (takes precedence over halfway
    when both apply).

The controller speaks `cue.phase` followed by the extras in a single
utterance, so one `speak()` call per phase change is kept.

## 4. Storage — `src/platform/storage.js`

- The settings key moves to envelope `version: 2` with data `AudioSettings`.
- `read()` gains an optional per-key `migrate(version, data)` hook. For
  settings: v1 `{ muted }` → `{ ...DEFAULT_AUDIO_SETTINGS, volume: muted ? 0 : 100 }`.
- v2 data is passed through `normalizeAudioSettings`; anything invalid or
  unknown falls back to defaults. Other keys stay on version 1. Never throws.
- API: `loadSettings()` returns `AudioSettings`; `saveSettings(settings)` writes v2.

## 5. Platform audio and speech

- `createCuePlayer().start(session, workout, now, settings)`: schedules
  `filterCues(upcomingCues(...), settings)` at gain `0.95 × volume / 100`.
  The keep-alive oscillator is always started (background throttling).
- New `createCuePlayer().test(volume)`: plays `pip` then `lastPip` right
  away; must be called from a user gesture. Returns false when audio is
  unavailable.
- `speak(text, locales, { volume = 100 } = {})` sets
  `utterance.volume = volume / 100`.

## 6. Controller — `src/ui/controller.svelte.js`

- `app.settings` (AudioSettings) replaces `app.muted`; new `app.audioSheetOpen`.
- Actions:
  - `openAudioSheet()`, `closeAudioSheet()`
  - `setAudio(patch)` — normalizes, saves; if volume becomes 0 or voice off,
    cancels speech; if a session is active: `cuePlayer.stop()` and, when not
    paused, `playCues()` (timer invariant; called from a tap/slider input).
  - `testAudio()` — `cuePlayer.test(volume)` and, if voice is on, speaks
    `audio.testPhrase` in the current language.
- `toggleMute()` is removed.
- `announcePhase` speaks only if voice on and volume > 0, with the coach
  extras appended; the finish line (`cue.finish`) follows the same rule.

## 7. UI

- `src/ui/components/AudioSheet.svelte`, rendered in `App.svelte` when
  `app.audioSheetOpen`, above every screen:
  - Overlay: `rgba(12,13,18,0.85)` + `backdrop-filter: blur(16px)`; tapping it
    closes. Escape closes. `role="dialog"`, `aria-modal`, labelled by title;
    the close button gets focus on open.
  - Sheet: bottom-anchored, width capped like the app column, rounded top,
    drag-handle bar (decorative), scrolls if taller than the viewport.
  - Header: tune icon + "Audio & Volume", subtitle, close (X) button.
  - Volume card: speaker icon (off/low/high variants), "Master volume"
    label + level text, big `NN%` readout, `<input type="range">` 0–100
    styled with mint thumb, 4 preset buttons (Mute/Medium/Strong/Max) with
    the active one highlighted when volume equals the preset.
  - Section label "Signals & voice", then three cards with `role="switch"`
    toggles: Transition beeps (timer icon, cyan), Voice coach (voice icon,
    mint, language tag PT-BR/EN/ES) with two style pills (bolt "Intense /
    Focus", bell "Commands only", disabled when voice is off), Achievement
    fanfare (medal icon, crimson tint).
  - Test card: play button "Test beep & voice" with 5 wave bars that animate
    for ~1.6 s after tapping (CSS only, respects reduced motion).
  - Primary button: check-circle "Save & Continue" → closes.
- `AppHeader.svelte`: speaker button calls `openAudioSheet`; icon is
  `speaker-off` when muted; aria-label "Audio & volume".
- New `Icon` paths: `tune`, `close`, `voice`, `medal`, `check-circle`,
  `bell`, `speaker-low`.
- Existing text updates: `workout.voiceOff` wording points to the speaker
  opening audio settings.

## 8. i18n

New keys in `pt.js`, `en.js`, `es.js` (test enforces matching keys):
`header.audio`, `audio.title`, `audio.subtitle`, `audio.close`,
`audio.master`, `audio.level.off|low|normal|high`, `audio.preset.0|50|80|100`,
`audio.sliderLabel`, `audio.section`, `audio.beeps`, `audio.beepsHint`,
`audio.voice`, `audio.voiceHint`, `audio.style.intense`,
`audio.style.commands`, `audio.fanfare`, `audio.fanfareHint`, `audio.test`,
`audio.testPhrase`, `audio.save`, `coach.walk`, `coach.jog`, `coach.run`,
`coach.halfway`, `coach.last`. `header.mute` / `header.unmute` are removed.

## 9. Testing

- Unit tests first: `tests/core/audioSettings.test.js`, `filterCues` in
  `tests/core/cues.test.js`, `tests/core/coach.test.js`, settings migration
  in `tests/platform/storage.test.js`, i18n key parity (existing test).
- Manual: browser preview at 360px (sheet layout, slider, presets, toggles,
  test button, mid-run change), then `npm test` and `npm run build`.
- Background audio behavior still requires the real-Android manual test; not
  claimed from the preview.

## Out of scope

Output device detection, per-cue volume, custom voices/rates, drag-to-dismiss.
