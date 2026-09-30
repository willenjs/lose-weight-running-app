# Wear OS Companion — Design

Date: 2026-09-30

## Goal

A PulseRun app on the watch that follows a run started on the phone: the
current phase and countdown at a glance, a wrist buzz at each phase change,
and Pause / Resume / Skip / Stop from the watch. It must work with the phone
locked in a pocket, which is when the watch is used.

## Decisions

- **Companion, not standalone.** The phone keeps running the coach (voice,
  tones, audio ducking). The watch shows the run and sends commands. Starting
  a run from the watch, a phone-free watch coach, heart rate / Health
  Services, tiles, complications and speech on the watch are out of scope.
- **Target device:** Galaxy Watch8 40 mm (SM-L330, Wear OS 6, round), paired
  through Galaxy Wearable with the Xiaomi 15T Pro. Layouts scale up to larger
  round watches.
- **Why a watch app at all:** tested on 2026-09-29, the phone's ongoing
  foreground notification is not bridged to the watch (normal notifications
  are), and the Ongoing Activity API only works from a watch app.
- **Native watch app in Kotlin + Compose for Wear OS.** Wear OS has no
  WebView, so the Svelte UI cannot run there. The phone's native code stays
  Java.
- **The phone's `CoachService` owns the run session** while a run is active
  in the Android app, and applies pause / resume / skip / stop itself, so
  watch commands work while the WebView's JavaScript is asleep. It uses a
  schedule JavaScript builds once, in workout time; no plan, timer or cue
  logic is ported to Java or Kotlin, only the session arithmetic of
  `timer.js`.
- **Sideloaded debug builds**, same app id and (debug) signing key as the
  phone app. No Play Store.

## 1. Components

```
Phone (existing APK)                                 Watch (new APK)
┌──────────────────────────────┐                     ┌──────────────────────────┐
│ Svelte app (WebView)         │                     │ PulseRun Watch (Kotlin)  │
│  controller ──► Coach plugin │                     │  WorkoutService (fg)     │
│        ▲  events  │          │                     │   ├ run state            │
│        └──────────┤          │    Data Layer       │   ├ haptics at phases    │
│                   ▼          │  /pulserun/run ───► │   └ Ongoing Activity     │
│ CoachService (owns the run)  │                     │  MainActivity (Compose)  │
│  ├ Session + revision        │ ◄── /pulserun/      │   run pages, paused,     │
│  ├ schedules tones + speech  │      command        │   stop confirm, done,    │
│  └ WatchLink                 │                     │   idle, ambient          │
└──────────────────────────────┘                     └──────────────────────────┘
```

| Unit | Where | Job |
|---|---|---|
| `workoutSchedule()` | `src/core/timeline.js` | Every tone and phase line of a workout, as ms since workout start |
| Payload builder | `src/platform/native/payload.js` | Session, schedule, phases, translated watch labels |
| Reconcile | `src/platform/native/` (pure) | Decide what JS does with a state reported by the service |
| Native engine | `src/platform/native/nativeCueEngine.js` | Send every session change; expose `current()` and state events |
| `CoachService` | `android/app/.../coach/` | Holds session + revision, schedules cues, applies commands, persists state |
| `SessionMath` | `android/app/.../coach/` | Pure Java port of `elapsedMs`, pause, resume, skip |
| `WatchLink` | `android/app/.../coach/` | Publishes run state to the watch |
| `CommandListenerService` | `android/app/.../coach/` | Receives watch commands, forwards to `CoachService` |
| `android/wear/` | new Gradle module | The watch app (below) |

## 2. Workout-time schedule (`src/core/`, test-first)

```js
/** Every event of the workout, `inMs` measured from the workout start. */
export function workoutSchedule(workout, settings) // → TimelineEvent[]
```

It is `buildTimeline(startSession(workout.id, 0), workout, 0, settings,
{ announceCurrent: true })`: at elapsed 0 each `inMs` is the event's position
in workout time, and `announceCurrent` includes the first phase's line.
`buildTimeline` and the web engine are unchanged.

What the service plays after any change, with `elapsed` from the session:

- every event (tone or speech) with `atMs ≥ elapsed − DUE_GRACE_MS` (250 ms,
  as `upcomingCues`), so a phase line at a skip boundary survives the few ms
  the payload takes to reach the service,
- nothing while paused or finished.

This matches today's app exactly: a fresh start plays the first phase line; a
skip lands on a phase boundary whose line is in the schedule; resume after an
in-app pause speaks nothing (today `resume()` does not announce). The one
case JS announces mid-phase (resume from the reload dialog, a late start after
the permission prompt) sends a one-off `announce` line with the start.

## 3. Phone: session ownership and sync

### Payload (JS → service, on every JS-side change)

