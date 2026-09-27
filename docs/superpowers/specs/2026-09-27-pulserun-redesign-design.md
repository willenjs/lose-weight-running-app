# PulseRun redesign — design

Date: 2026-09-27
Status: approved in brainstorming, pending written-spec review
Source material: `layout-target/` (mockups, `kinetic_performance/DESIGN.md`, `pulserun_logo/`)

## 1. Goal

Apply the "Kinetic Performance" visual language and the chosen mockup
layouts to all four screens, and rebrand the app as **PulseRun**, without
changing the timer, cue scheduling, resume logic or the 15-workout plan.

Success criteria:

- On a 360–430 px portrait phone, each screen visibly matches its chosen
  mockup variant (section 4), with no horizontal scroll and no clipped
  Portuguese strings.
- Timer, countdown and controls stay readable and hittable from the
  treadmill console (≈ 1 m): tabular numerals, buttons at least 60 px tall,
  at least 16 px between tap targets.
- Only real data is shown. No invented metrics (BPM, zones, headphones).
- `npm test` and `npm run build` pass.

### Scope

In scope (option "#2"):

- The new look and layouts, driven by real data.
- Hand-written week themes and phase roles, tips and pace chips (i18n).
- A Share button (Web Share API with a clipboard fallback).
- A real mute toggle for beeps and voice.
- The PulseRun rebrand (name, logo, manifest, title).

Out of scope (a follow-up spec, "#3"): history, streaks ("N consecutive
workouts"), the Histórico/Sobre/Ajustes bottom nav, scheduling ("Amanhã",
weekday names), BPM or heart-rate zones, and a headphone indicator. This
design leaves room for them (`StatTile`, a nav slot in the shell, and
`programStats` extensible) but ships none of them.

## 2. Decisions

| Topic | Decision |
|---|---|
| Content not backed by data | Visuals plus real data, plus cheap extras (option 2) |
| Brand | Full rebrand to PulseRun. Repo name and Pages URL unchanged |
| Phase colours | DESIGN.md: walk cyan `#00D2FF`, jog amber `#FFAB00`, run crimson `#FF334B`. Mint `#10F49C` is reserved for brand, primary actions and completion |
| Implementation | Hand-written CSS tokens plus shared Svelte components. No Tailwind, no new dependencies |
| Icons | Inline SVG `Icon` component. No icon font, no emoji phase icons |
| Speaker button | A real mute toggle, persisted |
| Variants | Plan 1, Workout detail 1 (plus "% volume" from 2), Run 1 (plus the "Next" line), Finished 2 (without the streak card) |

## 3. Foundation

### 3.1 Tokens (`src/app.css`)

The file is rewritten around CSS custom properties on `:root`:

- Surfaces: `--surface-0 #0C0D12` (canvas), `--surface-1 #14161F` (cards),
  `--surface-2 #1C1F2B` (elevated or active), `--surface-3 #25293A` (borders,
  dividers).
- Text: `--text #FFFFFF`, `--text-muted #8A91A8`.
- Brand: `--mint #10F49C`. Mint glow is `rgba(16, 244, 156, 0.25)`.
- Phases: `--walk #00D2FF`, `--jog #FFAB00`, `--run #FF334B`.
- A `.phase-walk | .phase-jog | .phase-run` class sets `--phase` to the
  matching colour. Bars, borders and glows use `var(--phase)`.
- Radii: `--radius 16px` (cards, big buttons), `--radius-sm 4px` (bar
  segments), `9999px` for pills.
- Spacing: 20 px screen margin, 16 px minimum gap between tap targets, 24 px
  card padding.
- Glow: `box-shadow: 0 0 24px -4px <colour at 25%>`.
- Primary buttons are at least 60 px tall. Tapping a button inverts it
  instantly, with no layout shift.
- Everything numeric uses `font-variant-numeric: tabular-nums`.
- Dialog backdrop: `#0C0D12` at 85% opacity with `backdrop-filter: blur(16px)`.
- The content column stays centred with `max-width: 560px`. Dark theme only.

### 3.2 Typography

- In `index.html`, the Google Fonts link loads **Space Grotesk** (500, 700)
  and **Inter** (400, 600). Oswald is removed.
