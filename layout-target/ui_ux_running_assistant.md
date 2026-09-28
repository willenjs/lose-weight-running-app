# Running Assistant — full description of the current UI/UX

A web app (PWA), in Brazilian Portuguese by default with an English option, that guides a 5-week walk/jog/run treadmill program: 3 workouts a week, 15 in total. The app does two things: it **times the workout with audio cues** and it **keeps track of progress** on the device, with no login and no server.

Live version: https://willenjs.github.io/lose-weight-running-app/

---

## 1. Context of use (constraints the design must respect)

- **Where:** on a treadmill. The phone rests on the console, about 50–80 cm from the user's eyes, while the user is moving and often sweating.
- **How:** the user glances at the screen; they don't read it. Tap targets must be large and hard to hit by mistake.
- **Screen:** a phone in portrait orientation, typically 360–430 px wide. On desktop the content is centred with a maximum width of 560 px.
- **Background use:** the browser is often behind another app (music, video). Then **sound alone guides the workout**, which is why each phase has its own beep pattern.
- **Language:** Brazilian Portuguese by default, with a button to switch to English. Portuguese strings run longer than English ones (e.g. "Continuar: Semana 1 - Dia 1").
- **Theme:** dark only (near-black background). There is no light theme.

---

## 2. Screen map and navigation

```
            ┌──────────────────────────┐
  open ───▶ │ 1. PLAN (home)           │ ◀────────────────────┐
            │  + "Resume?" dialog      │                      │
            └───────────┬──────────────┘                      │
                        │ tap a day / "Continue"              │
                        ▼                                     │
            ┌──────────────────────────┐   "‹" back           │
            │ 2. WORKOUT (detail)      │ ─────────────────────┤
            └───────────┬──────────────┘                      │
                        │ "Vamos!" (Let's go!)                │
                        ▼                                     │
            ┌──────────────────────────┐  "Stop" (confirms)   │
            │ 3. RUN (timer)           │ ──▶ back to WORKOUT  │
            └───────────┬──────────────┘                      │
                        │ time runs out (or last phase skipped)│
                        ▼                                     │
            ┌──────────────────────────┐  "Back to plan"      │
            │ 4. WORKOUT COMPLETE      │ ─────────────────────┘
            └──────────────────────────┘
```

Screens have no URLs and don't use browser history. Screen changes happen inside the app.

---

## 3. Screens in detail

Quoted UI text is shown in Portuguese (the default) with the English version in parentheses. Section 7 lists every string in both languages.

### 3.1 Plan (home screen)

**Purpose:** show the whole program and get to the next workout in one tap.

Top to bottom:

1. **Header** (one row: title on the left, button on the right)
   - Title: **"Correndo para a perda de peso"** ("Running for weight loss"). Condensed font, mint green, ~26 px; may wrap to 2 lines.
   - Language button: **"EN"** (shows **"PT"** when in English). Small, dark grey background, rounded corners.
