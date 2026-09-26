import { getState, phaseBoundaries } from './timer.js';

/** @typedef {'pip' | 'lastPip' | 'walk' | 'jog' | 'run' | 'finish'} CueKind */
/** @typedef {{ kind: CueKind, inMs: number }} Cue */

export const COUNTDOWN_PIPS = 3;

/**
 * Every audio cue still ahead in the workout, as delays from `now`.
 * The audio layer schedules all of them at once so they fire on time
 * even if the page's JavaScript is throttled in the background.
 * @param {import('./timer.js').Session} session
 * @param {import('./plan.js').Workout} workout
 * @returns {Cue[]}
 */
export function upcomingCues(session, workout, now) {
  const state = getState(session, workout, now);
  if (state.paused || state.finished) return [];

  const elapsed = state.elapsedMs;
  const bounds = phaseBoundaries(workout);
  const cues = [];
  bounds.forEach(({ startMs, endMs }, i) => {
    cues.push({ kind: workout.phases[i].type, atMs: startMs });
    for (let k = COUNTDOWN_PIPS; k >= 1; k--) {
      const atMs = endMs - k * 1000;
      if (atMs > startMs) cues.push({ kind: k === 1 ? 'lastPip' : 'pip', atMs });
    }
  });
  cues.push({ kind: 'finish', atMs: bounds.at(-1).endMs });

  return cues
    .filter((cue) => cue.atMs >= elapsed)
    .sort((a, b) => a.atMs - b.atMs)
    .map((cue) => ({ kind: cue.kind, inMs: cue.atMs - elapsed }));
}
