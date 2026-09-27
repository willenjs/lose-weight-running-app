# PulseRun Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all four screens to the "Kinetic Performance" mockups, rebrand as PulseRun, and add week themes, phase roles, Share and a persisted mute toggle, without touching timer or cue logic.

**Architecture:** Hand-written CSS tokens in `src/app.css` plus a few shared Svelte 5 components in `src/ui/components/`. New pure helpers live in `src/core/`, new browser wrappers in `src/platform/`, and `src/ui/controller.svelte.js` stays the only module wiring them together.

**Tech Stack:** Svelte 5 (runes), Vite 8, Vitest 5, plain JavaScript (JSDoc types), Google Fonts (Space Grotesk + Inter).

**Spec:** `docs/superpowers/specs/2026-09-27-pulserun-redesign-design.md`

## Global Constraints

- Read `AGENTS.md` first. Its rules apply to every task.
- `src/core/`: pure JS, no DOM or browser APIs, imports only from `core/`.
- `src/platform/`: every browser API, imports only from `core/`.
- Components call controller actions only, never `platform/`.
- Svelte 5 runes only (`$state`, `$derived`, `$props`, `onclick=`). No `export let`, `$:` or `on:click`.
- No new npm dependencies. No Tailwind, TypeScript, router or icon font.
- English in code. Portuguese only in `src/i18n/pt.js` and tests.
- All user-facing text goes through `t(key, params)`. Every key exists in both `pt.js` and `en.js`.
- localStorage keys are `runningAssistant.*` with a `{ "version": 1, "data": ... }` envelope. Storage never throws.
- Do not edit `PLAN` in `src/core/plan.js`.
- Timer state comes only from `getState(session, workout, now)`. Any action that changes the session, or the cue settings, stops the cue player and, if the run is not paused, starts it again.
- Colours:
  - surfaces `#0C0D12` / `#14161F` / `#1C1F2B` / `#25293A`
  - text `#FFFFFF`, muted `#8A91A8`
  - mint `#10F49C`
  - walk `#00D2FF`, jog `#FFAB00`, run `#FF334B`
- Primary buttons are at least 60 px tall. All numbers use `font-variant-numeric: tabular-nums`.
- Conventional commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on the branch `feat/pulserun-redesign`. Never push.
- Every task ends with `npm test` and `npm run build`, both passing.

## Review Focus

1. **Stale ids in stored progress.** Saved progress may hold ids that are not in `PLAN`. `programStats` must ignore them rather than report 16/15 or 107%. The test is in Task 1.
2. **Share cancelled or failing.** When the user dismisses the share sheet (`AbortError`) there is no toast and no clipboard write. Any other share error falls back to the clipboard. The tests are in Task 3.
3. **The run finishes while the stop dialog is open.** The dialog must close and the Finished screen must show. The code is in Task 5 (`endRun` clears `confirmingStop`) and the manual check in Task 9.
4. **Mute toggled while paused.** No beeps start until Resume, and after Resume it stays silent. The code is in Task 5 and the manual check in Task 9.
5. **360 px wide with Portuguese strings.** No horizontal scroll, and long week titles ellipsize. The controller runs a `scrollWidth` check after Tasks 7–10.

Visual checks in the browser are done by the controller session after each screen task. Implementer subagents must still run `npm test` and `npm run build`.

---

### Task 1: Core stats helpers

**Files:**
- Modify: `src/core/plan.js` (append after `groupByWeek`)
- Modify: `src/core/progress.js` (append at the end, add an import)
- Test: `tests/core/plan.test.js`, `tests/core/progress.test.js`

**Interfaces:**
- Produces:
  - `phaseSeconds(workout) → { walk: number, jog: number, run: number }` (seconds)
  - `phaseRole(workout, index) → 'warmup' | 'build' | 'recovery' | 'finale'`
  - `programStats(plan, progress) → { done, total, percent, doneMinutes, currentWeek }` (all numbers)

- [ ] **Step 1: Write the failing tests**

Append to `tests/core/plan.test.js`, and change its import line to
`import { PLAN, findWorkout, totalSeconds, groupByWeek, phaseSeconds, phaseRole } from '../../src/core/plan.js';`:

```js
describe('phaseSeconds', () => {
  it('sums seconds per phase type', () => {
    expect(phaseSeconds(findWorkout('w2d2'))).toEqual({ walk: 840, jog: 240, run: 300 });
    expect(phaseSeconds(findWorkout('w4d2'))).toEqual({ walk: 900, jog: 360, run: 300 });
  });

  it('adds up to the workout total', () => {
    for (const workout of PLAN) {
      const { walk, jog, run } = phaseSeconds(workout);
      expect(walk + jog + run, workout.id).toBe(totalSeconds(workout));
    }
  });
});

describe('phaseRole', () => {
  it('labels warm-up, build, recovery and finale', () => {
    const workout = findWorkout('w4d2'); // W J W J W J R
    expect(workout.phases.map((_, i) => phaseRole(workout, i))).toEqual([
      'warmup', 'build', 'recovery', 'build', 'recovery', 'build', 'finale',
    ]);
  });

  it('treats a run that is not last as build', () => {
    const workout = { id: 'x', week: 1, day: 1, phases: [
      { type: 'walk', seconds: 60 }, { type: 'run', seconds: 60 }, { type: 'walk', seconds: 60 },
    ] };
    expect(workout.phases.map((_, i) => phaseRole(workout, i))).toEqual(['warmup', 'build', 'recovery']);
  });
});
```

Append to `tests/core/progress.test.js`, and change its import to add `programStats`:

```js
describe('programStats', () => {
  const at = '2026-09-26T10:00:00.000Z';
  const doneIds = (...ids) => ids.reduce((p, id) => markDone(p, id, at), emptyProgress());

  it('starts at zero in week 1', () => {
    expect(programStats(PLAN, emptyProgress())).toEqual({
      done: 0, total: 15, percent: 0, doneMinutes: 0, currentWeek: 1,
    });
  });

  it('counts done workouts, minutes and the week of the next workout', () => {
    // 21 + 23 + 23 + 21 minutes.
    expect(programStats(PLAN, doneIds('w1d1', 'w1d2', 'w1d3', 'w2d1'))).toEqual({
      done: 4, total: 15, percent: 27, doneMinutes: 88, currentWeek: 2,
    });
  });

  it('reports the last week when everything is done', () => {
    const all = doneIds(...PLAN.map((w) => w.id));
    expect(programStats(PLAN, all)).toEqual({
      done: 15, total: 15, percent: 100, doneMinutes: 391, currentWeek: 5,
    });
  });

  it('ignores stored ids that are not in the plan', () => {
    expect(programStats(PLAN, doneIds('w1d1', 'w9d9'))).toMatchObject({ done: 1, percent: 7, doneMinutes: 21 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/core`
Expected: FAIL (`phaseSeconds is not a function`, `programStats is not a function`)

- [ ] **Step 3: Implement**

Append to `src/core/plan.js`:

```js
/** @param {Workout} workout @returns {Record<PhaseType, number>} seconds per phase type */
export function phaseSeconds(workout) {
  const totals = { walk: 0, jog: 0, run: 0 };
  for (const phase of workout.phases) totals[phase.type] += phase.seconds;
  return totals;
}

/** @typedef {'warmup' | 'build' | 'recovery' | 'finale'} PhaseRole */

/** What a phase is for, used for labels and tips. @param {Workout} workout @returns {PhaseRole} */
export function phaseRole(workout, index) {
  const phase = workout.phases[index];
  if (index === 0) return 'warmup';
  if (index === workout.phases.length - 1 && phase.type === 'run') return 'finale';
  return phase.type === 'walk' ? 'recovery' : 'build';
}
```

In `src/core/progress.js`, add `import { totalSeconds } from './plan.js';` below the typedefs and append:

```js
/**
 * @param {Workout[]} plan @param {Progress} progress
 * @returns {{ done: number, total: number, percent: number, doneMinutes: number, currentWeek: number }}
 */
export function programStats(plan, progress) {
  const doneWorkouts = plan.filter((w) => isDone(progress, w.id));
  const done = doneWorkouts.length;
  const total = plan.length;
  const doneSeconds = doneWorkouts.reduce((sum, w) => sum + totalSeconds(w), 0);
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    doneMinutes: Math.round(doneSeconds / 60),
    currentWeek: nextWorkout(plan, progress)?.week ?? plan.at(-1)?.week ?? 1,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS (all files)

- [ ] **Step 5: Commit**

```bash
git add src/core/plan.js src/core/progress.js tests/core/plan.test.js tests/core/progress.test.js
git commit -m "feat: add phase totals, phase roles and program stats"
```

---

### Task 2: Settings storage

**Files:**
- Modify: `src/platform/storage.js`
- Test: `tests/platform/storage.test.js`

**Interfaces:**
- Produces: `STORAGE_KEYS.settings === 'runningAssistant.settings'`, `storage.loadSettings() → { muted: boolean }`, `storage.saveSettings({ muted })`

- [ ] **Step 1: Write the failing tests**

In `tests/platform/storage.test.js`, update the `STORAGE_KEYS` expectation in the first test to:

```js
    expect(STORAGE_KEYS).toEqual({
      progress: 'runningAssistant.progress',
      session: 'runningAssistant.session',
      lang: 'runningAssistant.lang',
      settings: 'runningAssistant.settings',
    });
