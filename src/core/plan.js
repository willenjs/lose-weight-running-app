/** @typedef {'walk' | 'jog' | 'run'} PhaseType */
/** @typedef {{ type: PhaseType, seconds: number }} Phase */
/** @typedef {{ id: string, week: number, day: number, phases: Phase[] }} Workout */

/** @param {number} seconds @returns {Phase} */
const walk = (seconds) => ({ type: 'walk', seconds });
/** @param {number} seconds @returns {Phase} */
const jog = (seconds) => ({ type: 'jog', seconds });
/** @param {number} seconds @returns {Phase} */
const run = (seconds) => ({ type: 'run', seconds });

/** @returns {Workout} */
function workout(week, day, phases) {
  return { id: `w${week}d${day}`, week, day, phases };
}

// Transcribed from the screenshots in image-sources/ (weekN-dayM.jpeg).
/** @type {Workout[]} */
export const PLAN = [
  workout(1, 1, [walk(6 * 60), jog(2 * 60), walk(6 * 60), jog(2 * 60), run(5 * 60)]),
  workout(1, 2, [walk(7 * 60), jog(2 * 60), walk(7 * 60), jog(2 * 60), run(5 * 60)]),
  workout(1, 3, [walk(7 * 60), jog(2 * 60), walk(7 * 60), jog(2 * 60), run(5 * 60)]),
  workout(2, 1, [walk(6 * 60), jog(2 * 60), walk(6 * 60), jog(2 * 60), run(5 * 60)]),
  workout(2, 2, [walk(7 * 60), jog(2 * 60), walk(7 * 60), jog(2 * 60), run(5 * 60)]),
  workout(2, 3, [walk(6 * 60), jog(2 * 60), walk(6 * 60), jog(2 * 60), run(5 * 60)]),
  workout(3, 1, [walk(9 * 60), jog(2 * 60), walk(9 * 60), jog(2 * 60), run(5 * 60)]),
  workout(3, 2, [walk(9 * 60), jog(2 * 60), walk(9 * 60), jog(2 * 60), run(5 * 60)]),
  workout(3, 3, [walk(7 * 60), jog(2 * 60), walk(7 * 60), jog(2 * 60), run(5 * 60)]),
  workout(4, 1, [walk(9 * 60), jog(2 * 60), walk(9 * 60), jog(2 * 60), run(5 * 60)]),
  workout(4, 2, [walk(5 * 60), jog(2 * 60), walk(5 * 60), jog(2 * 60), walk(5 * 60), jog(2 * 60), run(5 * 60)]),
  workout(4, 3, [walk(7 * 60), jog(2 * 60), walk(7 * 60), jog(3 * 60), walk(7 * 60), jog(3 * 60), run(5 * 60)]),
  workout(5, 1, [walk(7 * 60), jog(2 * 60), walk(7 * 60), jog(3 * 60), walk(7 * 60), jog(3 * 60), run(5 * 60)]),
  workout(5, 2, [walk(9 * 60), jog(2 * 60), walk(9 * 60), jog(2 * 60), run(5 * 60)]),
  workout(5, 3, [walk(7 * 60), jog(2 * 60), walk(7 * 60), jog(3 * 60), walk(7 * 60), jog(3 * 60), run(5 * 60)]),
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

/** @typedef {'warmup' | 'build' | 'recovery' | 'finale'} PhaseRole */

/** What a phase is for, used for labels and tips. @param {Workout} workout @returns {PhaseRole} */
export function phaseRole(workout, index) {
  const phase = workout.phases[index];
  if (index === 0) return 'warmup';
  if (index === workout.phases.length - 1 && phase.type === 'run') return 'finale';
  return phase.type === 'walk' ? 'recovery' : 'build';
}
