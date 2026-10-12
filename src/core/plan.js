/** @typedef {'walk' | 'jog' | 'run'} PhaseType */
/** @typedef {{ type: PhaseType, seconds: number }} Phase */
/** @typedef {{ id: string, week: number, day: number, phases: Phase[] }} Workout */

/** @param {number} seconds @returns {Phase} */
const walk = (seconds) => ({ type: 'walk', seconds });
/** @param {number} seconds @returns {Phase} */
const run = (seconds) => ({ type: 'run', seconds });

/** @returns {Workout} */
function workout(week, day, phases) {
  return { id: `w${week}d${day}`, week, day, phases };
}

/**
 * A run day: a 5-minute walk, `repeats` times (run, walk), then a 5-minute
 * walk. The last interval walk and the cool-down are one phase so the coach
 * does not announce two walks back to back.
 * @returns {Phase[]}
 */
function intervals(runMinutes, walkMinutes, repeats) {
  const phases = [walk(5 * 60)];
  for (let i = 0; i < repeats; i++) phases.push(run(runMinutes * 60), walk(walkMinutes * 60));
  phases[phases.length - 1] = walk((walkMinutes + 5) * 60);
  return phases;
}

/** A brisk-walk day. @returns {Phase[]} */
const briskWalk = (minutes) => [walk(minutes * 60)];

/** Days 1, 3 and 5 run, days 2 and 4 walk. @returns {Workout[]} */
function week(number, runDay, walkDay) {
  return [runDay, walkDay, runDay, walkDay, runDay].map((phases, i) => workout(number, i + 1, phases));
}

// Transcribed from the schedule the user supplied on 2026-10-12.
/** @type {Workout[]} */
export const PLAN = [
  ...week(1, intervals(3, 2, 5), briskWalk(30)),
  ...week(2, intervals(4, 2, 5), briskWalk(30)),
  ...week(3, intervals(5, 2, 5), briskWalk(40)),
  ...week(4, intervals(7, 2, 4), briskWalk(45)),
  ...week(5, intervals(10, 2, 3), briskWalk(50)),
];

/** @param {string} id @returns {Workout | null} */
export function findWorkout(id) {
  return PLAN.find((w) => w.id === id) ?? null;
}

/** @param {Workout} workout */
export function totalSeconds(workout) {
  return workout.phases.reduce((sum, phase) => sum + phase.seconds, 0);
}

/** @param {Workout[]} plan @returns {{ week: number, workouts: Workout[] }[]} */
export function groupByWeek(plan) {
  const weeks = [];
  for (const w of plan) {
    const last = weeks.at(-1);
    if (last?.week === w.week) last.workouts.push(w);
    else weeks.push({ week: w.week, workouts: [w] });
  }
  return weeks;
}

/** @param {Workout} workout @returns {Record<PhaseType, number>} seconds per phase type */
export function phaseSeconds(workout) {
  const totals = { walk: 0, jog: 0, run: 0 };
  for (const phase of workout.phases) totals[phase.type] += phase.seconds;
  return totals;
}

/** @typedef {'warmup' | 'build' | 'recovery' | 'cooldown' | 'finale' | 'brisk'} PhaseRole */

/** What a phase is for, used for labels and tips. @param {Workout} workout @returns {PhaseRole} */
export function phaseRole(workout, index) {
  const phase = workout.phases[index];
  const isLast = index === workout.phases.length - 1;
  if (index === 0) return isLast && phase.type === 'walk' ? 'brisk' : 'warmup';
  if (isLast) return phase.type === 'walk' ? 'cooldown' : phase.type === 'run' ? 'finale' : 'build';
  return phase.type === 'walk' ? 'recovery' : 'build';
}

/**
 * The repeating part of a run day ("3 min running, 2 min walking, 5 times"),
 * or null when the workout is not walk, (run, walk)×n, walk with even intervals.
 * @param {Workout} workout
 * @returns {{ repeats: number, runSeconds: number, walkSeconds: number } | null}
 */
export function intervalPattern(workout) {
  const { phases } = workout;
  if (phases.length < 5 || phases[0].type !== 'walk' || phases.at(-1).type !== 'walk') return null;
  const middle = phases.slice(1, -1); // run, walk, run, …, run
  const [run, walk] = middle;
  const even = middle.every((phase, i) => (i % 2 === 0
    ? phase.type === 'run' && phase.seconds === run.seconds
    : phase.type === 'walk' && phase.seconds === walk.seconds));
  if (!even || middle.length % 2 === 0) return null;
  return { repeats: (middle.length + 1) / 2, runSeconds: run.seconds, walkSeconds: walk.seconds };
}
