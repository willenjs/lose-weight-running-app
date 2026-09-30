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

## Android app

The same app, wrapped with Capacitor, with cues played by a native
foreground service so voice and beeps keep time with the screen locked or
another app (e.g. YouTube) in front. Other apps' audio is ducked while a cue
plays.

Prerequisites: Android Studio 2025.2.1+ with its Android SDK. The build
script uses Android Studio's bundled JDK and the default SDK location unless
`JAVA_HOME` / `ANDROID_HOME` are set. The Gradle wrapper is 9.2.1 so it runs
on that JDK (25); keep it when `npx cap` updates the project.

```bash
npm run android:build     # debug APK: android/app/build/outputs/apk/debug/app-debug.apk
npm run android:install   # build, then install on the phone over USB
```

For `android:install`, enable Developer options and USB debugging on the
phone and accept the computer's key when prompted. Native code lives in
`android/app/src/main/java/io/github/willenjs/pulserun/coach/`. The launcher
icons in `android/app/src/main/res/mipmap-*` were resized from `assets/`
(rendered from `src/ui/logo.svg`) with `sharp`.

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

## Project layout

- `src/core/` — plan data, timer, cue schedule, progress. Pure JavaScript, no browser APIs.
- `src/platform/` — browser adapters: Web Audio, speech, wake lock, localStorage, Web Share/clipboard.
- `src/platform/native/` — the Android app's cue engine and plugin bridge.
- `android/` — Capacitor Android project, including the native coach service.
- `src/i18n/` — text resources (`pt.js` default, `en.js`).
- `src/ui/` — Svelte 5 screens; `controller.svelte.js` holds app state and actions.
- `layout-target/` — design mockups (HTML, screenshots, design notes) the UI follows.
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
