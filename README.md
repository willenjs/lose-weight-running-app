# PulseRun

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

The app is published at https://willenjs.github.io/lose-weight-running-app/ .
Every push to `main` runs `.github/workflows/deploy.yml`, which tests, builds
and force-pushes `dist/` to the `gh-pages` branch that GitHub Pages serves.
The build uses relative paths, so it also works from any other static host.

## Project layout

- `src/core/` — plan data, timer, cue schedule, progress. Pure JavaScript, no browser APIs.
- `src/platform/` — browser adapters: Web Audio, speech, wake lock, localStorage, Web Share/clipboard.
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
6. Switch away again for a few minutes, return, and confirm the next beep
   still lands exactly when the on-screen countdown reaches zero.
7. Pause, wait, resume: time continues from where it paused.
8. Reload mid-workout: the resume dialog appears and resumes correctly.
