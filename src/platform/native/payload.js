import { cueVolume, DUE_GRACE_MS } from '../../core/cues.js';
import { testSequence } from '../../core/audioSettings.js';
import { getState, phaseBoundaries } from '../../core/timer.js';
import { buildTimeline, workoutSchedule } from '../../core/timeline.js';

/** Watch text: label name → i18n key. `next` keeps its {phase} and {time} placeholders. */
export const WATCH_LABEL_KEYS = {
  walk: 'phase.walk',
  jog: 'phase.jog',
  run: 'phase.run',
  paused: 'run.paused',
  next: 'run.next',
  last: 'run.last',
  remainingTotal: 'run.remainingTotal',
  pause: 'run.pause',
  resume: 'run.resume',
  skip: 'run.skip',
  stop: 'run.stop',
  stopTitle: 'run.stopTitle',
  stopBody: 'run.stopBody',
  stopKeep: 'run.stopKeep',
  done: 'cue.finish',
  idle: 'watch.idle',
  unreachable: 'watch.unreachable',
};

/** @param {import('../../core/plan.js').Workout} workout */
export function phaseList(workout) {
  return phaseBoundaries(workout).map((bounds, i) => ({ type: workout.phases[i].type, ...bounds }));
}

/**
 * The line announcing the phase under way with its remaining time, when the
 * runner is mid-phase. At a phase start (fresh start, skip) the schedule
 * already has that phase's line, so there is nothing to add.
 * @returns {import('../../core/timeline.js').TimelineEvent | null}
 */
export function announceEvent(session, workout, now, settings) {
  const state = getState(session, workout, now);
  if (state.paused || state.finished) return null;
  const { startMs } = phaseBoundaries(workout)[state.phaseIndex];
  if (state.elapsedMs - startMs <= DUE_GRACE_MS) return null;
  return buildTimeline(session, workout, now, settings, { announceCurrent: true })
    .find((event) => event.kind === 'speech' && event.inMs === 0 && !('finish' in event)) ?? null;
}

/**
 * Everything the Android service needs to run the workout on its own: it
 * derives the state from the session timestamps, plays the part of the
 * schedule still ahead, and mirrors the run to the watch.
 * @param {import('../../core/timer.js').Session} session
 * @param {import('../../core/plan.js').Workout} workout
 * @param {number} now
 * @param {import('../../core/audioSettings.js').AudioSettings} settings
 * @param {{
 *   speechText: (event: any) => string,
 *   locales: string[],
 *   notification: { channel: string, title: string, text: string, pausedText: string },
 *   watch: { title: string, labels: Record<string, string> },
 *   announceCurrent: boolean,
 * }} options
 */
export function runPayload(session, workout, now, settings, { speechText, locales, notification, watch, announceCurrent }) {
  const current = announceCurrent ? announceEvent(session, workout, now, settings) : null;
  return {
    session: {
      workoutId: session.workoutId,
      startedAt: session.startedAt,
      pausedAt: session.pausedAt,
      pausedTotalMs: session.pausedTotalMs,
      skippedMs: session.skippedMs,
    },
    phases: phaseList(workout),
    schedule: nativeEvents(workoutSchedule(workout, settings), settings, speechText),
    announce: current === null ? null : { text: speechText(current), volume: settings.voiceVolume },
    locales,
    notification,
    watch,
  };
}

/**
 * @typedef {{ type: 'tone', atMs: number, tone: import('../../core/cues.js').CueKind, volume: number }
 *   | { type: 'speech', atMs: number, text: string, volume: number }} NativeEvent
 * Volumes are 0–100. The native side needs no settings or translations.
 */

/**
 * @param {import('../../core/timeline.js').TimelineEvent[]} timeline
 * @param {import('../../core/audioSettings.js').AudioSettings} settings
 * @param {(event: any) => string} speechText
 * @returns {NativeEvent[]}
 */
export function nativeEvents(timeline, settings, speechText) {
  return timeline.map((event) => (event.kind === 'tone'
    ? { type: 'tone', atMs: event.inMs, tone: event.tone, volume: cueVolume(event.tone, settings) }
    : { type: 'speech', atMs: event.inMs, text: speechText(event), volume: settings.voiceVolume }));
}

/**
 * The audio-sheet test for the native side: the sample line, then the tones.
 * @param {import('../../core/audioSettings.js').AudioSettings} settings
 * @param {string | null} sampleText
 */
export function nativeTest(settings, sampleText) {
  const { tones } = testSequence(settings);
  return {
    speech: sampleText === null ? null : { text: sampleText, volume: settings.voiceVolume },
    tones: tones.map((tone) => ({ tone, volume: cueVolume(tone, settings) })),
  };
}
