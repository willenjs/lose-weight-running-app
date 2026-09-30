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

## Fixes found by phone testing

- 2026-09-29: the start and skip beep was dropped because the timeline was
  built a few ms after the session change (fixed in `751c3da`).
