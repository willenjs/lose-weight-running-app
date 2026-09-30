import { runPayload, nativeTest } from './payload.js';
import { reconcile } from './runState.js';

// A start delayed longer than this (the permission prompt) announces where the runner is.
const STALE_START_MS = 1000;

/**
 * Cues played by the Android app's Coach plugin. Its foreground service owns
 * the run: it plays the whole schedule (tones and speech) with the screen
 * locked, applies pause / resume / skip / stop coming from the watch, and
 * reports each change back, as a `stateChanged` event while the page runs
 * and through `current()` when it wakes up.
 * @param {{
 *   plugin: {
 *     start(data: object): Promise<unknown>, stop(data: object): Promise<unknown>,
 *     current(): Promise<{ state: import('./runState.js').RunState | null }>,
 *     addListener(event: string, callback: (data: any) => void): Promise<unknown>,
 *     test(data: object): Promise<unknown>, requestPermissions(): Promise<unknown>,
 *   },
 *   locales: () => string[],
 *   speechText: (event: any) => string,
 *   notification: (workout: import('../../core/plan.js').Workout) => { channel: string, title: string, text: string, pausedText: string },
 *   watch: (workout: import('../../core/plan.js').Workout) => { title: string, labels: Record<string, string> },
 *   onFailure: (error: unknown) => void,
 *   clock?: () => number,
 * }} options
 * @returns {import('../webCueEngine.js').CueEngine}
 */
export function createNativeCueEngine({ plugin, locales, speechText, notification, watch, onFailure, clock = Date.now }) {
  /** @type {Promise<unknown> | null} */
  let permission = null;
  // Bumped on every sync and stop, so a sync still waiting for the
  // permission prompt does not revive a run after a later stop.
  let generation = 0;
  let testRun = 0;
  /** The run the app shows and the newest revision seen for it. @type {{ runId: number, revision: number } | null} */
  let tracked = null;
  /** @type {(decision: import('./runState.js').RunDecision) => void} */
  let listener = () => {};

  const track = (session) => {
    if (tracked?.runId !== session.startedAt) tracked = { runId: session.startedAt, revision: -1 };
  };

  /** @param {import('./runState.js').RunState | null} state */
  const deliver = (state) => {
    const decision = reconcile(tracked?.runId ?? null, tracked?.revision ?? -1, state);
    if (decision.type === 'ignore') return;
    if (decision.type === 'adopt') tracked = { runId: state.runId, revision: state.revision };
    else tracked = null;
    listener(decision);
  };

  return {
    speaksInBackground: true,
    sync(session, workout, now, settings, { announceCurrent }) {
      const run = ++generation;
      const calledAt = clock();
      track(session);
      permission ??= plugin.requestPermissions().catch(() => {});
      permission
        .then(() => {
          if (run !== generation) return undefined;
          const at = clock();
          return plugin.start(runPayload(session, workout, at, settings, {
            speechText,
            locales: locales(),
            notification: notification(workout),
            watch: watch(workout),
            announceCurrent: announceCurrent || at - calledAt > STALE_START_MS,
          }));
        })
        .catch(onFailure);
      return true;
    },
    stop() {
      generation++;
      tracked = null;
      plugin.stop({ reason: 'stopped' }).catch(() => {});
    },
    onRunState(callback) {
      listener = callback;
      plugin.addListener('stateChanged', deliver).catch(() => {});
    },
    checkRunState(session) {
      track(session);
      plugin.current().then(({ state }) => deliver(state)).catch(() => {});
    },
    test(settings, sampleText, onDone) {
      const run = ++testRun;
      plugin.test({ ...nativeTest(settings, sampleText), locales: locales() })
        .catch(() => {})
        .then(() => { if (run === testRun) onDone(); });
    },
  };
}