2. **Primary button "Continuar: Semana X - Dia Y"** ("Continue: Week X - Day Y")
   - Full width, green (#16c07c), bold white text, 12 px corners, ~56 px tall.
   - Opens the next workout not yet completed (the first one in plan order).
   - Once all 15 are done, the button disappears and centred mint-green text reads **"Programa concluído! 🎉"** ("Program complete! 🎉").
3. **List of weeks** (Week 1 to 5), each with:
   - Heading **"Semana N"** ("Week N"): condensed font, mint green, ~19 px.
   - A **grid of 3 cards** side by side (Day 1, Day 2, Day 3). Each card has:
     - "Dia N" ("Day N") in bold;
     - the total duration below it in grey (e.g. "21 min");
     - a dark grey background and 12 px corners.
   - **Card states:**
     - *Next workout:* 2 px green border.
     - *Completed:* green ✓ in the top-right corner, card at 70% opacity.
     - *Default:* no border.
   - Any card can be tapped, so workouts can be repeated or skipped.
4. **"Treino em andamento" dialog** ("Workout in progress"), shown on top only when a workout was interrupted (see 3.5).

The page scrolls vertically. With 5 weeks, the last ones sit below the fold.

### 3.2 Workout (one day's detail)

**Purpose:** show what's coming and start. The look is modelled on the original program's screens.

Top to bottom:

1. **Back button "‹"** in the top-left corner (36 px square, grey, 8 px corners).
2. **Title "Semana X - Dia Y"** ("Week X - Day Y"), centred: condensed, mint green, ~32 px.
3. **Subtitle "Correndo para a perda de peso"**, centred: condensed, mint green, ~26 px.
4. **Total duration "⏳ 21 min"**, centred, white, bold.
5. **List of phases**, one per row, separated by thin grey lines:
   - phase icon (emoji: 🚶 walk, 🏃 jog, 🔥 run);
   - name in CAPITALS ("CAMINHAR", "TROTAR", "CORRER" / "WALK", "JOG", "RUN"), ~24 px;
   - duration right-aligned, "⏱ 06:00" (tabular numbers).
   - 5 or 7 rows, depending on the workout.
6. **Completion note** (only if the workout was already done): "Concluído em 26/09/2026." ("Completed on 9/26/2026.") followed by the underlined link **"Desmarcar"** ("Unmark"), which removes the completion.
7. **Primary button "Vamos!"** ("Let's go!") pinned to the bottom of the screen: green, full width. Starts the workout.

### 3.3 Run (timer): the most important screen

**Purpose:** be readable from a distance, at a glance, while the user is moving.

**The whole screen changes colour with the phase:**

| Phase | Background colour | Label shown |
|---|---|---|
| Walk | blue `#2b5f9e` | CAMINHAR (WALK) |
| Jog | amber `#b7791f` | TROTAR (JOG) |
| Run | red `#c0392b` | CORRER (RUN) |

The colour changes with a 0.4 s fade.

Top to bottom (everything centred, white text):

1. **Small label "Semana X - Dia Y"** (85% opacity).
2. **Central block** (fills the free space, vertically centred):
   - large phase icon (emoji, ~48 px);
   - **phase name** in capitals (condensed, ~48 px);
   - **phase countdown "05:58"**: condensed, huge (80–144 px, 28% of the screen width), tabular numbers. This is the dominant element.
   - When paused: the number drops to 50% opacity and **"PAUSADO"** ("PAUSED") appears below it in spaced capitals.
3. **Next phase:** "Próximo: Trotar 02:00" ("Next: Jog 02:00"). On the last phase: "Última fase" ("Last phase").
4. **Progress bar for the whole workout:** 8 px tall, translucent dark track, white fill.
5. **Total time remaining:** "Restante: 20:58" ("Remaining: 20:58").
6. **Audio notice** (only if the browser blocks sound): a translucent dark box reading "Áudio indisponível. Acompanhe o cronômetro na tela." ("Audio unavailable. Follow the on-screen timer.")
7. **Controls** (stacked, full width, 10 px apart):
   - **"Pausar" / "Continuar"** ("Pause" / "Resume"), toggling: white button with dark text, the most prominent.
   - **"Pular fase"** ("Skip phase"): translucent dark button, white text.
   - **"Parar"** ("Stop"): translucent dark button, white text. Opens the browser's native confirmation: "Parar o treino? Ele não será marcado como concluído." ("Stop the workout? It will not be marked as completed.")

**Behaviour:**
- The screen stays on during the workout (Wake Lock) while the app is visible.
- The display refreshes 4 times a second. Time is computed from the clock, so it is correct again as soon as the user returns from the background.
- "Skip phase" jumps to the start of the next phase. If paused, it stays paused.
- Skipping the last phase ends the workout.

### 3.4 Workout complete

Everything centred vertically and horizontally:
- a large 🏁 (~64 px);
- **"Treino concluído!"** ("Workout complete!"), condensed, mint green;
- "Semana X - Dia Y";
- a green **"Voltar ao plano"** ("Back to plan") button, full width.

The workout is marked as completed automatically when this screen appears.

### 3.5 "Treino em andamento" dialog (resume)

Shown over the Plan screen when the app reopens with a workout interrupted less than 2 hours earlier (e.g. the page reloaded, or Android closed the tab).

- A dimmed backdrop (60% black) covers the screen.
- A centred card (max 400 px wide, dark grey, 16 px corners, 24 px padding) with:
  - title **"Treino em andamento"** ("Workout in progress");
  - text "Semana X - Dia Y não foi terminado." ("Week X - Day Y was not finished.");
  - green button **"Retomar"** ("Resume"): returns to the timer at the right point, still paused if it was paused;
  - dark button **"Descartar"** ("Discard").

---

## 4. Sound and voice feedback (a core part of the UX)

Sound is what guides the workout when the user isn't looking. Every sound uses a triangle wave at close to full volume and follows the phone's media volume.

| Moment | Sound |
|---|---|
| 3 s, 2 s and 1 s before each phase ends | 2 short beeps + 1 longer, higher beep (race-start style) |
| Walk starts | **2** long low beeps |
| Jog starts | **3** medium beeps |
| Run starts | **4** quick high beeps |
| Workout ends | a 4-note rising fanfare, played twice (~2.4 s) |

- **Voice** (only while the app is visible), at 1.5x speed: at the start of each phase it says, for example, "Caminhar por 6 minutos" ("Walk for 6 minutes"). At the end it says "Treino concluído!" ("Workout complete!"). When resuming mid-phase it states the time remaining.
- Nothing plays or speaks while the workout is paused.
- A redesign doesn't need to change the sounds. If you suggest changes, the rule is: **each phase must be recognisable by sound alone**.

---

## 5. Current design tokens

**Colours**

| Token | Value | Use |
|---|---|---|
| background | `#15161b` | app background |
| surface | `#23242b` | cards, secondary buttons, dialog |
| text | `#ffffff` | main text |
| muted text | `#a3a6ad` | card durations, notes |
| accent | `#7fd6a4` | headings (mint green) |
| primary | `#16c07c` | primary buttons, ✓, next-workout border |
| separator | `#34353c` | lines between phases |
| danger | `#ff6b6b` | reserved; on the timer, "Stop" uses white |
| walk | `#2b5f9e` | timer background |
| jog | `#b7791f` | timer background |
| run | `#c0392b` | timer background |

**Typography** (Google Fonts)
- Headings and large numbers: **Oswald** 500/600 (condensed).
- Body text and buttons: **Inter** 400/600.

**Shape and spacing**
- Corners: 12 px (buttons and cards), 8 px (small buttons), 16 px (dialog).
- Side margin: 16 px. Gap between cards: 10 px.
- Primary button: ~56 px tall. Secondary: ~48 px.

**Icons:** currently emoji (🚶 🏃 🔥 ⏳ ⏱ ✓ 🏁 🎉). The app icon is a green running figure on a dark background.

---

## 6. Content: the 15 workouts

W = walk, J = jog, R = run, in minutes. Every workout ends with a 5-minute run.

| Week | Day 1 | Day 2 | Day 3 |
|---|---|---|---|
| 1 | W6 J2 W6 J2 R5 (21) | W7 J2 W7 J2 R5 (23) | W7 J2 W7 J2 R5 (23) |
| 2 | W6 J2 W6 J2 R5 (21) | W7 J2 W7 J2 R5 (23) | W6 J2 W6 J2 R5 (21) |
| 3 | W9 J2 W9 J2 R5 (27) | W9 J2 W9 J2 R5 (27) | W7 J2 W7 J2 R5 (23) |
| 4 | W9 J2 W9 J2 R5 (27) | W5 J2 W5 J2 W5 J2 R5 (26) | W7 J2 W7 J3 W7 J3 R5 (34) |
| 5 | W7 J2 W7 J3 W7 J3 R5 (34) | W9 J2 W9 J2 R5 (27) | W7 J2 W7 J3 W7 J3 R5 (34) |

---

## 7. Every UI string (PT / EN)

| Where | Portuguese | English |
|---|---|---|
| App title | Correndo para a perda de peso | Running for weight loss |
| Language button | EN | PT |
| Plan primary button | Continuar: Semana {n} - Dia {n} | Continue: Week {n} - Day {n} |
| Program finished | Programa concluído! 🎉 | Program complete! 🎉 |
| Week / Day | Semana {n} / Dia {n} | Week {n} / Day {n} |
| Duration | {n} min | {n} min |
| Workout title | Semana {n} - Dia {n} | Week {n} - Day {n} |
| Start | Vamos! | Let's go! |
| Back (accessible label) | Voltar | Back |
| Completion note | Concluído em {data}. | Completed on {date}. |
| Undo completion | Desmarcar | Unmark |
| Phases | Caminhar / Trotar / Correr | Walk / Jog / Run |
| Next phase | Próximo: {fase} {tempo} | Next: {phase} {time} |
| Last phase | Última fase | Last phase |
| Time remaining | Restante: {tempo} | Remaining: {time} |
| Paused | Pausado | Paused |
| Controls | Pausar / Continuar / Pular fase / Parar | Pause / Resume / Skip phase / Stop |
| Stop confirmation | Parar o treino? Ele não será marcado como concluído. | Stop the workout? It will not be marked as completed. |
| No audio | Áudio indisponível. Acompanhe o cronômetro na tela. | Audio unavailable. Follow the on-screen timer. |
| End | Treino concluído! / Voltar ao plano | Workout complete! / Back to plan |
| Resume dialog | Treino em andamento / Semana {n} - Dia {n} não foi terminado. / Retomar / Descartar | Workout in progress / Week {n} - Day {n} was not finished. / Resume / Discard |

---

## 8. What any redesign must keep working

1. A **huge countdown** on the timer, readable from about 1 m away.
2. **Phases recognisable without reading:** a different background colour per phase (or something equally strong).
3. **One tap to the workout:** open the app → "Continue" → "Let's go!".
4. **Large buttons** on the timer, with pause as the easiest to hit.
5. **"Stop" with confirmation**, so a stray tap can't throw a workout away.
6. **Portrait phone first.** Desktop is secondary.
7. **PT and EN strings** in the same layout (Portuguese is longer).
8. **Works without login**, and keeps working without internet once loaded.

---

## 9. Current weak points (where a redesign can help)

- **Emoji icons** look different on every device and feel improvised. Custom walk, jog and run icons would be better.
- **The Plan screen is a long, flat list:** 5 weeks with no sense of overall progress (e.g. "4 of 15 workouts", a bar or ring).
- **Little celebration:** the completion screen is plain; it shows no streak, no total minutes and no next step.
- **The "Stop" confirmation** uses the browser's native dialog, which doesn't match the app's look.
- **The timer's 3 stacked buttons** take up the whole bottom of the screen. A side-by-side or icon layout could free space for the number.
- **No overview of phases on the timer:** you can't see how many phases are left (e.g. a segmented timeline in the phase colours).
- **No light theme**, which can be uncomfortable in a brightly lit gym.
- **"Correndo para a perda de peso" repeated** on both the Plan and Workout screens.
- **Accessibility:** screen readers don't announce the progress bar, and the dialog doesn't trap keyboard focus.
