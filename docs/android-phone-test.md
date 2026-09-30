# Android app — phone test status

Tracks the README's "Manual phone test (Android app)" on a real device.
Tests 1, 2 and 5 decide whether the Capacitor approach stays. If they fail,
the fallback is a full native rewrite (Kotlin + Compose).

Device: Xiaomi 15T Pro (HyperOS). First run: 2026-09-29.

| # | Test | Status |
|---|------|--------|
| 1 | Cues with the screen locked | Passed 2026-09-29 |
| 2 | YouTube in the foreground ducks for each cue, does not pause | Passed 2026-09-29 |
| 3 | Pause, resume, skip, language switch, then lock | Pending (skip checked only) |
| 4 | Remove from recents, reopen, resume from the dialog | Pending |
| 5 | Full 30+ minute workout with the phone locked | Pending |

## Before testing

- Settings → Apps → PulseRun → Battery saver → **No restrictions**.
  HyperOS kills background apps otherwise.
- To install over USB: Developer options → **USB debugging** and
  **Install via USB** on, then `npm run android:install`. Keep the phone
  unlocked and tap **Install** on its prompt. The USB connection drops when
  the phone locks; that does not affect the app.

## Pending tests

**3. Session changes**
1. Start Semana 1 - Dia 1. Pause, wait about 10 s, resume. Expected: the
   timer continues from where it paused; no cue is repeated.
2. Tap Pular. Expected: phase beeps, then the new phase is announced.
3. Switch the language (PT/EN/ES) mid-run. Expected: the next spoken line
   uses the new language.
4. Lock the phone through the next phase change. Expected: cues on time.

**4. App removed from recents**
1. Mid-workout, swipe PulseRun away from recents. Expected: cues keep
   playing (the service keeps running).
2. Reopen PulseRun. Tap Retomar. Expected: the timer shows the correct
   phase and time, cues continue.
3. Repeat, but tap Descartar. Expected: the notification disappears and
   no further cues play.

**5. Full workout locked (the treadmill session)**
1. Start a workout, lock the phone, play YouTube, run the whole workout.
2. Expected: every cue arrives within about a second of the phase change,
   including the finish fanfare and "Treino concluído!"; YouTube ducks each
   time; the notification disappears shortly after the finish.
3. Note any missing or late cue with the time it happened.

## Watch (Galaxy Watch8 40 mm, SM-L330)

Tracks the README's "Manual watch test". Paired through Galaxy Wearable;
the watch app is installed over Wi-Fi (`WEAR_SERIAL=<ip:port> npm run
wear:install`; pair first with Developer options → Wireless debugging →
Pair new device, `adb pair`, then `adb connect`). First run: 2026-09-30.

| # | Test | Status |
|---|------|--------|
| W1 | Phone reachable (mint dot on the idle screen) | Passed 2026-09-30 |
| W2 | Starting a run opens the watch app / chip | Passed 2026-09-30 |
| W3 | Phone locked: pause, resume, skip, stop from the watch | Passed 2026-09-30 (revisions 4→9, both services stopped) |
| W4 | Buzzes at phase changes with the watch screen off, full run | Pending |
| W5 | Always-on display during a run | Passed 2026-09-30 (label + whole minutes, grey outline) |
| W6 | Out of Bluetooth range and back mid-run | Pending |
| W7 | Kill the phone app mid-run: "Phone not reachable", resume offered | Pending |
| W8 | Watch-face chip counts down the right time (TimerPart time base) | Pending |

### Pending watch tests

- **W4:** a whole workout wearing the watch, screen off: one buzz pattern
  per phase change (Walk one long, Jog two short, Run three short, finish
  long–short–long), none missed or doubled.
- **W6:** mid-run, walk away from the phone until the watch loses it,
  then come back. Expected: the watch keeps counting and buzzing; watch
  commands show "Celular fora de alcance" while away; it catches up after.
- **W7:** mid-run, swipe PulseRun away on the phone and force-stop it.
  Expected: a watch command shows "Celular fora de alcance"; reopening the
  phone app offers to resume; tapping Descartar ends the run on the watch
  too (chip gone).
- **W8:** during a run, look at the PulseRun chip on the watch face. If its
  countdown is wrong, switch `phaseEndTimeZero` in
  `android/wear/.../WorkoutService.kt` from `SystemClock.elapsedRealtime()`
  to `System.currentTimeMillis()`.
- Also check on the 40 mm screen: "Celular fora de alcance" does not
  overlap the Pause button; a paused run left 2 h ends on the watch too.

## Fixes found by phone testing

- 2026-09-29: the start and skip beep was dropped because the timeline was
  built a few ms after the session change (fixed in `751c3da`).