- Space Grotesk is used for display text, headlines, labels and all
  numerals. Inter is used for body copy.
- Labels are uppercase, 10–12 px, with letter spacing of 0.08–0.1 em.
- Run countdown: `clamp(64px, 24vw, 96px)`, weight 700, letter spacing
  -0.03 em.

### 3.3 Icons (`src/ui/components/Icon.svelte`)

`<Icon name size? />` renders an inline SVG with a 2 px stroke and
`currentColor`. The set is: `back`, `play`, `pause`, `skip`, `stop`,
`check`, `lock`, `chevron`, `speaker`, `speaker-off`, `timer`, `flag`,
`trophy`, `share`, `bolt`, `calendar`, `walk`, `jog`, `run`. It replaces
`PhaseIcon.svelte`, which is deleted.

### 3.4 Brand

- `public/icon.svg` becomes the PulseRun logo from
  `layout-target/pulserun_logo/code.html`.
- `public/manifest.webmanifest`: `name` "PulseRun", `short_name`
  "PulseRun", `background_color` and `theme_color` `#0C0D12`.
- `index.html`: `<title>PulseRun</title>` and
  `<meta name="theme-color" content="#0C0D12">`.
- The repo name, the Pages URL and the localStorage key prefix
  (`runningAssistant.*`) stay unchanged, so existing progress survives.

## 4. Screens

### 4.1 Shared components (`src/ui/components/`)

| Component | Purpose |
|---|---|
| `AppHeader` | Optional back arrow, logo, "PulseRun" plus subtitle, a PT/EN pill, and the mute button |
| `Icon` | See 3.3 |
| `PhaseBar` | Segmented bar, one segment per phase, width proportional to seconds, coloured by type. Props: `workout`, optional `currentIndex` (finished segments at 30% alpha, current one glowing with a ▼ marker), optional `times` (show start/mid/end labels) |
| `StatTile` | Label, big tabular value, optional unit and caption, optional icon |
| `WeekAccordion` | One week: status badge, theme, subtitle, "x/3", expandable list of day rows |
| `ConfirmDialog` | Modal with title, body, and confirm/cancel buttons over the blurred backdrop |
| `ResumeDialog` | Existing dialog, restyled on top of `ConfirmDialog` styles |

Screen components keep their scoped `<style>` blocks and use only the tokens.

### 4.2 Plan (variant 1)

1. `AppHeader`, subtitle "Plano 5 Semanas" / "5-Week Plan".
2. **Progress card:** a ring showing `programStats.percent`, "Treinos feitos
   done / 15", total minutes done, and "Semana atual N de 5".
3. **Next-workout card** (mint border and glow):
   - a "Próximo treino" tag, "Semana W • Dia D" and the minutes
   - a compact `PhaseBar` with shorthand labels (W7 • J2 • …)
   - a 60 px button "▶ Iniciar SW • Dia D" that opens the Workout screen
   - with all 15 done, it becomes "Programa concluído! 🎉"
4. **Five `WeekAccordion`s:**
   - The badge is ✓ when all 3 days are done, the week number when it is
     the current week, and a lock icon when it is a later week.
   - The row shows the week theme and subtitle, plus "x/3 concluídos".
   - Expanded, it lists each day: status (✓ done, ▶ next workout, ○
     waiting), "Dia D", minutes and shorthand. Tapping a row opens that
     workout.
   - The current week starts expanded; the others start collapsed.
   - "Locked" is visual only. Every day stays tappable.
5. **Program goal card:** flag icon and one line about the week-5 goal.
6. The `ResumeDialog` shows when `app.pendingResume` is set, as today.

### 4.3 Workout detail (variant 1)

1. `AppHeader` with back, subtitle "Semana W • Dia D".
2. **Hero:** a "Semana W • Dia D" tag, "⏱ N min", the title "Treino
   Intervalado", and the week theme as a subtitle.
3. **Three `StatTile`s:** walk, jog and run minutes with "% do volume", in
   the phase colours.
4. **"Linha do treino"** `PhaseBar` with `times` (00:00, midpoint, end) and
   "N fases".
5. **Phase list:** one card per phase, showing:
   - the icon in the phase colour
   - "FASE i • {role}"
   - the phase name, large
   - the tip for that role
   - the mm:ss duration
   - the pace chip ("Ritmo leve / moderado / rápido")
