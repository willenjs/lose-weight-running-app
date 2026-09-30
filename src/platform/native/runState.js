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

/**
 * The local clock says the run the app shows is over. On Android the service
 * owns the run (the watch may have paused it while the page slept), so the
 * app only finishes when the service has nothing newer to say about it.
 * @param {Session} local the session the app shows
 * @param {number} revision the newest revision the app has seen for it (-1: none)
 * @param {RunState | null} remote what the service reports, null when it has nothing
 * @param {(session: Session) => boolean} isFinished whether a session is over by now
 * @returns {RunDecision}
 */
export function confirmFinish(local, revision, remote, isFinished) {
  // No state for this run (service gone, or another run): trust the local clock.
  if (!remote || remote.runId !== local.startedAt) return { type: 'finished', session: local };
  if (remote.ended === 'stopped') return { type: 'stopped' };
  if (remote.ended === 'finished') return { type: 'finished', session: remote.session };
  // Nothing the app has not seen (its own last change, e.g. a skip to the end, may still be on the way).
  if (remote.revision <= revision) return { type: 'finished', session: local };
  // A newer change, but over by the clock too: the service is about to report the finish.
  if (isFinished(remote.session)) return { type: 'finished', session: remote.session };
  return { type: 'adopt', session: remote.session };
}
