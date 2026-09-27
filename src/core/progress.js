/** @typedef {import('./plan.js').Workout} Workout */
/** @typedef {{ completed: Record<string, string> }} Progress */
import { totalSeconds } from './plan.js';

/** @returns {Progress} */
export function emptyProgress() {
  return { completed: {} };
}

/** @param {Progress} progress */
export function isDone(progress, workoutId) {
  return Object.hasOwn(progress.completed, workoutId);
}

/** @param {Workout[]} plan @param {Progress} progress @returns {Workout | null} */
export function nextWorkout(plan, progress) {
  return plan.find((w) => !isDone(progress, w.id)) ?? null;
}

/** @param {Progress} progress @returns {Progress} */
export function markDone(progress, workoutId, isoDate) {
  return { ...progress, completed: { ...progress.completed, [workoutId]: isoDate } };
}

/** @param {Progress} progress @returns {Progress} */
export function unmark(progress, workoutId) {
  const { [workoutId]: _removed, ...rest } = progress.completed;
  return { ...progress, completed: rest };
}

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
