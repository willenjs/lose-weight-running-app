/** @typedef {import('./plan.js').Workout} Workout */
/** @typedef {{ completed: Record<string, string> }} Progress */

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