6. **Treadmill tip card** (speed advice) and a **voice-coach note**, which
   shows "Áudio desativado" when muted.
7. Done workouts show "Concluído em {date}" and an Unmark button, as today.
8. A sticky bottom button "▶ Vamos começar!" calls `startWorkout` (a user
   gesture, as today).

### 4.4 Run (variant 1)

1. `AppHeader` with back (acts like Parar and asks to confirm), subtitle
   "Semana W • Dia D".
2. **Status row:** "SW • DD" chip, a voice chip (🔊 "Bips + voz" or 🔇
   "Mudo"), and a wake-lock chip ("Tela ativa") shown only while
   `app.wakeLockActive`.
3. **`PhaseBar`** with `currentIndex`, "Fase i de n" and
   "elapsed / total".
4. **Main card** (phase-coloured border and glow): phase icon and name in
   the phase colour, and the huge phase countdown. When paused, it shows
   "Pausado" and the countdown dims to 50%.
5. The line "Próximo: {phase} {mm:ss}" or "Última fase".
6. **Two `StatTile`s:** "Restante total" (mm:ss) and "Fases concluídas i de
   n".
7. The no-audio notice when `!app.audioAvailable`, as today.
8. **Control row:** Pular (small), **Pausar / Continuar** (wide, mint, 60
   px) and Parar (small, crimson outline). Parar calls `requestStop()`,
   which opens a `ConfirmDialog` ("Parar o treino?" / "Ele não será marcado
   como concluído."). Confirming calls `stop()`.

### 4.5 Finished (variant 2)

1. `AppHeader`, subtitle "Semana W • Dia D".
2. **Hero:** trophy icon with a check badge, a "Meta batida" tag, "Treino
   Concluído! 🔥" and "Semana W • Dia D finalizado com sucesso".
3. **2×2 `StatTile` grid:**
   - total time (min)
   - phases n of n
   - running time (sum of `run` phases, in min)
   - overall progress done/15
4. **Program progress bar** with "done de 15 treinos" and the percent.
5. **"Próximo passo" card:** the next workout ("Semana W • Dia D", minutes
   and shorthand). Tapping it opens that workout. With the program complete
   it shows "Programa concluído! 🎉" instead.
6. Buttons:
   - "Voltar ao plano →" (primary)
   - "Compartilhar conquista" (secondary, hidden when `share` is
     unavailable)
   - "Desmarcar conclusão deste treino" (text link, as today)

## 5. Data and logic

### 5.1 `src/core/` (pure, test-first)

`plan.js` (`PLAN` itself is unchanged):

```js
/** @returns {{ walk: number, jog: number, run: number }} seconds per type */
export function phaseSeconds(workout)

/** @returns {'warmup' | 'build' | 'recovery' | 'finale'} */
export function phaseRole(workout, index)
```

`phaseRole` rules:

- index 0 is `warmup`
- the last phase, when it is a run, is `finale`
- any other walk is `recovery`
- any jog or non-final run is `build`

`progress.js`:

```js
/** @returns {{ done: number, total: number, percent: number, doneMinutes: number, currentWeek: number }} */
export function programStats(plan, progress)
```

- `percent` is `Math.round(done / total * 100)`.
- `doneMinutes` is the sum of `totalSeconds` of the done workouts, divided
  by 60 and rounded.
- `currentWeek` is `nextWorkout(...)?.week`, or the last week when all are
  done.

### 5.2 `src/i18n/` (PT and EN, matching keys)

- `app.title` becomes "PulseRun". New key `app.subtitle`: "Plano 5
  Semanas" / "5-Week Plan".
- Week themes: `week.{1..5}.title`, `week.{1..5}.subtitle`. PT titles:
  "Adaptação", "Ritmo", "Resistência", "Blocos longos", "Consolidação",
  each with a one-line plain subtitle. EN equivalents.
- Phase roles: `role.warmup|build|recovery|finale`. Tips: `tip.warmup|build|recovery|finale`.
  Pace chips: `pace.walk|jog|run`.
- Card and tile labels, the program goal, the treadmill tip, the
  voice-coach note, the share title and text, "Copiado!", and the mute and
  wake-lock chips.
- `run.stopConfirm` is replaced by `run.stopTitle` and `run.stopBody`. The
  existing keys not listed here are kept.
- All spoken text keeps using `formatDuration` and `{duration}`.

### 5.3 `src/platform/`

`storage.js` (test-first):

- New key `runningAssistant.settings`, stored as
  `{ "version": 1, "data": { "muted": boolean } }`.
- New `loadSettings()` / `saveSettings(settings)`. It falls back to
  `{ muted: false }` on a missing key, a bad version or bad data, and never
  throws.

`audio.js`:

- `start(session, workout, now, { muted = false } = {})`. When `muted`, it
  skips scheduling cue tones and still starts the keep-alive oscillator.
- It returns the same availability boolean as today.

`wakeLock.js`:

- `createWakeLock({ onChange })`. `onChange(active)` fires when a sentinel
  is acquired, and when it is released, whether by `release()` or by the
  browser (the sentinel's `release` event).

`share.js` (new, test-first with a stubbed `navigator`):

```js
/** @returns {Promise<'shared' | 'copied' | 'unavailable'>} never rejects */
export async function share({ title, text, url })
export const canShare = () => boolean  // navigator.share or navigator.clipboard present
```

- If the user cancels the share sheet (`AbortError`), it returns `'shared'`
  and shows no toast.
- Any other error falls through to the clipboard. If that fails too, it
  returns `'unavailable'`.

### 5.4 `src/ui/controller.svelte.js`

New `app` fields:

- `muted`, loaded from `loadSettings()`
- `wakeLockActive`, set by the `onChange` callback
- `confirmingStop`
- `toast`, a string or `null`, cleared after about 2 s

New actions:

- `toggleMute()`: flips and saves `muted`. If a run is active, it calls
  `cuePlayer.stop()` and, when the run isn't paused, `playCues()` again.
  It never modifies the session.
- `playCues()` passes `{ muted: app.muted }`.
- `announcePhase()` and the finish speech return early when `app.muted`.
- `requestStop()` and `cancelStop()` toggle `confirmingStop`. The existing
  `stop()` is unchanged, and confirming clears `confirmingStop`.
- `shareResult()` calls `share()` with a localized title and text and the
  app URL. On `'copied'` it sets `toast` to "Copiado!".

Timer derivation, cue scheduling, resume and progress persistence are
otherwise untouched. Components keep calling only controller actions.

## 6. Testing and verification

Automated (written first):

- `tests/core/plan.test.js`:
  - `phaseSeconds` for w2d2 (5 phases) and w4d2 (7 phases).
  - `phaseRole` for the first walk, middle walks, jogs and the final run.
  - The existing pinned totals are unchanged.
- `tests/core/progress.test.js`: `programStats` for empty progress, partial
  progress (4 of 15 gives 27% and week 2) and complete progress (100%, last
  week).
- `tests/platform/storage.test.js`:
  - the settings round-trip
  - a missing key, a wrong version or bad data falling back
  - a backend that throws never breaking it
- `tests/platform/share.test.js`:
  - `navigator.share` succeeds, is cancelled, or fails and falls back to
    the clipboard
  - no APIs at all
  - it never rejects
- `tests/i18n/i18n.test.js`: the existing key-parity test covers the new
  keys.
- `npm test` and `npm run build` must pass before claiming completion.

Visual (browser pane at 390 px and 360 px wide, PT and EN):

- Plan with empty, partial and complete progress.
- Workout detail for a not-done and a done workout, including w4d2 (7
  phases).
- Run in walk, jog and run phases, paused, on the last phase, and with the
  stop dialog open.
- Finished with the next workout present and with the program complete.
- The resume dialog.
- Mute toggled mid-run: the icon changes and speech stops.
- No horizontal scroll. Screenshots are compared with the chosen mockups.

Manual on the user's Android phone after deploy: background beeps with mute
off, the keep-alive holding with mute on, the wake-lock chip, and the Share
sheet. Background audio is not claimed to work until tested there.

## 7. Delivery

- Work on the branch `feat/pulserun-redesign` with conventional commits.
- Merge to `main` (which deploys) only when the user says so.
- `layout-target/` stays untracked reference material. It is not shipped.