```

Append inside `describe('createStorage', ...)`:

```js
  it('round-trips settings in a version envelope', () => {
    const backend = fakeBackend();
    const storage = createStorage(backend);
    storage.saveSettings({ muted: true });
    expect(storage.loadSettings()).toEqual({ muted: true });
    expect(JSON.parse(backend.data.get('runningAssistant.settings'))).toEqual({ version: 1, data: { muted: true } });
  });

  it('defaults settings to unmuted when missing, stale or malformed', () => {
    expect(createStorage(fakeBackend()).loadSettings()).toEqual({ muted: false });
    expect(createStorage(fakeBackend({
      [STORAGE_KEYS.settings]: JSON.stringify({ version: 99, data: { muted: true } }),
    })).loadSettings()).toEqual({ muted: false });
    expect(createStorage(fakeBackend({
      [STORAGE_KEYS.settings]: JSON.stringify({ version: 1, data: { muted: 'yes' } }),
    })).loadSettings()).toEqual({ muted: false });
  });

  it('never throws on settings with a broken backend', () => {
    const storage = createStorage(throwingBackend);
    expect(() => storage.saveSettings({ muted: true })).not.toThrow();
    expect(storage.loadSettings()).toEqual({ muted: false });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/platform/storage.test.js`
Expected: FAIL (`storage.saveSettings is not a function`, plus the keys mismatch)

- [ ] **Step 3: Implement**

In `src/platform/storage.js`:

```js
export const STORAGE_KEYS = {
  progress: 'runningAssistant.progress',
  session: 'runningAssistant.session',
  lang: 'runningAssistant.lang',
  settings: 'runningAssistant.settings',
};
```

Add next to the other validators:

```js
const isSettings = (value) => isObject(value) && typeof value.muted === 'boolean';
```

Add to the returned object:

```js
    loadSettings: () => read(STORAGE_KEYS.settings, isSettings, { muted: false }),
    saveSettings: (settings) => write(STORAGE_KEYS.settings, settings),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/platform/storage.js tests/platform/storage.test.js
git commit -m "feat: persist a muted setting"
```

---

### Task 3: Share module

**Files:**
- Create: `src/platform/share.js`
- Test: `tests/platform/share.test.js`

**Interfaces:**
- Produces:
  - `canShare() → boolean`
  - `share({ title, text, url }) → Promise<'shared' | 'copied' | 'unavailable'>` (never rejects)

- [ ] **Step 1: Write the failing test**

Create `tests/platform/share.test.js`:

```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { share, canShare } from '../../src/platform/share.js';

const payload = { title: 'PulseRun', text: 'Done!', url: 'https://example.test/' };

function stubNavigator(nav) {
  vi.stubGlobal('navigator', nav);
}

afterEach(() => vi.unstubAllGlobals());

describe('share', () => {
  it('uses the Web Share API when present', async () => {
    const nav = { share: vi.fn().mockResolvedValue(undefined), clipboard: { writeText: vi.fn() } };
    stubNavigator(nav);
    expect(await share(payload)).toBe('shared');
    expect(nav.share).toHaveBeenCalledWith(payload);
    expect(nav.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('treats a dismissed share sheet as done, without copying', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    const nav = { share: vi.fn().mockRejectedValue(abort), clipboard: { writeText: vi.fn() } };
    stubNavigator(nav);
    expect(await share(payload)).toBe('shared');
    expect(nav.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard when sharing fails', async () => {
    const nav = {
      share: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    };
    stubNavigator(nav);
    expect(await share(payload)).toBe('copied');
    expect(nav.clipboard.writeText).toHaveBeenCalledWith('Done! https://example.test/');
  });

  it('copies when only the clipboard exists', async () => {
    stubNavigator({ clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    expect(await share(payload)).toBe('copied');
  });

  it('reports unavailable and never rejects', async () => {
    stubNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    expect(await share(payload)).toBe('unavailable');
    stubNavigator({ share: () => { throw new Error('sync'); } });
    expect(await share(payload)).toBe('unavailable');
    stubNavigator(undefined);
    expect(await share(payload)).toBe('unavailable');
  });
});

describe('canShare', () => {
  it('is true with either API and false with neither', () => {
    stubNavigator({ share: () => {} });
    expect(canShare()).toBe(true);
    stubNavigator({ clipboard: { writeText: () => {} } });
    expect(canShare()).toBe(true);
    stubNavigator({});
    expect(canShare()).toBe(false);
    stubNavigator(undefined);
    expect(canShare()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/platform/share.test.js`
Expected: FAIL (cannot find module `share.js`)

- [ ] **Step 3: Implement**

Create `src/platform/share.js`:

```js
/** Whether the Share button can do anything on this device. */
export function canShare() {
  const nav = globalThis.navigator;
  return Boolean(nav?.share || nav?.clipboard?.writeText);
}

/**
 * Opens the system share sheet, or copies the text when sharing is not possible.
 * Never rejects.
 * @param {{ title: string, text: string, url: string }} data
 * @returns {Promise<'shared' | 'copied' | 'unavailable'>}
 */
export async function share(data) {
  const nav = globalThis.navigator;
  if (nav?.share) {
    try {
      await nav.share(data);
      return 'shared';
    } catch (error) {
      // The user closed the sheet: nothing else to do.
      if (error?.name === 'AbortError') return 'shared';
    }
  }
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(`${data.text} ${data.url}`);
      return 'copied';
    } catch {
      // Clipboard blocked: fall through.
    }
  }
  return 'unavailable';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/platform/share.js tests/platform/share.test.js
git commit -m "feat: add share helper with clipboard fallback"
```

---

### Task 4: PulseRun copy (i18n)

**Files:**
- Modify: `src/i18n/pt.js`, `src/i18n/en.js` (full replacement below)
- Test: `tests/i18n/i18n.test.js`

**Interfaces:**
- Produces: every key used by Tasks 5–10. The keys marked `// legacy` are removed in Task 10.

- [ ] **Step 1: Write the failing test**

Append to `tests/i18n/i18n.test.js`:

```js
describe('PulseRun copy', () => {
  it('names the app PulseRun', () => {
    for (const lang of LANGS) expect(translate(lang, 'app.title')).toBe('PulseRun');
  });

  it('has a theme and subtitle for each of the 5 weeks', () => {
    for (const lang of LANGS) {
      for (let week = 1; week <= 5; week += 1) {
        for (const part of ['title', 'subtitle']) {
          const key = `week.${week}.${part}`;
          expect(translate(lang, key), `${lang} ${key}`).not.toBe(key);
        }
      }
    }
  });

  it('has a label for every phase role, tip and pace', () => {
    const keys = [
      ...['warmup', 'build', 'recovery', 'finale'].flatMap((r) => [`role.${r}`, `tip.${r}`]),
      ...['walk', 'jog', 'run'].flatMap((p) => [`pace.${p}`, `short.${p}`]),
    ];
    for (const lang of LANGS) for (const key of keys) expect(translate(lang, key), `${lang} ${key}`).not.toBe(key);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/i18n`
Expected: FAIL (`app.title` is not "PulseRun", and the week keys are missing)

- [ ] **Step 3: Replace `src/i18n/pt.js`**

```js
export default {
  'app.title': 'PulseRun',
  'app.subtitle': 'Plano 5 Semanas',
  'lang.label': 'Idioma',
  'lang.switch': 'EN', // legacy
  'header.mute': 'Silenciar áudio',
  'header.unmute': 'Ativar áudio',
  'common.weekDay': 'Semana {week} • Dia {day}',
  'common.shortWeekDay': 'S{week} • D{day}',
  'common.of': 'de {total}',
  'unit.min': 'min',
  'week.1.title': 'Adaptação',
  'week.1.subtitle': 'Caminhada vigorosa com trotes curtos',
  'week.2.title': 'Ritmo',
  'week.2.subtitle': 'Consolidando a base de caminhada e trote',
  'week.3.title': 'Resistência',
  'week.3.subtitle': 'Caminhadas de até 9 minutos entre trotes',
  'week.4.title': 'Blocos longos',
  'week.4.subtitle': 'Mais intervalos e trotes de 3 minutos',
  'week.5.title': 'Consolidação',
  'week.5.subtitle': 'Juntando tudo para fechar o programa',
  'plan.continue': 'Continuar: Semana {week} - Dia {day}', // legacy
  'plan.allDone': 'Programa concluído! 🎉',
  'plan.progressLabel': 'Progresso geral',
  'plan.workoutsDone': 'Treinos feitos',
  'plan.totalTime': 'Tempo total',
  'plan.currentWeek': 'Semana atual',
  'plan.weekOf': '{week} de {total}',
  'plan.next': 'Próximo treino',
  'plan.start': 'Iniciar S{week} • Dia {day}',
  'plan.cycle': 'Ciclo de 5 semanas',
  'plan.perWeek': '3 dias / semana',
  'plan.week': 'Semana {week}',
  'plan.weekDone': '{done}/{total} concluídos',
  'plan.inProgress': 'Em andamento',
  'plan.day': 'Dia {day}',
  'plan.done': 'Concluído',
  'plan.current': 'Atual',
  'plan.waiting': 'Aguardando',
  'plan.goalTitle': 'Meta do programa',
  'plan.goalText': 'Ao fim da Semana 5, você terá completado 15 treinos alternando caminhada, trote e corrida.',
  'workout.title': 'Semana {week} - Dia {day}',
  'workout.total': '{value} min',
  'workout.heading': 'Treino intervalado',
  'workout.ofVolume': '{percent}% do volume',
  'workout.timeline': 'Linha do treino',
  'workout.phaseCount': '{count} fases',
  'workout.phasesTitle': 'Fases detalhadas',
  'workout.phaseLabel': 'Fase {n} • {role}',
  'workout.tipTitle': 'Ajuste de velocidade',
  'workout.tipText': 'Ajuste a velocidade da esteira ao seu conforto em cada fase: caminhe leve, trote solto e corra no seu limite seguro.',
  'workout.voiceOn': 'Treinador por áudio ativo: bips e voz avisam cada troca de fase.',
  'workout.voiceOff': 'Áudio desativado. Toque no alto-falante para ativar.',
  'workout.start': 'Vamos começar!',
  'workout.back': 'Voltar',
  'workout.done': 'Concluído em {date}.',
  'workout.unmark': 'Desmarcar',
  'phase.walk': 'Caminhar',
  'phase.jog': 'Trotar',
  'phase.run': 'Correr',
  'short.walk': 'C',
  'short.jog': 'T',
  'short.run': 'R',
  'role.warmup': 'Aquecimento',
  'role.build': 'Elevação',
  'role.recovery': 'Recuperação ativa',
  'role.finale': 'Pico final',
  'tip.warmup': 'Passada confortável',
  'tip.build': 'Trote leve e contínuo',
  'tip.recovery': 'Recupere o fôlego com calma',
  'tip.finale': 'Corrida firme no seu ritmo',
  'pace.walk': 'Ritmo leve',
  'pace.jog': 'Ritmo moderado',
  'pace.run': 'Ritmo rápido',
  'run.phaseOf': 'Fase {n} de {total}',
  'run.next': 'Próximo: {phase} {time}',
  'run.last': 'Última fase',
  'run.remaining': 'Restante: {time}', // legacy
  'run.remainingTotal': 'Restante total',
  'run.phasesDone': 'Fases concluídas',
  'run.voiceOn': 'Bips + voz',
  'run.voiceOff': 'Mudo',
  'run.screenOn': 'Tela ativa',
  'run.paused': 'Pausado',
  'run.pause': 'Pausar',
  'run.resume': 'Continuar',
  'run.skip': 'Pular',
  'run.stop': 'Parar',
  'run.stopConfirm': 'Parar o treino? Ele não será marcado como concluído.', // legacy
  'run.stopTitle': 'Parar o treino?',
  'run.stopBody': 'Ele não será marcado como concluído.',
  'run.stopKeep': 'Continuar treinando',
  'run.noAudio': 'Áudio indisponível. Acompanhe o cronômetro na tela.',
  'cue.phase': '{phase} por {duration}',
  'cue.finish': 'Treino concluído!',
  'finished.badge': 'Meta batida',
  'finished.title': 'Treino concluído! 🔥',
  'finished.subtitle': 'Semana {week} • Dia {day} finalizado com sucesso',
  'finished.totalTime': 'Tempo total',
  'finished.phases': 'Fases',
  'finished.runTime': 'Tempo correndo',
  'finished.overall': 'Progresso geral',
  'finished.programProgress': '{done} de {total} treinos',
  'finished.nextStep': 'Próximo passo',
  'finished.back': 'Voltar ao plano',
  'finished.share': 'Compartilhar conquista',
  'finished.unmark': 'Desmarcar conclusão deste treino',
  'share.text': 'Concluí a Semana {week} • Dia {day} do plano de 5 semanas no PulseRun! ({done}/{total} treinos)',
  'toast.copied': 'Copiado!',
  'resume.title': 'Treino em andamento',
  'resume.text': 'Semana {week} - Dia {day} não foi terminado.',
  'resume.resume': 'Retomar',
  'resume.discard': 'Descartar',
  'unit.minute.one': '{n} minuto',
  'unit.minute.other': '{n} minutos',
  'unit.second.one': '{n} segundo',
  'unit.second.other': '{n} segundos',
  'unit.and': ' e ',
};
```

- [ ] **Step 4: Replace `src/i18n/en.js`**

```js
export default {
  'app.title': 'PulseRun',
  'app.subtitle': '5-Week Plan',
  'lang.label': 'Language',
  'lang.switch': 'PT', // legacy
  'header.mute': 'Mute audio',
  'header.unmute': 'Unmute audio',
  'common.weekDay': 'Week {week} • Day {day}',
  'common.shortWeekDay': 'W{week} • D{day}',
  'common.of': 'of {total}',
  'unit.min': 'min',
  'week.1.title': 'Adaptation',
  'week.1.subtitle': 'Brisk walking with short jogs',
  'week.2.title': 'Rhythm',
  'week.2.subtitle': 'Building a steady walk-and-jog base',
  'week.3.title': 'Endurance',
  'week.3.subtitle': 'Walks of up to 9 minutes between jogs',
  'week.4.title': 'Longer blocks',
  'week.4.subtitle': 'More intervals and 3-minute jogs',
  'week.5.title': 'Consolidation',
  'week.5.subtitle': 'Putting it all together to finish',
  'plan.continue': 'Continue: Week {week} - Day {day}', // legacy
  'plan.allDone': 'Program complete! 🎉',
  'plan.progressLabel': 'Overall progress',
  'plan.workoutsDone': 'Workouts done',
  'plan.totalTime': 'Total time',
  'plan.currentWeek': 'Current week',
  'plan.weekOf': '{week} of {total}',
  'plan.next': 'Next workout',
  'plan.start': 'Start W{week} • Day {day}',
  'plan.cycle': '5-week cycle',
  'plan.perWeek': '3 days / week',
  'plan.week': 'Week {week}',
  'plan.weekDone': '{done}/{total} done',
  'plan.inProgress': 'In progress',
  'plan.day': 'Day {day}',
  'plan.done': 'Done',
  'plan.current': 'Current',
  'plan.waiting': 'Waiting',
  'plan.goalTitle': 'Program goal',
  'plan.goalText': 'By the end of Week 5 you will have completed 15 workouts mixing walking, jogging and running.',
  'workout.title': 'Week {week} - Day {day}',
  'workout.total': '{value} min',
  'workout.heading': 'Interval workout',
  'workout.ofVolume': '{percent}% of volume',
  'workout.timeline': 'Workout timeline',
  'workout.phaseCount': '{count} phases',
  'workout.phasesTitle': 'Phase by phase',
  'workout.phaseLabel': 'Phase {n} • {role}',
  'workout.tipTitle': 'Speed setting',
  'workout.tipText': 'Set the treadmill speed to what feels right in each phase: walk easy, jog loose and run at your safe limit.',
  'workout.voiceOn': 'Audio coach on: beeps and voice announce every phase change.',
  'workout.voiceOff': 'Audio is off. Tap the speaker to turn it on.',
  'workout.start': "Let's go!",
  'workout.back': 'Back',
  'workout.done': 'Completed on {date}.',
  'workout.unmark': 'Unmark',
  'phase.walk': 'Walk',
  'phase.jog': 'Jog',
  'phase.run': 'Run',
  'short.walk': 'W',
  'short.jog': 'J',
  'short.run': 'R',
  'role.warmup': 'Warm-up',
  'role.build': 'Build',
  'role.recovery': 'Active recovery',
  'role.finale': 'Final push',
  'tip.warmup': 'Comfortable stride',
  'tip.build': 'Light, steady jog',
  'tip.recovery': 'Catch your breath calmly',
  'tip.finale': 'Firm run at your pace',
  'pace.walk': 'Easy pace',
  'pace.jog': 'Moderate pace',
  'pace.run': 'Fast pace',
  'run.phaseOf': 'Phase {n} of {total}',
  'run.next': 'Next: {phase} {time}',
  'run.last': 'Last phase',
  'run.remaining': 'Remaining: {time}', // legacy
  'run.remainingTotal': 'Total remaining',
  'run.phasesDone': 'Phases done',
  'run.voiceOn': 'Beeps + voice',
  'run.voiceOff': 'Muted',
  'run.screenOn': 'Screen on',
  'run.paused': 'Paused',
  'run.pause': 'Pause',
  'run.resume': 'Resume',
  'run.skip': 'Skip',
  'run.stop': 'Stop',
  'run.stopConfirm': 'Stop the workout? It will not be marked as completed.', // legacy
  'run.stopTitle': 'Stop the workout?',
  'run.stopBody': 'It will not be marked as completed.',
  'run.stopKeep': 'Keep going',
  'run.noAudio': 'Audio unavailable. Follow the on-screen timer.',
  'cue.phase': '{phase} for {duration}',
  'cue.finish': 'Workout complete!',
  'finished.badge': 'Goal reached',
  'finished.title': 'Workout complete! 🔥',
  'finished.subtitle': 'Week {week} • Day {day} finished',
  'finished.totalTime': 'Total time',
  'finished.phases': 'Phases',
  'finished.runTime': 'Running time',
  'finished.overall': 'Overall progress',
  'finished.programProgress': '{done} of {total} workouts',
  'finished.nextStep': 'Next step',
  'finished.back': 'Back to plan',
  'finished.share': 'Share achievement',
  'finished.unmark': 'Unmark this workout',
  'share.text': 'I finished Week {week} • Day {day} of the 5-week plan on PulseRun! ({done}/{total} workouts)',
  'toast.copied': 'Copied!',
  'resume.title': 'Workout in progress',
  'resume.text': 'Week {week} - Day {day} was not finished.',
  'resume.resume': 'Resume',
  'resume.discard': 'Discard',
  'unit.minute.one': '{n} minute',
  'unit.minute.other': '{n} minutes',
  'unit.second.one': '{n} second',
  'unit.second.other': '{n} seconds',
  'unit.and': ' and ',
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS (including the key-parity test)

- [ ] **Step 6: Commit**

```bash
git add src/i18n/pt.js src/i18n/en.js tests/i18n/i18n.test.js
git commit -m "feat: add PulseRun copy, week themes and phase roles"
```

---

### Task 5: Mute, wake-lock status, stop dialog state and share in the controller

**Files:**
- Modify: `src/platform/audio.js` (the `start` function)
- Modify: `src/platform/wakeLock.js` (whole file below)
- Modify: `src/platform/speech.js` (add `cancelSpeech`)
- Modify: `src/ui/controller.svelte.js`
- Modify: `src/ui/App.svelte` (toast)

**Interfaces:**
- Consumes: `storage.loadSettings/saveSettings` (Task 2), `share`, `canShare` (Task 3), `programStats` (Task 1), `totalSeconds` from `core/plan.js`
- Produces (controller exports used by Tasks 6–10):
  - new `app` fields: `muted: boolean`, `wakeLockActive: boolean`, `confirmingStop: boolean`, `toast: string | null`, `canShare: boolean`
  - `toggleMute()`, `requestStop()`, `cancelStop()`, `shareResult(): Promise<void>`
  - `workoutMinutes(workout) → number`, `phaseShorthand(workout) → string` (e.g. `"C7 • T2 • C7 • T2 • R5"`)
  - `stop()` (existing, now also closes the dialog)

There are no unit tests here: platform audio and wake lock and the controller are verified manually, per AGENTS.md. The gate is that the existing tests and the build still pass.

- [ ] **Step 1: `audio.js`: optional silent mode**

Replace the `start` function in `src/platform/audio.js` with:

```js
  /** @param {{ muted?: boolean }} [options] muted: keep the tab alive but schedule no tones. */
  function start(session, workout, now, { muted = false } = {}) {
    if (!AudioContextClass) return false;
    try {
      stop();
      ctx ??= new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const base = ctx.currentTime;
      if (!muted) {
        for (const cue of upcomingCues(session, workout, now)) {
          for (const n of TONES[cue.kind]) note(n.freq, base + cue.inMs / 1000 + n.at, n.dur);
        }
      }
      oscillator(KEEP_ALIVE_FREQ, KEEP_ALIVE_VOLUME).osc.start(base);
      return true;
    } catch {
      return false;
    }
  }
```

- [ ] **Step 2: `wakeLock.js`: report the lock state**

Replace `src/platform/wakeLock.js` with:

```js
/**
 * Keeps the screen on while wanted; the browser drops the lock when the tab is hidden.
 * @param {{ onChange?: (active: boolean) => void }} [options]
 */
export function createWakeLock({ onChange = () => {} } = {}) {
  let wanted = false;
  /** @type {WakeLockSentinel | null} */
  let sentinel = null;

  async function request() {
    if (!wanted || sentinel || !navigator.wakeLock || document.visibilityState !== 'visible') return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (!wanted) {
        lock.release().catch(() => {});
        return;
      }
      sentinel = lock;
      // Fires when the browser drops the lock (tab hidden) or we release it.
      lock.addEventListener('release', () => {
        if (sentinel !== lock) return;
        sentinel = null;
        onChange(false);
      });
      onChange(true);
    } catch {
      sentinel = null;
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') request();
  }

  return {
    acquire() {
      wanted = true;
      document.addEventListener('visibilitychange', onVisibilityChange);
      request();
    },
    release() {
      wanted = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      const lock = sentinel;
      sentinel = null;
      if (lock) {
        lock.release().catch(() => {});
        onChange(false);
      }
    },
  };
}
```

- [ ] **Step 3: `speech.js`: allow cancelling**

Append to `src/platform/speech.js`:

```js
/** Stops any speech in progress (used when muting). */
export function cancelSpeech() {
  globalThis.speechSynthesis?.cancel();
}
```

- [ ] **Step 4: Controller changes**

In `src/ui/controller.svelte.js`:

1. Replace the imports block with:

```js
import { PLAN, findWorkout, totalSeconds } from '../core/plan.js';
import {
  startSession, pauseSession, resumeSession, skipPhase, getState, shouldOfferResume,
} from '../core/timer.js';
import { markDone, unmark, programStats } from '../core/progress.js';
import { translate, formatDuration, LANGS, DEFAULT_LANG, LOCALES } from '../i18n/index.js';
import { createStorage } from '../platform/storage.js';
import { createCuePlayer } from '../platform/audio.js';
import { speak, cancelSpeech } from '../platform/speech.js';
import { createWakeLock } from '../platform/wakeLock.js';
import { share, canShare } from '../platform/share.js';
```

2. Below `FINISH_AUDIO_GRACE_MS`, add `const TOAST_MS = 2000;`
3. Replace `const wakeLock = createWakeLock();` with:

```js
const wakeLock = createWakeLock({ onChange: (active) => { app.wakeLockActive = active; } });
```

4. Add to the `app` `$state` object, after `audioAvailable: true,`:

```js
  muted: storage.loadSettings().muted,
  wakeLockActive: false,
  confirmingStop: false,
  /** @type {string | null} */
  toast: null,
  canShare: canShare(),
```

5. Below `let lastPhaseIndex = -1;`, add `let toastTimer = null;`
6. Replace `export function stop() { ... }` with:

```js
export function requestStop() {
  app.confirmingStop = true;
}

export function cancelStop() {
  app.confirmingStop = false;
}

export function stop() {
  cuePlayer.stop();
  endRun();
  app.screen = 'workout';
}

export function toggleMute() {
  app.muted = !app.muted;
  storage.saveSettings({ muted: app.muted });
  if (app.muted) cancelSpeech();
  // Re-schedule so the change applies now; still called from the tap (a user gesture).
  if (app.session) {
    cuePlayer.stop();
    if (app.session.pausedAt === null) playCues();
  }
}

export async function shareResult() {
  const workout = findWorkout(app.workoutId);
  if (!workout) return;
  const { done, total } = programStats(PLAN, app.progress);
  const result = await share({
    title: t('app.title'),
    text: t('share.text', { week: workout.week, day: workout.day, done, total }),
    url: location.origin + location.pathname,
  });
  if (result === 'copied') showToast(t('toast.copied'));
}

export function workoutMinutes(workout) {
  return Math.round(totalSeconds(workout) / 60);
}

/** Compact phase list, e.g. "C7 • T2 • R5". */
export function phaseShorthand(workout) {
  return workout.phases
    .map((phase) => `${t(`short.${phase.type}`)}${Math.round(phase.seconds / 60)}`)
    .join(' • ');
}

function showToast(text) {
  clearTimeout(toastTimer);
  app.toast = text;
  toastTimer = setTimeout(() => { app.toast = null; }, TOAST_MS);
}
```

7. Replace `playCues` with:

```js
function playCues() {
  app.audioAvailable = cuePlayer.start(
    $state.snapshot(app.session), currentWorkout(), Date.now(), { muted: app.muted },
  );
}
```

8. In `announcePhase`, add `if (app.muted) return;` as its first line.
9. In `finish`, replace `speak(t('cue.finish'), LOCALES[app.lang]);` with
   `if (!app.muted) speak(t('cue.finish'), LOCALES[app.lang]);`
10. In `endRun`, add `app.confirmingStop = false;` as its first line. This covers Review Focus #3: a run that finishes while the dialog is open closes it.

- [ ] **Step 5: Toast in `App.svelte`**

In `src/ui/App.svelte`, after `{/if}` and before `</main>`, add:

```svelte
  {#if app.toast}<div class="toast" role="status">{app.toast}</div>{/if}
```

- [ ] **Step 6: Verify**

Run: `npm test`, then `npm run build`
Expected: both PASS. The old screens still work because `stop()` is unchanged and the legacy keys still exist.

- [ ] **Step 7: Commit**

```bash
git add src/platform/audio.js src/platform/wakeLock.js src/platform/speech.js src/ui/controller.svelte.js src/ui/App.svelte
git commit -m "feat: add mute toggle, wake-lock status, stop dialog state and share action"
```

---

### Task 6: Design foundation, brand and shared components

**Files:**
- Modify: `src/app.css`, `index.html`, `public/manifest.webmanifest`, `public/icon.svg`
- Create: `src/ui/components/Icon.svelte`, `AppHeader.svelte`, `PhaseBar.svelte`, `StatTile.svelte`, `ConfirmDialog.svelte`

**Interfaces:**
- Consumes: controller `app`, `t`, `setLang`, `toggleMute`; `LANGS` from `src/i18n/index.js`; `totalSeconds` from core; `formatClock` from `core/timer.js`
- Produces (used by Tasks 7–10):
  - `<Icon name size? />`, with names `back play pause skip stop check circle lock chevron speaker speaker-off timer flag trophy share bolt calendar walk jog run`
  - `<AppHeader subtitle onback? />`
  - `<PhaseBar workout currentIndex? times? thin? />`
  - `<StatTile label value unit? caption? icon? tone? />`, where `tone` is `'walk' | 'jog' | 'run' | 'mint'`
  - `<ConfirmDialog title body confirmLabel cancelLabel onconfirm oncancel danger? />`
  - Global classes: `.screen .card .label .num .btn .btn-primary .btn-secondary .btn-link .chip .tag .overlay .dialog .toast .phase-walk|jog|run` (each sets `--phase`)

- [ ] **Step 1: Brand files**

In `index.html`, change the theme colour meta to `content="#0C0D12"`. Change the fonts `href` to
`https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Space+Grotesk:wght@500;700&display=swap`
and the title to `<title>PulseRun</title>`.

Replace `public/manifest.webmanifest`:

```json
{
  "name": "PulseRun",
  "short_name": "PulseRun",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0C0D12",
  "theme_color": "#0C0D12",
  "icons": [
    { "src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }
  ]
}
```

Replace `public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <rect width="100" height="100" rx="24" fill="#0D0E13"/>
  <path d="M68 24C68 28.4183 64.4183 32 60 32C55.5817 32 52 28.4183 52 24C52 19.5817 55.5817 16 60 16C64.4183 16 68 19.5817 68 24Z" fill="#10F49C"/>
  <path d="M42 42L52 35L62 40L72 38" stroke="#10F49C" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M52 35L44 54L58 62L52 84" stroke="#10F49C" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M44 54L30 60L22 72" stroke="#10F49C" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M26 36L18 48M34 26L24 38" stroke="#10F49C" stroke-opacity="0.4" stroke-width="4" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 2: Rewrite the top of `src/app.css`**

Delete everything from the start of the file through the `.danger { ... }` rule. That covers `:root`, `*`, `html, body`, `.app`, `.screen`, `h1, h2`, `button`, `.primary`, `.secondary`, `.link` and `.danger`. Also delete the `/* Resume dialog */` block at the end (`.overlay`, `.dialog`, `.dialog p`). Then put this at the top of the file:

```css
:root {
  --surface-0: #0c0d12;
  --surface-1: #14161f;
  --surface-2: #1c1f2b;
  --surface-3: #25293a;
  --text: #ffffff;
  --text-muted: #8a91a8;
  --mint: #10f49c;
  --on-mint: #002111;
  --mint-soft: rgb(16 244 156 / 0.12);
  --mint-glow: rgb(16 244 156 / 0.25);
  --walk: #00d2ff;
  --jog: #ffab00;
  --run: #ff334b;
  --radius: 16px;
  --radius-sm: 4px;
  --margin: 20px;
  --gap: 16px;
  --pad: 24px;
  --display-font: 'Space Grotesk', system-ui, sans-serif;
  --body-font: 'Inter', system-ui, sans-serif;
  color-scheme: dark;

  /* Legacy aliases for the old screens; removed in Task 10. */
  --bg: var(--surface-0);
  --surface: var(--surface-1);
  --muted: var(--text-muted);
  --accent: var(--mint);
  --primary: var(--mint);
  --separator: var(--surface-3);
  --danger: var(--run);
  --heading-font: var(--display-font);
}

.phase-walk { --phase: var(--walk); }
.phase-jog { --phase: var(--jog); }
.phase-run { --phase: var(--run); }

* { box-sizing: border-box; }

html, body {
  margin: 0;
  background: var(--surface-0);
  color: var(--text);
  font-family: var(--body-font);
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
}

.app {
  max-width: 560px;
  margin: 0 auto;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  padding: 0 var(--margin) calc(var(--margin) + env(safe-area-inset-bottom));
}

button { font: inherit; color: inherit; cursor: pointer; border: none; background: none; padding: 0; }

.num { font-family: var(--display-font); font-variant-numeric: tabular-nums; }

.label {
  margin: 0;
  font-family: var(--display-font);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.card {
  background: var(--surface-1);
  border: 1px solid var(--surface-2);
  border-radius: var(--radius);
  padding: 20px;
}

.btn {
  min-height: 60px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 16px;
  border-radius: var(--radius);
  font-family: var(--display-font);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.btn-primary { background: var(--mint); color: var(--on-mint); box-shadow: 0 0 24px -4px var(--mint-glow); }
.btn-primary:active { background: var(--surface-0); color: var(--mint); box-shadow: inset 0 0 0 2px var(--mint); }
.btn-secondary { background: var(--surface-1); color: var(--text); box-shadow: inset 0 0 0 1.5px var(--surface-3); }
.btn-secondary:active { background: var(--text); color: var(--surface-0); }
.btn-link { align-self: center; padding: 12px; font-size: 14px; color: var(--text-muted); text-decoration: underline; }

.chip, .tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 9999px;
  font-family: var(--display-font);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}
.chip { background: var(--surface-2); color: var(--text-muted); }
.tag { background: var(--mint-soft); color: var(--mint); }

.overlay {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--margin);
  background: rgb(12 13 18 / 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.dialog {
  width: 100%;
  max-width: 400px;
  display: grid;
  gap: var(--gap);
  padding: var(--pad);
  background: var(--surface-2);
  border: 1px solid var(--surface-3);
  border-radius: var(--radius);
}
.dialog h2 { margin: 0; font-family: var(--display-font); font-size: 22px; color: var(--text); }
.dialog p { margin: 0; color: var(--text-muted); }

.toast {
  position: fixed;
  left: 50%;
  bottom: calc(96px + env(safe-area-inset-bottom));
  z-index: 20;
  transform: translateX(-50%);
  padding: 10px 18px;
  border-radius: 9999px;
  background: var(--surface-2);
  border: 1px solid var(--mint);
  color: var(--mint);
  font-family: var(--display-font);
  font-weight: 700;
}

/* ---------- Legacy screen styles, deleted in Task 10 ---------- */
.primary { background: var(--primary); color: var(--on-mint); font-weight: 600; font-size: 1.1rem; padding: 18px; border-radius: 12px; width: 100%; }
.secondary { background: var(--surface); color: var(--text); font-size: 1rem; padding: 14px; border-radius: 12px; width: 100%; }
.link { background: none; color: var(--accent); text-decoration: underline; padding: 0; }
.danger { color: var(--danger); }
```

Keep the existing `/* Plan */`, `/* Workout */`, `/* Run */` and `/* Finished */` blocks below that, unchanged.

- [ ] **Step 3: `Icon.svelte`**

Create `src/ui/components/Icon.svelte`:

```svelte
<script>
  /** @type {{ name: string, size?: number }} */
  let { name, size = 24 } = $props();

  // 24×24 stroke paths (2px, round joins). Circles are written as arcs.
  /** @type {Record<string, string[]>} */
  const PATHS = {
    back: ['M19 12H5', 'M12 19l-7-7 7-7'],
    play: ['M7 4.5v15l12.5-7.5z'],
    pause: ['M8 5v14', 'M16 5v14'],
    skip: ['M5 5l10 7-10 7z', 'M19 5v14'],
    stop: ['M6 6h12v12H6z'],
    check: ['M5 12.5l4.5 4.5L19 7.5'],
    circle: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'],
    lock: ['M6 11h12v10H6z', 'M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11'],
    chevron: ['M6 9l6 6 6-6'],
    speaker: ['M4 9h4l5-4v14l-5-4H4z', 'M16.5 9a4 4 0 0 1 0 6', 'M19 6.5a7.5 7.5 0 0 1 0 11'],
    'speaker-off': ['M4 9h4l5-4v14l-5-4H4z', 'M16.5 9.5l5 5', 'M21.5 9.5l-5 5'],
    timer: ['M20 14a8 8 0 1 1-16 0 8 8 0 0 1 16 0z', 'M12 10v4l2.5 2', 'M10 2.5h4'],
    flag: ['M5 21V4', 'M5 4h11l-2 4 2 4H5'],
    trophy: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8 21h8', 'M10 17h4v4h-4z'],
    share: [
      'M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
      'M21 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M8.6 13.5l6.8 4', 'M15.4 6.5l-6.8 4',
    ],
    bolt: ['M13 2L4 14h7l-1 8 9-12h-7z'],
    calendar: ['M4 6h16v15H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
    walk: ['M14.5 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z', 'M13 8l-1 6 3 3v4', 'M12 14l-2 7', 'M13 8l-3 3v3', 'M13 8l2.5 3H18'],
    jog: ['M16.5 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z', 'M14 8l-2.5 5 3.5 3-1 5', 'M11.5 13l-4.5 2', 'M14 8l3 3h3', 'M14 8l-4 1-2 3'],
    run: ['M19 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0z', 'M9 10l3.5-2.5 3.5 2 3-.5', 'M12.5 7.5L10 13l4.5 3-1.5 6', 'M10 13l-4 1.5-2.5 3.5', 'M6 5L3.5 8.5'],
  };
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#each PATHS[name] ?? [] as d, i (i)}<path {d} />{/each}
</svg>

<style>
  .icon { flex: none; display: block; }
</style>
```

- [ ] **Step 4: `AppHeader.svelte`**

Create `src/ui/components/AppHeader.svelte`:

```svelte
<script>
  import { LANGS } from '../../i18n/index.js';
  import { app, t, setLang, toggleMute } from '../controller.svelte.js';
  import Icon from './Icon.svelte';

  /** @type {{ subtitle: string, onback?: () => void }} */
  let { subtitle, onback } = $props();
</script>

<header class="app-header">
  {#if onback}
    <button class="icon-btn" onclick={onback} aria-label={t('workout.back')}><Icon name="back" /></button>
  {/if}
  <span class="logo"><Icon name="run" size={28} /></span>
  <div class="brand">
    <strong>{t('app.title')}</strong>
    <span>{subtitle}</span>
  </div>
  <div class="lang" role="group" aria-label={t('lang.label')}>
    {#each LANGS as lang (lang)}
      <button class:active={app.lang === lang} aria-pressed={app.lang === lang} onclick={() => setLang(lang)}>
        {lang.toUpperCase()}
      </button>
    {/each}
  </div>
  <button
    class="icon-btn"
    class:muted={app.muted}
    onclick={toggleMute}
    aria-pressed={app.muted}
    aria-label={t(app.muted ? 'header.unmute' : 'header.mute')}
  >
    <Icon name={app.muted ? 'speaker-off' : 'speaker'} />
  </button>
</header>

<style>
  .app-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: calc(12px + env(safe-area-inset-top)) 0 4px;
  }
  .icon-btn {
    flex: none;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 9999px;
    background: var(--surface-1);
    border: 1px solid var(--surface-2);
    color: var(--mint);
  }
  .icon-btn:first-child { color: var(--text); }
  .icon-btn.muted { color: var(--text-muted); }
  .logo { flex: none; display: grid; color: var(--mint); }
  .brand { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .brand strong, .brand span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .brand strong { font-family: var(--display-font); font-size: 20px; line-height: 1.15; }
  .brand span { font-size: 12px; color: var(--text-muted); }
  .lang {
    flex: none;
    display: flex;
    padding: 3px;
    border-radius: 9999px;
    background: var(--surface-1);
    border: 1px solid var(--surface-2);
  }
  .lang button {
    min-width: 36px;
    height: 36px;
    border-radius: 9999px;
    font-family: var(--display-font);
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
  }
  .lang button.active { background: var(--mint-soft); color: var(--mint); }
</style>
```

- [ ] **Step 5: `PhaseBar.svelte`**

Create `src/ui/components/PhaseBar.svelte`:

```svelte
<script>
  import { totalSeconds } from '../../core/plan.js';
  import { formatClock } from '../../core/timer.js';

  /**
   * @type {{
   *   workout: import('../../core/plan.js').Workout,
   *   currentIndex?: number,
   *   times?: boolean,
   *   thin?: boolean,
   * }}
   */
  let { workout, currentIndex = -1, times = false, thin = false } = $props();
  const total = $derived(totalSeconds(workout));
</script>

<div class="phase-bar" class:thin class:marked={currentIndex >= 0}>
  <div class="segments">
    {#each workout.phases as phase, i (i)}
      <span
        class="segment phase-{phase.type}"
        class:done={i < currentIndex}
        class:current={i === currentIndex}
        style:flex-grow={phase.seconds}
      ></span>
    {/each}
  </div>
  {#if times}
    <div class="times num">
      <span>00:00</span>
      <span>{formatClock(total * 500)}</span>
      <span>{formatClock(total * 1000)}</span>
    </div>
  {/if}
</div>

<style>
  .phase-bar.marked { padding-top: 12px; }
  .segments { display: flex; gap: 4px; height: 12px; }
  .thin .segments { height: 6px; }
  .segment { position: relative; flex-basis: 0; border-radius: var(--radius-sm); background: var(--phase); }
  .segment.done { opacity: 0.3; }
  .segment.current { box-shadow: 0 0 12px 0 var(--phase); }
  .segment.current::before {
    content: '';
    position: absolute;
    left: 50%;
    top: -12px;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: var(--text);
  }
  .times { display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: var(--text-muted); }
</style>
```

- [ ] **Step 6: `StatTile.svelte`**

Create `src/ui/components/StatTile.svelte`:

```svelte
<script>
  import Icon from './Icon.svelte';

  /**
   * @type {{
   *   label: string,
   *   value: string | number,
   *   unit?: string,
   *   caption?: string,
   *   icon?: string,
   *   tone?: 'walk' | 'jog' | 'run' | 'mint',
   * }}
   */
  let { label, value, unit = '', caption = '', icon = '', tone } = $props();
</script>

<div class="tile" style:--tone={tone ? `var(--${tone})` : 'var(--text)'}>
  <div class="head">
    <p class="label">{label}</p>
    {#if icon}<span class="icon"><Icon name={icon} size={20} /></span>{/if}
  </div>
  <p class="value num">{value}{#if unit}<span class="unit">{unit}</span>{/if}</p>
  {#if caption}<p class="caption">{caption}</p>{/if}
</div>

<style>
  .tile {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px;
    background: var(--surface-1);
    border: 1px solid var(--surface-2);
    border-radius: var(--radius);
  }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .icon { display: grid; color: var(--tone); }
  .value { margin: 0; font-size: 28px; font-weight: 700; line-height: 1; color: var(--tone); }
  .unit { margin-left: 4px; font-size: 14px; font-weight: 500; color: var(--text-muted); }
  .caption { margin: 0; font-size: 12px; color: var(--text-muted); }
</style>
```

- [ ] **Step 7: `ConfirmDialog.svelte`**

Create `src/ui/components/ConfirmDialog.svelte`:

```svelte
<script>
  /**
   * @type {{
   *   title: string,
   *   body: string,
   *   confirmLabel: string,
   *   cancelLabel: string,
   *   onconfirm: () => void,
   *   oncancel: () => void,
   *   danger?: boolean,
   * }}
   */
  let { title, body, confirmLabel, cancelLabel, onconfirm, oncancel, danger = false } = $props();
</script>

<div class="overlay">
  <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body">
    <h2 id="confirm-title">{title}</h2>
    <p id="confirm-body">{body}</p>
    <button class="btn" class:btn-primary={!danger} class:btn-danger={danger} onclick={onconfirm}>{confirmLabel}</button>
    <button class="btn btn-secondary" onclick={oncancel}>{cancelLabel}</button>
  </div>
</div>

<style>
  .btn-danger { background: var(--run); color: var(--text); }
  .btn-danger:active { background: var(--surface-0); color: var(--run); box-shadow: inset 0 0 0 2px var(--run); }
</style>
```

- [ ] **Step 8: Verify**

Run: `npm test`, then `npm run build`
Expected: both PASS. The build must show no Svelte warnings about the new components; if it does, fix them.

- [ ] **Step 9: Commit**

```bash
git add index.html public/manifest.webmanifest public/icon.svg src/app.css src/ui/components/Icon.svelte src/ui/components/AppHeader.svelte src/ui/components/PhaseBar.svelte src/ui/components/StatTile.svelte src/ui/components/ConfirmDialog.svelte
git commit -m "feat: add PulseRun design tokens, brand and shared components"
```

---

### Task 7: Plan screen

**Files:**
- Create: `src/ui/components/WeekAccordion.svelte`
- Modify: `src/ui/PlanScreen.svelte` (full replacement), `src/ui/components/ResumeDialog.svelte` (full replacement)
- Modify: `src/app.css` (delete the legacy `/* Plan */` block)

**Interfaces:**
- Consumes:
  - `programStats`, `nextWorkout`, `isDone` from core
  - `app`, `t`, `openWorkout`, `workoutMinutes`, `phaseShorthand`, `acceptResume`, `discardResume` from the controller
  - `AppHeader`, `PhaseBar`, `Icon`, `ConfirmDialog`
- Produces: `<WeekAccordion week workouts nextId currentWeek />`

- [ ] **Step 1: `WeekAccordion.svelte`**

```svelte
<script>
  import { untrack } from 'svelte';
  import { isDone } from '../../core/progress.js';
  import { app, t, openWorkout, workoutMinutes, phaseShorthand } from '../controller.svelte.js';
  import Icon from './Icon.svelte';

  /**
   * @type {{
   *   week: number,
   *   workouts: import('../../core/plan.js').Workout[],
   *   nextId: string | null,
   *   currentWeek: number | null,
   * }}
   * currentWeek is null once the whole program is done.
   */
  let { week, workouts, nextId, currentWeek } = $props();

  // Only the initial state follows the current week; the user toggles after that.
  let open = $state(untrack(() => week === currentWeek));
  const doneCount = $derived(workouts.filter((w) => isDone(app.progress, w.id)).length);
  const allDone = $derived(doneCount === workouts.length);
  const isCurrent = $derived(week === currentWeek);
  const locked = $derived(currentWeek !== null && week > currentWeek);
</script>

<section class="week" class:current={isCurrent}>
  <button class="week-head" aria-expanded={open} onclick={() => (open = !open)}>
    <span class="badge num" class:done={allDone} class:current={isCurrent && !allDone}>
      {#if allDone}<Icon name="check" size={20} />{:else if locked}<Icon name="lock" size={18} />{:else}{week}{/if}
    </span>
    <span class="week-text">
      <span class="week-title">{t('plan.week', { week })}: {t(`week.${week}.title`)}</span>
      <span class="week-sub" class:live={isCurrent}>
        {isCurrent ? t('plan.inProgress') : t(`week.${week}.subtitle`)}
      </span>
    </span>
    <span class="count num">{doneCount}/{workouts.length}</span>
    <span class="chevron" class:open><Icon name="chevron" size={20} /></span>
  </button>

  {#if open}
    <ul class="days">
      {#each workouts as workout (workout.id)}
        {@const done = isDone(app.progress, workout.id)}
        {@const isNext = workout.id === nextId}
        <li>
          <button class="day" class:next={isNext} onclick={() => openWorkout(workout.id)}>
            <span class="status" class:done class:next={isNext}>
              <Icon name={done ? 'check' : isNext ? 'play' : 'circle'} size={18} />
            </span>
            <span class="day-text">
              <span class="day-title">{t('plan.day', { day: workout.day })}</span>
              <span class="day-meta num">{t('workout.total', { value: workoutMinutes(workout) })} • {phaseShorthand(workout)}</span>
            </span>
            <span class="day-state" class:done class:next={isNext}>
              {done ? t('plan.done') : isNext ? t('plan.current') : t('plan.waiting')}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .week { background: var(--surface-1); border: 1px solid var(--surface-2); border-radius: var(--radius); overflow: hidden; }
  .week.current { border-color: var(--mint); box-shadow: 0 0 24px -4px var(--mint-glow); }
  .week-head { width: 100%; min-height: 72px; display: flex; align-items: center; gap: 12px; padding: 12px 16px; text-align: left; }
  .badge {
    flex: none;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 9999px;
    background: var(--surface-2);
    color: var(--text-muted);
    font-size: 18px;
    font-weight: 700;
  }
  .badge.done { background: var(--mint-soft); color: var(--mint); }
  .badge.current { background: var(--mint); color: var(--on-mint); }
  .week-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .week-title, .week-sub { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .week-title { font-family: var(--display-font); font-size: 17px; font-weight: 700; }
  .week-sub { font-size: 13px; color: var(--text-muted); }
  .week-sub.live { color: var(--mint); font-weight: 600; }
  .count { flex: none; font-size: 13px; color: var(--text-muted); }
  .chevron { flex: none; display: grid; color: var(--text-muted); transition: transform 0.2s; }
  .chevron.open { transform: rotate(180deg); }
  .days { list-style: none; margin: 0; padding: 0 12px 12px; display: grid; gap: 8px; }
  .day {
    width: 100%;
    min-height: 60px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--surface-2);
    text-align: left;
  }
  .day.next { box-shadow: inset 0 0 0 1px var(--mint); }
  .status { flex: none; display: grid; color: var(--text-muted); }
  .status.done, .status.next { color: var(--mint); }
  .day-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .day-title { font-weight: 600; }
  .day-meta { font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .day-state { flex: none; font-family: var(--display-font); font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); }
  .day-state.done, .day-state.next { color: var(--mint); }
</style>
```

- [ ] **Step 2: `ResumeDialog.svelte`**

```svelte
<script>
  import { findWorkout } from '../../core/plan.js';
  import { app, t, acceptResume, discardResume } from '../controller.svelte.js';
  import ConfirmDialog from './ConfirmDialog.svelte';

  const workout = $derived(findWorkout(app.pendingResume.workoutId));
</script>

<ConfirmDialog
  title={t('resume.title')}
  body={t('resume.text', { week: workout.week, day: workout.day })}
  confirmLabel={t('resume.resume')}
  cancelLabel={t('resume.discard')}
  onconfirm={acceptResume}
  oncancel={discardResume}
/>
```

- [ ] **Step 3: `PlanScreen.svelte`**

```svelte
<script>
  import { PLAN, groupByWeek } from '../core/plan.js';
  import { nextWorkout, programStats } from '../core/progress.js';
  import { app, t, openWorkout, workoutMinutes, phaseShorthand } from './controller.svelte.js';
  import AppHeader from './components/AppHeader.svelte';
  import Icon from './components/Icon.svelte';
  import PhaseBar from './components/PhaseBar.svelte';
  import WeekAccordion from './components/WeekAccordion.svelte';
  import ResumeDialog from './components/ResumeDialog.svelte';

  const RING_RADIUS = 34;
  const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

  const weeks = groupByWeek(PLAN);
  const next = $derived(nextWorkout(PLAN, app.progress));
  const stats = $derived(programStats(PLAN, app.progress));
</script>

<div class="screen">
  <AppHeader subtitle={t('app.subtitle')} />

  <section class="card progress">
    <div class="ring">
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle class="track" cx="40" cy="40" r={RING_RADIUS} />
        <circle
          class="fill"
          cx="40"
          cy="40"
          r={RING_RADIUS}
          stroke-dasharray={RING_LENGTH}
          stroke-dashoffset={RING_LENGTH * (1 - stats.percent / 100)}
        />
      </svg>
      <span class="ring-value num">{stats.percent}%</span>
    </div>
    <div class="progress-body">
      <p class="label">{t('plan.progressLabel')}</p>
      <p class="done num">{stats.done}<span> / {stats.total}</span></p>
      <p class="label">{t('plan.workoutsDone')}</p>
      <div class="pair">
        <div>
          <p class="label">{t('plan.totalTime')}</p>
          <p class="value num">{t('workout.total', { value: stats.doneMinutes })}</p>
        </div>
        <div>
          <p class="label">{t('plan.currentWeek')}</p>
          <p class="value num">{t('plan.weekOf', { week: stats.currentWeek, total: weeks.length })}</p>
        </div>
      </div>
    </div>
  </section>

  {#if next}
    <section class="card next">
      <div class="next-head">
        <span class="tag">{t('plan.next')}</span>
        <span class="chip"><Icon name="timer" size={14} />{t('workout.total', { value: workoutMinutes(next) })}</span>
      </div>
      <h2 class="next-title">{t('common.weekDay', { week: next.week, day: next.day })}</h2>
      <p class="shorthand num">{phaseShorthand(next)}</p>
      <PhaseBar workout={next} thin />
      <button class="btn btn-primary" onclick={() => openWorkout(next.id)}>
        <Icon name="play" />{t('plan.start', { week: next.week, day: next.day })}
      </button>
    </section>
  {:else}
    <section class="card next all-done">
      <Icon name="trophy" size={32} />
      <h2 class="next-title">{t('plan.allDone')}</h2>
    </section>
  {/if}

  <div class="section-head">
    <h2>{t('plan.cycle')}</h2>
    <span class="label">{t('plan.perWeek')}</span>
  </div>

  {#each weeks as { week, workouts } (week)}
    <WeekAccordion {week} {workouts} nextId={next?.id ?? null} currentWeek={next ? stats.currentWeek : null} />
  {/each}

  <section class="card goal">
    <span class="goal-icon"><Icon name="flag" /></span>
    <div>
      <h3>{t('plan.goalTitle')}</h3>
      <p>{t('plan.goalText')}</p>
    </div>
  </section>

  {#if app.pendingResume}<ResumeDialog />{/if}
</div>

<style>
  .progress { display: flex; align-items: center; gap: 20px; }
  .ring { position: relative; flex: none; width: 96px; height: 96px; }
  .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .ring circle { fill: none; stroke-width: 8; }
  .track { stroke: var(--surface-3); }
  .fill { stroke: var(--mint); stroke-linecap: round; transition: stroke-dashoffset 0.4s; }
  .ring-value { position: absolute; inset: 0; display: grid; place-items: center; font-size: 22px; font-weight: 700; }
  .progress-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .done { margin: 0; font-size: 32px; font-weight: 700; line-height: 1; color: var(--mint); }
  .done span { font-size: 18px; color: var(--text-muted); }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
  .value { margin: 2px 0 0; font-size: 16px; font-weight: 700; }

  .next { display: flex; flex-direction: column; gap: 12px; border-color: var(--mint); box-shadow: 0 0 24px -4px var(--mint-glow); }
  .next-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .next-title { margin: 0; font-family: var(--display-font); font-size: 28px; font-weight: 700; line-height: 1.1; }
  .shorthand { margin: 0; font-size: 13px; color: var(--text-muted); }
  .all-done { align-items: center; text-align: center; color: var(--mint); }

  .section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-top: 8px; }
  .section-head h2 { margin: 0; font-family: var(--display-font); font-size: 20px; }

  .goal { display: flex; gap: 14px; align-items: flex-start; }
  .goal-icon { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: var(--mint-soft); color: var(--mint); }
  .goal h3 { margin: 0 0 4px; font-family: var(--display-font); font-size: 16px; }
  .goal p { margin: 0; font-size: 14px; line-height: 1.45; color: var(--text-muted); }
</style>
```

- [ ] **Step 4: Remove the legacy Plan CSS**

In `src/app.css`, delete the whole `/* Plan */` block (`.plan-header` through `.check`). Also, in the legacy `/* Run */` block, change the selector `.current {` to `.run .current {`. Otherwise the old global rule would turn `WeekAccordion`'s `.week.current` into a centred flex column. Task 9 deletes it entirely.

- [ ] **Step 5: Verify**

Run: `npm test`, then `npm run build`
Expected: both PASS with no Svelte warnings.

- [ ] **Step 6: Commit**

```bash
git add src/ui/PlanScreen.svelte src/ui/components/WeekAccordion.svelte src/ui/components/ResumeDialog.svelte src/app.css
git commit -m "feat: redesign plan screen with progress, next workout and week accordions"
```

The controller then checks the page in the browser at 390 px and 360 px, in PT and EN, with empty, partial and complete progress, and confirms `document.documentElement.scrollWidth <= innerWidth`.

---

### Task 8: Workout detail screen

**Files:**
- Modify: `src/ui/WorkoutScreen.svelte` (full replacement)
- Modify: `src/app.css` (delete the legacy `/* Workout */` block, except `.phase-icon`, `.phase-icon.big`, `.done-note` and `.bottom`, which stay until Task 10)

**Interfaces:**
- Consumes:
  - `findWorkout`, `totalSeconds`, `phaseSeconds`, `phaseRole` from core; `formatClock`
  - controller `app`, `t`, `formatDate`, `goToPlan`, `startWorkout`, `unmarkWorkout`, `workoutMinutes`
  - `AppHeader`, `Icon`, `PhaseBar`, `StatTile`

- [ ] **Step 1: `WorkoutScreen.svelte`**

```svelte
<script>
  import { findWorkout, totalSeconds, phaseSeconds, phaseRole } from '../core/plan.js';
  import { formatClock } from '../core/timer.js';
  import {
    app, t, formatDate, goToPlan, startWorkout, unmarkWorkout, workoutMinutes,
  } from './controller.svelte.js';
  import AppHeader from './components/AppHeader.svelte';
  import Icon from './components/Icon.svelte';
  import PhaseBar from './components/PhaseBar.svelte';
  import StatTile from './components/StatTile.svelte';

  /** @type {('walk' | 'jog' | 'run')[]} */
  const TYPES = ['walk', 'jog', 'run'];

  const workout = $derived(findWorkout(app.workoutId));
  const completedAt = $derived(app.progress.completed[app.workoutId]);
  const totals = $derived(phaseSeconds(workout));
  const total = $derived(totalSeconds(workout));
  const weekDay = $derived(t('common.weekDay', { week: workout.week, day: workout.day }));
</script>

<div class="screen">
  <AppHeader subtitle={weekDay} onback={goToPlan} />

  <section class="card hero">
    <div class="hero-tags">
      <span class="tag">{weekDay}</span>
      <span class="chip"><Icon name="timer" size={14} />{t('workout.total', { value: workoutMinutes(workout) })}</span>
    </div>
    <h1>{t('workout.heading')}</h1>
    <p>{t(`week.${workout.week}.title`)} • {t(`week.${workout.week}.subtitle`)}</p>
  </section>

  <div class="totals">
    {#each TYPES as type (type)}
      <StatTile
        label={t(`phase.${type}`)}
        value={Math.round(totals[type] / 60)}
        unit={t('unit.min')}
        caption={t('workout.ofVolume', { percent: Math.round((totals[type] / total) * 100) })}
        tone={type}
      />
    {/each}
  </div>

  <section class="card timeline">
    <div class="row">
      <h2 class="section-title">{t('workout.timeline')}</h2>
      <span class="label">{t('workout.phaseCount', { count: workout.phases.length })}</span>
    </div>
    <PhaseBar {workout} times />
  </section>

  <h2 class="section-title">{t('workout.phasesTitle')}</h2>
  <ol class="phases">
    {#each workout.phases as phase, i (i)}
      {@const role = phaseRole(workout, i)}
      <li class="phase phase-{phase.type}">
        <span class="phase-badge"><Icon name={phase.type} size={26} /></span>
        <div class="phase-text">
          <p class="phase-label">{t('workout.phaseLabel', { n: i + 1, role: t(`role.${role}`) })}</p>
          <p class="phase-name">{t(`phase.${phase.type}`)}</p>
          <p class="phase-tip">{t(`tip.${role}`)}</p>
        </div>
        <div class="phase-side">
          <p class="phase-time num">{formatClock(phase.seconds * 1000)}</p>
          <span class="chip">{t(`pace.${phase.type}`)}</span>
        </div>
      </li>
    {/each}
  </ol>

  <section class="card note">
    <span class="note-icon"><Icon name="bolt" size={20} /></span>
    <div>
      <p class="label mint">{t('workout.tipTitle')}</p>
      <p>{t('workout.tipText')}</p>
    </div>
  </section>

  <section class="card note" class:off={app.muted}>
    <span class="note-icon"><Icon name={app.muted ? 'speaker-off' : 'speaker'} size={20} /></span>
    <p>{t(app.muted ? 'workout.voiceOff' : 'workout.voiceOn')}</p>
  </section>

  {#if completedAt}
    <p class="completed">
      <Icon name="check" size={16} />{t('workout.done', { date: formatDate(completedAt) })}
      <button class="btn-link" onclick={() => unmarkWorkout(workout.id)}>{t('workout.unmark')}</button>
    </p>
  {/if}

  <div class="sticky">
    <button class="btn btn-primary" onclick={startWorkout}><Icon name="play" />{t('workout.start')}</button>
  </div>
</div>

<style>
  .hero { display: flex; flex-direction: column; gap: 10px; background: linear-gradient(135deg, var(--surface-2), var(--surface-1)); }
  .hero-tags { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .hero h1 { margin: 0; font-family: var(--display-font); font-size: 30px; font-weight: 700; line-height: 1.1; }
  .hero p { margin: 0; font-size: 14px; color: var(--text-muted); }
  .totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .timeline { display: flex; flex-direction: column; gap: 14px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .section-title { margin: 0; font-family: var(--display-font); font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .phases { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .phase {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: var(--radius);
    background: var(--surface-1);
    border: 1px solid var(--surface-2);
    border-left: 4px solid var(--phase);
  }
  .phase-badge { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--surface-2); color: var(--phase); }
  .phase-text { flex: 1; min-width: 0; }
  .phase-text p { margin: 0; }
  .phase-label { font-family: var(--display-font); font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--phase); }
  .phase-name { font-family: var(--display-font); font-size: 22px; font-weight: 700; text-transform: uppercase; line-height: 1.15; }
  .phase-tip { font-size: 13px; color: var(--text-muted); }
  .phase-side { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  .phase-time { margin: 0; font-size: 24px; font-weight: 700; color: var(--phase); }
  .note { display: flex; gap: 12px; align-items: flex-start; }
  .note p { margin: 0; font-size: 14px; line-height: 1.45; }
  .note .label.mint { color: var(--mint); margin-bottom: 4px; }
  .note-icon { flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: var(--mint-soft); color: var(--mint); }
  .note.off .note-icon { background: var(--surface-2); color: var(--text-muted); }
  .completed { display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap; margin: 0; color: var(--mint); font-size: 14px; }
  .sticky {
    position: sticky;
    bottom: 0;
    margin-top: auto;
    padding: 12px 0 calc(8px + env(safe-area-inset-bottom));
    background: linear-gradient(to bottom, transparent, var(--surface-0) 35%);
  }
</style>
```

- [ ] **Step 2: Remove the legacy Workout CSS**

In `src/app.css`, delete from `/* Workout */` through `.phases li:last-child`, `.phase-name` and `.phase-time`, keeping `.done-note`, `.bottom`, `.phase-icon` and `.phase-icon.big`. Also delete `.back`, `.title`, `.subtitle` and `.total`. Note that the new `.phase-name` is scoped, so removing the global one is required to avoid conflicts.

- [ ] **Step 3: Verify**

Run: `npm test`, then `npm run build`
Expected: both PASS with no warnings.

- [ ] **Step 4: Commit**

```bash
git add src/ui/WorkoutScreen.svelte src/app.css
git commit -m "feat: redesign workout detail with totals, timeline and phase roles"
```

The controller then checks w2d2 and w4d2 (7 phases), done and not done, muted and unmuted, at 360 px.

---

### Task 9: Run screen

**Files:**
- Modify: `src/ui/RunScreen.svelte` (full replacement)
- Modify: `src/app.css` (delete the legacy `/* Run */` block)

**Interfaces:**
- Consumes:
  - `findWorkout`, `totalSeconds`, `getState`, `formatClock` from core
  - controller `app`, `t`, `pause`, `resume`, `skip`, `stop`, `requestStop`, `cancelStop`
  - `AppHeader`, `Icon`, `PhaseBar`, `StatTile`, `ConfirmDialog`

- [ ] **Step 1: `RunScreen.svelte`**

```svelte
<script>
  import { findWorkout, totalSeconds } from '../core/plan.js';
  import { getState, formatClock } from '../core/timer.js';
  import { app, t, pause, resume, skip, stop, requestStop, cancelStop } from './controller.svelte.js';
  import AppHeader from './components/AppHeader.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import Icon from './components/Icon.svelte';
  import PhaseBar from './components/PhaseBar.svelte';
  import StatTile from './components/StatTile.svelte';

  const workout = $derived(app.session ? findWorkout(app.session.workoutId) : null);
  const state = $derived(workout ? getState(app.session, workout, app.now) : null);
  const phase = $derived(state ? workout.phases[state.phaseIndex] : null);
  const nextPhase = $derived(state ? workout.phases[state.phaseIndex + 1] : null);
</script>

{#if state}
  <div class="screen run phase-{phase.type}">
    <AppHeader subtitle={t('common.weekDay', { week: workout.week, day: workout.day })} onback={requestStop} />

    <div class="status">
      <span class="chip">{t('common.shortWeekDay', { week: workout.week, day: workout.day })}</span>
      <span class="chip" class:on={!app.muted}>
        <Icon name={app.muted ? 'speaker-off' : 'speaker'} size={14} />{t(app.muted ? 'run.voiceOff' : 'run.voiceOn')}
      </span>
      {#if app.wakeLockActive}
        <span class="chip on"><Icon name="bolt" size={14} />{t('run.screenOn')}</span>
      {/if}
    </div>

    <section class="card timeline">
      <div class="row">
        <span class="label phase-of">{t('run.phaseOf', { n: state.phaseIndex + 1, total: workout.phases.length })}</span>
        <span class="num elapsed">{formatClock(state.elapsedMs)} / {formatClock(totalSeconds(workout) * 1000)}</span>
      </div>
      <PhaseBar {workout} currentIndex={state.phaseIndex} />
    </section>

    <section class="card main" class:paused={state.paused}>
      <div class="phase-head">
        <span class="phase-badge"><Icon name={phase.type} size={30} /></span>
        <h1 class="phase-title">{t(`phase.${phase.type}`)}</h1>
      </div>
      <p class="countdown num">{formatClock(state.phaseRemainingMs)}</p>
      {#if state.paused}<p class="paused-label">{t('run.paused')}</p>{/if}
      <p class="next">
        {nextPhase
          ? t('run.next', { phase: t(`phase.${nextPhase.type}`), time: formatClock(nextPhase.seconds * 1000) })
          : t('run.last')}
      </p>
    </section>

    <div class="tiles">
      <StatTile label={t('run.remainingTotal')} value={formatClock(state.totalRemainingMs)} icon="timer" />
      <StatTile
        label={t('run.phasesDone')}
        value={state.phaseIndex}
        unit={t('common.of', { total: workout.phases.length })}
        icon="check"
        tone="mint"
      />
    </div>

    {#if !app.audioAvailable}<p class="notice">{t('run.noAudio')}</p>{/if}

    <div class="controls">
      <button class="ctl" onclick={skip}><Icon name="skip" /><span>{t('run.skip')}</span></button>
      {#if state.paused}
        <button class="btn btn-primary" onclick={resume}><Icon name="play" />{t('run.resume')}</button>
      {:else}
        <button class="btn btn-primary" onclick={pause}><Icon name="pause" />{t('run.pause')}</button>
      {/if}
      <button class="ctl stop" onclick={requestStop}><Icon name="stop" /><span>{t('run.stop')}</span></button>
    </div>

    {#if app.confirmingStop}
      <ConfirmDialog
        title={t('run.stopTitle')}
        body={t('run.stopBody')}
        confirmLabel={t('run.stop')}
        cancelLabel={t('run.stopKeep')}
        onconfirm={stop}
        oncancel={cancelStop}
        danger
      />
    {/if}
  </div>
{/if}

<style>
  .status { display: flex; flex-wrap: wrap; gap: 8px; }
  .status .chip.on { color: var(--mint); }
  .timeline { display: flex; flex-direction: column; gap: 10px; padding: 16px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .phase-of { color: var(--phase); }
  .elapsed { font-size: 13px; color: var(--text-muted); }
  .main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
    border-color: var(--phase);
    box-shadow: 0 0 24px -4px color-mix(in srgb, var(--phase) 40%, transparent);
  }
  .phase-head { display: flex; align-items: center; gap: 12px; }
  .phase-badge { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 12px; background: color-mix(in srgb, var(--phase) 18%, transparent); color: var(--phase); }
  .phase-title { margin: 0; font-family: var(--display-font); font-size: 34px; font-weight: 700; text-transform: uppercase; color: var(--phase); }
  .countdown { margin: 0; font-size: clamp(64px, 24vw, 96px); font-weight: 700; line-height: 1; letter-spacing: -0.03em; }
  .main.paused .countdown { opacity: 0.5; }
  .paused-label { margin: 0; font-family: var(--display-font); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--jog); }
  .next { margin: 4px 0 0; font-size: 16px; color: var(--text-muted); }
  .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .notice { margin: 0; padding: 10px 14px; border-radius: 12px; background: var(--surface-2); color: var(--jog); font-size: 14px; }
  .controls { margin-top: auto; display: grid; grid-template-columns: 1fr 2fr 1fr; gap: var(--gap); align-items: stretch; }
  .ctl {
    min-height: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border-radius: var(--radius);
    background: var(--surface-1);
    box-shadow: inset 0 0 0 1.5px var(--surface-3);
    font-family: var(--display-font);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .ctl:active { background: var(--text); color: var(--surface-0); }
  .ctl.stop { color: var(--run); }
</style>
```

- [ ] **Step 2: Remove the legacy Run CSS**

In `src/app.css`, delete the whole `/* Run */` block (`.run` through `.run .danger`).

- [ ] **Step 3: Verify**

Run: `npm test`, then `npm run build`
Expected: both PASS with no warnings.

- [ ] **Step 4: Commit**

```bash
git add src/ui/RunScreen.svelte src/app.css
git commit -m "feat: redesign run screen with segmented bar, big timer and stop dialog"
```

The controller then runs these manual checks:
- walk, jog and run phases
- paused
- last phase
- stop dialog open, then cancel, then confirm
- Review Focus #3: open the stop dialog near the end of the last phase and let the run finish. The dialog must be gone and Finished must show.
- Review Focus #4: pause, toggle mute, then resume. No beeps, and the voice chip reads "Mudo".
- at 360 px

---

### Task 10: Finished screen and cleanup

**Files:**
- Modify: `src/ui/FinishedScreen.svelte` (full replacement)
- Delete: `src/ui/components/PhaseIcon.svelte`
- Modify: `src/app.css` (delete the legacy aliases and all remaining legacy rules)
- Modify: `src/i18n/pt.js`, `src/i18n/en.js` (delete keys marked `// legacy`)

**Interfaces:**
- Consumes:
  - `PLAN`, `findWorkout`, `phaseSeconds`, `nextWorkout`, `programStats` from core
  - controller `app`, `t`, `goToPlan`, `openWorkout`, `unmarkWorkout`, `shareResult`, `workoutMinutes`, `phaseShorthand`
  - `AppHeader`, `Icon`, `StatTile`

- [ ] **Step 1: `FinishedScreen.svelte`**

```svelte
<script>
  import { PLAN, findWorkout, phaseSeconds } from '../core/plan.js';
  import { nextWorkout, programStats } from '../core/progress.js';
  import {
    app, t, goToPlan, openWorkout, unmarkWorkout, shareResult, workoutMinutes, phaseShorthand,
  } from './controller.svelte.js';
  import AppHeader from './components/AppHeader.svelte';
  import Icon from './components/Icon.svelte';
  import StatTile from './components/StatTile.svelte';

  const workout = $derived(findWorkout(app.workoutId));
  const stats = $derived(programStats(PLAN, app.progress));
  const next = $derived(nextWorkout(PLAN, app.progress));

  function unmarkThis() {
    unmarkWorkout(workout.id);
    openWorkout(workout.id);
  }
</script>

{#if workout}
  <div class="screen">
    <AppHeader subtitle={t('common.weekDay', { week: workout.week, day: workout.day })} />

    <section class="card hero">
      <div class="trophy">
        <Icon name="trophy" size={40} />
        <span class="badge"><Icon name="check" size={16} /></span>
      </div>
      <span class="tag">{t('finished.badge')}</span>
      <h1>{t('finished.title')}</h1>
      <p>{t('finished.subtitle', { week: workout.week, day: workout.day })}</p>
    </section>

    <div class="grid">
      <StatTile label={t('finished.totalTime')} value={workoutMinutes(workout)} unit={t('unit.min')} icon="timer" tone="mint" />
      <StatTile
        label={t('finished.phases')}
        value={workout.phases.length}
        unit={t('common.of', { total: workout.phases.length })}
        icon="check"
      />
      <StatTile
        label={t('finished.runTime')}
        value={Math.round(phaseSeconds(workout).run / 60)}
        unit={t('unit.min')}
        icon="run"
        tone="run"
      />
      <StatTile label={t('finished.overall')} value={stats.done} unit={t('common.of', { total: stats.total })} icon="flag" />
    </div>

    <section class="card program">
      <div class="row">
        <span class="label">{t('finished.programProgress', { done: stats.done, total: stats.total })}</span>
        <span class="num pct">{stats.percent}%</span>
      </div>
      <div class="bar"><div class="bar-fill" style:width="{stats.percent}%"></div></div>
    </section>

    <section class="card next-step">
      <p class="label">{t('finished.nextStep')}</p>
      {#if next}
        <button class="next-card" onclick={() => openWorkout(next.id)}>
          <span class="next-icon"><Icon name="calendar" /></span>
          <span class="next-text">
            <strong>{t('common.weekDay', { week: next.week, day: next.day })}</strong>
            <span class="num">{t('workout.total', { value: workoutMinutes(next) })} • {phaseShorthand(next)}</span>
          </span>
          <Icon name="chevron" size={20} />
        </button>
      {:else}
        <p class="all-done">{t('plan.allDone')}</p>
      {/if}
    </section>

    <div class="actions">
      <button class="btn btn-primary" onclick={goToPlan}>{t('finished.back')}<Icon name="back" size={20} /></button>
      {#if app.canShare}
        <button class="btn btn-secondary" onclick={shareResult}><Icon name="share" size={20} />{t('finished.share')}</button>
      {/if}
      <button class="btn-link" onclick={unmarkThis}>{t('finished.unmark')}</button>
    </div>
  </div>
{/if}

<style>
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
    background: radial-gradient(circle at 50% 0%, rgb(16 244 156 / 0.14), var(--surface-1) 70%);
  }
  .trophy {
    position: relative;
    display: grid;
    place-items: center;
    width: 88px;
    height: 88px;
    border-radius: 9999px;
    background: var(--surface-2);
    color: var(--mint);
    box-shadow: 0 0 0 12px rgb(16 244 156 / 0.08);
  }
  .badge {
    position: absolute;
    right: -2px;
    bottom: -2px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 9999px;
    background: var(--mint);
    color: var(--on-mint);
  }
  .hero h1 { margin: 0; font-family: var(--display-font); font-size: 30px; font-weight: 700; line-height: 1.15; }
  .hero p { margin: 0; font-size: 14px; color: var(--text-muted); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .program { display: flex; flex-direction: column; gap: 10px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .pct { color: var(--mint); font-weight: 700; }
  .bar { height: 8px; border-radius: 9999px; background: var(--surface-3); overflow: hidden; }
  .bar-fill { height: 100%; background: var(--mint); border-radius: 9999px; }
  .next-step { display: flex; flex-direction: column; gap: 10px; }
  .next-card { display: flex; align-items: center; gap: 12px; min-height: 60px; text-align: left; }
  .next-icon { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--surface-2); color: var(--walk); }
  .next-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .next-text strong { font-family: var(--display-font); font-size: 18px; }
  .next-text span { font-size: 13px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .all-done { margin: 0; color: var(--mint); font-weight: 600; }
  .actions { display: flex; flex-direction: column; gap: 12px; margin-top: auto; }
  .actions .btn-primary :global(.icon) { transform: rotate(180deg); }
</style>
```

- [ ] **Step 2: Delete `PhaseIcon.svelte` and the legacy CSS**

Run: `git rm src/ui/components/PhaseIcon.svelte`

In `src/app.css`, delete:
- the `/* Legacy aliases ... */` comment and the eight alias variables in `:root`
- everything from `/* ---------- Legacy screen styles` to the end of the file (`.primary`, `.secondary`, `.link`, `.danger`, any remaining `.done-note`, `.bottom`, `.phase-icon` rules, and the `/* Finished */` block)

Then confirm nothing still uses them:

Run: `grep -rnE "var\(--(bg|surface|muted|accent|primary|separator|danger|heading-font)\)|class=\"(primary|secondary|link)\b|PhaseIcon" src`
Expected: no output. (`--surface-0..3` do not match, because the pattern requires `)` straight after the name.)

- [ ] **Step 3: Delete the legacy i18n keys**

Remove the lines marked `// legacy` from both `src/i18n/pt.js` and `src/i18n/en.js`: `lang.switch`, `plan.continue`, `run.remaining` and `run.stopConfirm`.

Run: `grep -rnE "lang\.switch|plan\.continue|run\.remaining'|run\.stopConfirm" src`
Expected: no output.

- [ ] **Step 4: Verify**

Run: `npm test`, then `npm run build`
Expected: both PASS with no warnings.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: redesign finished screen with stats, next step and share; remove legacy styles"
```

The controller then checks Finished with a next workout and with the program complete (15/15), checks the share fallback toast (the desktop browser has no `navigator.share`), runs Unmark (which lands on Workout detail), and does a full 360 px pass on every screen in both languages.
