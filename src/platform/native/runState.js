/**
 * @typedef {import('../../core/timer.js').Session} Session
 * @typedef {{ runId: number, revision: number, ended: null | 'stopped' | 'finished', session: Session }} RunState
 *   What the Android service reports: it owns the run while it is active,
 *   and every change (phone, watch, finish) gets a higher revision.
 * @typedef {{ type: 'ignore' }
 *   | { type: 'adopt', session: Session }
 *   | { type: 'stopped' }
 *   | { type: 'finished', session: Session }} RunDecision
 */

/**
 * What the app should do with a state reported by the service.
 * @param {number | null} runId the run the app shows (its session's startedAt)
 * @param {number} revision the newest revision the app has seen (-1: none)
 * @param {RunState | null} remote
 * @returns {RunDecision}
 */
export function reconcile(runId, revision, remote) {
  if (!remote || runId === null || remote.runId !== runId) return { type: 'ignore' };
  if (remote.ended === 'stopped') return { type: 'stopped' };
  if (remote.ended === 'finished') return { type: 'finished', session: remote.session };
  if (remote.revision > revision) return { type: 'adopt', session: remote.session };
  return { type: 'ignore' };
}
