import { getState, phaseBoundaries } from './timer.js';

/** @typedef {'pip' | 'lastPip' | 'walk' | 'jog' | 'run' | 'finish'} CueKind */
/** @typedef {{ kind: CueKind, inMs: number }} Cue */

export const COUNTDOWN_PIPS = 3;
// A cue at most this far in the past still plays, right away: cues are
// scheduled a few ms after the start or skip that made them due.
export const DUE_GRACE_MS = 250;

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
    .filter((cue) => cue.atMs >= elapsed - DUE_GRACE_MS)
    .sort((a, b) => a.atMs - b.atMs)
    .map((cue) => ({ kind: cue.kind, inMs: Math.max(0, cue.atMs - elapsed) }));
}

/**
 * Cues that will be heard: the fanfare needs fanfare volume, every other
 * tone (countdown and phase starts) needs beep volume.
 * @param {Cue[]} cues
 * @param {{ beepVolume: number, fanfareVolume: number }} settings
 * @returns {Cue[]}
 */
export function filterCues(cues, settings) {
  return cues.filter((cue) => cueVolume(cue.kind, settings) > 0);
}

/**
 * Volume (0–100) a cue kind plays at.
 * @param {CueKind} kind
 * @param {{ beepVolume: number, fanfareVolume: number }} settings
 */
export function cueVolume(kind, { beepVolume, fanfareVolume }) {
  return kind === 'finish' ? fanfareVolume : beepVolume;
}