```js
{
  session: { workoutId, startedAt, pausedAt, pausedTotalMs, skippedMs },
  phases: [{ type, startMs, endMs }],
  schedule: [{ type: 'tone', atMs, tone, volume } | { type: 'speech', atMs, text, volume }],
  announce: { text, volume } | null,
  locales: [...],
  notification: { channel, title, text, pausedText },
  watch: { title, labels: { walk, jog, run, paused, next, remainingTotal,
           pause, resume, skip, stop, stopTitle, stopBody, stopKeep, done,
           idle, unreachable } },
}
```

`next` keeps its `{phase}` and `{time}` placeholders and the watch fills
them. All watch text reuses existing i18n keys (`run.*`, `cue.finish`,
`common.weekDay`) plus two new keys, `watch.idle` ("Start a workout on your
phone") and `watch.unreachable` ("Phone not reachable"), added to `pt.js`,
`en.js` and `es.js`.

Timestamps are epoch ms. The service computes elapsed with
`System.currentTimeMillis()` and schedules on the uptime clock
(`uptimeNow + atMs − elapsed`), so the old `sentAt` lag correction goes away.

### Rules

- **The service is authoritative** while a run is active. Every accepted
  change (a JS payload, a watch command, the finish) increments `revision`.
  `runId` is `session.startedAt`.
- **Phone buttons:** JS computes the new session with the core functions (the
  screen updates at once) and sends the payload. Pause sends the paused
  session instead of calling `stop()`: the service stays in the foreground,
  schedules nothing, the notification says "Paused", and the watch shows
  Paused. Stop sends `stop({ reason: 'stopped' })`. A JS payload always wins
  (it is the user's direct action).
- **Watch buttons:** the watch sends `{ runId, action, basedOn }`, `action` in
  `pause | resume | skip | stop`. The service ignores it when `runId` differs
  or `basedOn` is not the current revision (a double-tap on Skip cannot skip
  two phases), otherwise applies `SessionMath` and reschedules.
- **Service → JS:** a plugin event `stateChanged { runId, revision, session,
  ended }`, `ended` in `null | 'stopped' | 'finished'`. Because events are
  lost while the WebView sleeps, JS also calls `plugin.current()` on app start
  and on every return to the foreground. Reconcile (pure, tested):
  - different `runId` than JS's run, or no state: ignore;
  - `ended: 'stopped'` → end the run, go to the workout screen;
  - `ended: 'finished'` → the normal finish (marks the workout done; progress
    stays owned by JS);
  - `revision` newer than JS's → adopt the session and save it.
- **Persistence:** the service writes `{ runId, revision, session, ended,
  phases, watch }` to SharedPreferences on every change; `current()` reads it.
- **Lifetime:** the service stops itself about 5 s after the finish or a
  stop. While paused it stays in the foreground (no wake lock) until the
  session is older than `RESUME_MAX_AGE_MS` (2 h), then stops, leaving the
  saved session for JS's resume dialog as today.
- **Invariants kept:** state is derived from the four timestamps; nothing
  counts ticks; every session change stops and reschedules the cues.
- **Web build:** unchanged. The web engine keeps its current paths.

## 4. Phone ↔ watch link (Data Layer)

- **Phone → watch:** one DataItem at `/pulserun/run`, sent urgent on every
  change: `{ runId, revision, session, ended, phases, watch }` as JSON (a few
  KB). The Data Layer keeps the latest item and delivers it when the watch
  connects, so the watch catches up after being out of range or rebooting.
- **Watch → phone:** MessageClient to the node advertising the
  `pulserun_phone` capability, path `/pulserun/command`. On the phone a
  `WearableListenerService` hands it to `CoachService` (by `startService`,
  allowed because the service is already in the foreground). If no run is
  active in the service, the command is dropped.
- **Acknowledgement:** the watch treats a command as done when a DataItem
  with a newer revision arrives. If none arrives within 3 s (or the send
  fails), it shows "Phone not reachable" and keeps its own state. This covers
  a phone app killed mid-run: coaching stops on the phone as it does today,
  and reopening the app offers resume.
- **Clocks:** the watch computes elapsed from the phone's timestamps with its
  own clock. Samsung syncs the watch clock from the phone; up to ~1 s of skew
  between the phone's tone and the watch's buzz is accepted. No offset
  correction.

## 5. Watch app (`android/wear/`)

Kotlin, Compose for Wear OS (Material 3), minSdk 30, target/compile 36,
`applicationId io.github.willenjs.pulserun`. Dependencies:
`play-services-wearable`, `androidx.wear:wear-ongoing`, Wear Compose.

| Unit | Job |
|---|---|
| `RunState` (pure Kotlin) | Parse the DataItem; elapsed, phase index, phase / total remaining, next phase; the haptic plan from a state |
| `RunListenerService` | `WearableListenerService`: on `/pulserun/run` changes, update `WorkoutService` |
| `WorkoutService` | Foreground service (type `specialUse`) during a run: current state as a flow, haptics, Ongoing Activity |
| `PhoneLink` | Find the phone node by capability, send commands, 3 s ack timeout |
| `MainActivity` | Compose screens below; ambient-aware |

### Screens (mockups approved in the brainstorm)

- **Run, page 1:** pace label (in pace colour), big countdown, "Next: Walk
  1:30", Pause button (PulseRun mint) at the bottom. Outer ring = the current
  phase's progress in its pace colour: Walk `#00d2ff`, Jog `#ffab00`, Run
  `#ff334b`.
- **Overview:** a double-tap on page 1 (not on the button) swaps the ring for
  the whole workout as pace-coloured segments, finished ones dimmed, a white
  dot at the current position; the line below becomes total time left. The
  choice is remembered across runs.
- **Page 2 (swipe left):** Skip phase and Stop run.
- **Paused:** always the overview, clock greyed, Resume button.
- **Stop confirm:** "Stop the workout? It will not be marked as completed."
  with Keep going / Stop, as on the phone.
- **Finished:** the `cue.finish` text ("Workout complete!") with the week and
  day, closes itself after ~10 s.
- **Idle:** "Start a workout on your phone" when opened with no run.
- **Ambient:** black background, thin grey outline ring, pace label and
  countdown, no buttons.

Colours and fonts follow `src/app.css` (surface `#0c0d12`, mint `#10f49c`).

### WorkoutService

- Starts when a run DataItem arrives with `ended: null`, posts the Ongoing
  Activity (pace label + countdown chip to the phase end, "Paused" when
  paused, tap opens `MainActivity`) and tries to bring `MainActivity` to the
  front. If Wear OS blocks that background launch, the fallback is the
  Ongoing Activity chip plus one start buzz.
- **Haptics** at every phase start still ahead: Walk one long pulse, Jog two
  short, Run three short, finish a long–short–long pattern. Planned from the
  state and re-planned on every update (pause clears them). A partial wake
  lock is held only while haptics are pending, so they fire with the screen
  off.
- Stops about 10 s after `ended` is set.

## 6. Error handling

| Case | Behaviour |
|---|---|
| Watch not connected at start | Phone runs as today; the watch catches up from the DataItem on reconnect |
| Watch app not installed | Nothing changes on the phone |
| Out of range mid-run | Watch keeps counting and buzzing from its last state; commands show "Phone not reachable" |
| Phone app killed mid-run | Phone coaching stops (as today); watch commands time out; reopening the phone app offers resume |
| Two quick commands | The stale `basedOn` is ignored |
| Language change mid-run | `setLang` re-sends the payload; watch labels update |
| Watch reboots mid-run | The DataItem is re-delivered; state and haptics rebuilt |
| Finish while JS is asleep | Service marks `finished`; watch shows the finish screen; JS marks the workout done on next open |
| Malformed payload or DataItem | Ignored; never crash (as `CoachService` today) |

## 7. Testing

- **vitest, test-first:** `workoutSchedule`, the payload builder (watch
  labels, `announce`), reconcile, and matching i18n keys.
- **Shared fixtures:** `tests/fixtures/session-math.json` lists sessions,
  actions and expected elapsed / sessions. vitest checks them against
  `timer.js`; JUnit checks them against `SessionMath` (phone) and `RunState`
  (watch), so the three stay in step.
- **JUnit (no device):** `SessionMath`; picking the events still ahead;
  command acceptance (`runId`, `basedOn`); `RunState` phase lookup and haptic
  plan.
- **On the devices** (added to the README's "Manual phone test"):
  1. The ping: a message round-trips phone ↔ watch (first build task; stop
     and rethink if it fails on this pairing).
  2. Starting a run opens the watch app (or the Ongoing Activity chip).
  3. Phone locked: pause, resume, skip and stop from the watch; the phone's
     cues follow each change.
  4. Buzzes arrive at phase changes with the watch screen off.
  5. Ambient display while running.
  6. Walk out of Bluetooth range and back mid-run.
  7. Kill the phone app mid-run: the watch reports "Phone not reachable".

## 8. Build and install

- `android/settings.gradle` includes `:wear`.
- npm scripts `wear:build` and `wear:install` (adb over Wi-Fi to the watch).
- Debug builds on the same PC share the debug keystore, so the phone and
  watch signatures match, which the Data Layer requires.
- `AGENTS.md`: the new commands, the Gradle unit-test command, and the rule
  that `android/wear/` is Kotlin while the phone's native code stays Java.

## Success criteria

On the Xiaomi 15T Pro + Galaxy Watch8, with the phone locked in a pocket for
a full workout: the watch shows the right phase and countdown (within ~1 s of
the phone), buzzes at every phase change, and pause / resume / skip / stop
from the watch change the phone's cues within a couple of seconds. The web
build and the phone app without a watch behave as before.
