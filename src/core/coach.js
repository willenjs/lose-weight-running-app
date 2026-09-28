import { phaseBoundaries } from './timer.js';

/**
 * Extra lines the voice coach says after the phase command ("Walk for 5
 * minutes"), as i18n keys in speaking order.
 * @param {import('./plan.js').Workout} workout
 * @param {number} phaseIndex
 * @param {'commands' | 'intense'} style
 * @returns {string[]}
 */
export function coachExtras(workout, phaseIndex, style) {
  if (style !== 'intense') return [];
  const keys = [`coach.${workout.phases[phaseIndex].type}`];
  const bounds = phaseBoundaries(workout);
  const halfMs = bounds.at(-1).endMs / 2;
  const isLast = phaseIndex === bounds.length - 1;
  const firstPastHalf = phaseIndex > 0
    && bounds[phaseIndex].startMs >= halfMs
    && bounds[phaseIndex - 1].startMs < halfMs;
  if (isLast) keys.push('coach.last');
  else if (firstPastHalf) keys.push('coach.halfway');
  return keys;
}
