import { getState, phaseBoundaries, startSession } from './timer.js';
import { upcomingCues, filterCues, DUE_GRACE_MS } from './cues.js';
import { coachExtras } from './coach.js';

/** @typedef {import('./cues.js').CueKind} CueKind */
/** @typedef {import('./plan.js').PhaseType} PhaseType */
/**
 * @typedef {{ kind: 'tone', tone: CueKind, inMs: number }
 *   | { kind: 'speech', inMs: number, phaseType: PhaseType, seconds: number, extraKeys: string[] }
 *   | { kind: 'speech', inMs: number, finish: true }} TimelineEvent
 * Speech events carry i18n keys and numbers, not text: core cannot translate.
 */

/**
 * Everything the runner will hear from `now` on, as delays from `now`: the
 * cue tones plus a spoken line at each phase start and at the finish. The
 * native app schedules all of it at once, because the page's JavaScript may
 * not run while the phone is locked.
 * @param {import('./timer.js').Session} session
 * @param {import('./plan.js').Workout} workout
 * @param {import('./audioSettings.js').AudioSettings} settings
 * @param {{ announceCurrent?: boolean }} [options] also announce the phase
 *   already under way, with its remaining time (start, resume after reload, skip)
 * @returns {TimelineEvent[]}
 */
export function buildTimeline(session, workout, now, settings, { announceCurrent = false } = {}) {
  const state = getState(session, workout, now);
  if (state.paused || state.finished) return [];
  const elapsed = state.elapsedMs;

  /** @type {TimelineEvent[]} */
  const events = filterCues(upcomingCues(session, workout, now), settings)
    .map((cue) => ({ kind: 'tone', tone: cue.kind, inMs: cue.inMs }));

  if (settings.voiceVolume > 0) {
    const bounds = phaseBoundaries(workout);
    bounds.forEach(({ startMs, endMs }, i) => {
      const isCurrent = startMs <= elapsed && elapsed < endMs;
      if (startMs <= elapsed && !(isCurrent && announceCurrent)) return;
      events.push({
        kind: 'speech',
        inMs: Math.max(0, startMs - elapsed),
        phaseType: workout.phases[i].type,
        seconds: Math.round((endMs - Math.max(startMs, elapsed)) / 1000),
        extraKeys: coachExtras(workout, i, settings.voiceStyle),
      });
    });
    events.push({ kind: 'speech', inMs: bounds.at(-1).endMs - elapsed, finish: true });
  }

  // At the same moment the tone plays first, then the voice.
  const order = (event) => (event.kind === 'tone' ? 0 : 1);
  return events.sort((a, b) => a.inMs - b.inMs || order(a) - order(b));
}

/**
 * Every event of the workout, with `inMs` measured from the workout start:
 * the timeline of a fresh start. The Android service keeps it for the whole
 * run and picks the part still ahead after each pause, resume or skip.
 * @param {import('./plan.js').Workout} workout
 * @param {import('./audioSettings.js').AudioSettings} settings
 * @returns {TimelineEvent[]}
 */
export function workoutSchedule(workout, settings) {
  return buildTimeline(startSession(workout.id, 0), workout, 0, settings, { announceCurrent: true });
}

/**
 * The part of a workout schedule still ahead at `elapsedMs`. An event that
 * fell due at most DUE_GRACE_MS ago is kept: a skip lands exactly on a phase
 * start, and the change takes a few ms to reach whoever plays it.
 * @param {TimelineEvent[]} schedule from workoutSchedule
 * @param {number} elapsedMs
 * @returns {TimelineEvent[]}
 */
export function scheduleFrom(schedule, elapsedMs) {
  return schedule.filter((event) => event.inMs >= elapsedMs - DUE_GRACE_MS);
}
