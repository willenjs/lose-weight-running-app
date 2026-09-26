import { findWorkout, totalSeconds } from './plan.js';

/** @typedef {import('./plan.js').Workout} Workout */

/**
 * All times are epoch milliseconds. State is always derived from these
 * timestamps, never from counting ticks, so throttled or suspended
 * JavaScript cannot make the timer drift.
 * @typedef {{
 *   workoutId: string,
 *   startedAt: number,
 *   pausedAt: number | null,
 *   pausedTotalMs: number,
 *   skippedMs: number
 * }} Session
 */

/**
 * @typedef {{
 *   phaseIndex: number,
 *   phaseRemainingMs: number,
 *   totalRemainingMs: number,
 *   elapsedMs: number,
 *   finished: boolean,
 *   paused: boolean
 * }} TimerState
 */

export const RESUME_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** @returns {Session} */
export function startSession(workoutId, now) {
  return { workoutId, startedAt: now, pausedAt: null, pausedTotalMs: 0, skippedMs: 0 };
}

/** @param {Session} session @returns {Session} */
export function pauseSession(session, now) {
  if (session.pausedAt !== null) return session;
  return { ...session, pausedAt: now };
}

/** @param {Session} session @returns {Session} */
export function resumeSession(session, now) {
  if (session.pausedAt === null) return session;
  return {
    ...session,
    pausedAt: null,
    pausedTotalMs: session.pausedTotalMs + Math.max(0, now - session.pausedAt),
  };
}

/** @param {Workout} workout @returns {{ startMs: number, endMs: number }[]} */
export function phaseBoundaries(workout) {
  let startMs = 0;
  return workout.phases.map((phase) => {
    const bounds = { startMs, endMs: startMs + phase.seconds * 1000 };
    startMs = bounds.endMs;
    return bounds;
  });
}

/** @param {Session} session @param {Workout} workout */
export function elapsedMs(session, workout, now) {
  const totalMs = totalSeconds(workout) * 1000;
  const at = session.pausedAt ?? now;
  const raw = at - session.startedAt - session.pausedTotalMs + session.skippedMs;
  return Math.min(totalMs, Math.max(0, raw));
}

/** @param {Session} session @param {Workout} workout @returns {TimerState} */
export function getState(session, workout, now) {
  const bounds = phaseBoundaries(workout);
  const totalMs = bounds.at(-1).endMs;
  const elapsed = elapsedMs(session, workout, now);
  const finished = elapsed >= totalMs;
  const phaseIndex = finished ? bounds.length - 1 : bounds.findIndex((b) => elapsed < b.endMs);
  return {
    phaseIndex,
    phaseRemainingMs: finished ? 0 : bounds[phaseIndex].endMs - elapsed,
    totalRemainingMs: totalMs - elapsed,
    elapsedMs: elapsed,
    finished,
    paused: session.pausedAt !== null,
  };
}

/** @param {Session} session @param {Workout} workout @returns {Session} */
export function skipPhase(session, workout, now) {
  const state = getState(session, workout, now);
  if (state.finished) return session;
  return { ...session, skippedMs: session.skippedMs + state.phaseRemainingMs };
}

/** Countdown display: rounds up so a phase shows "06:00" at its start and "00:01" in its last second. */
export function formatClock(ms) {
  const totalSec = Math.ceil(Math.max(0, ms) / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** @param {Session} session */
export function shouldOfferResume(session, now) {
  const workout = findWorkout(session.workoutId);
  if (workout === null) return false;
  if (now - session.startedAt >= RESUME_MAX_AGE_MS) return false;
  return !getState(session, workout, now).finished;
}
