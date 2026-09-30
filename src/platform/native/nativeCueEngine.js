import { buildTimeline } from '../../core/timeline.js';
import { nativeEvents, nativeTest } from './payload.js';

// A start delayed longer than this (the permission prompt) is rebuilt from the current time.
const STALE_START_MS = 1000;

/**
 * Cues played by the Android app's Coach plugin, which schedules the whole
 * timeline (tones and speech) in a foreground service, so they keep playing
 * with the screen locked or another app in front.
 * @param {{
 *   plugin: {
 *     start(data: object): Promise<unknown>, stop(): Promise<unknown>,
 *     test(data: object): Promise<unknown>, requestPermissions(): Promise<unknown>,
 *   },
 *   locales: () => string[],
 *   speechText: (event: any) => string,
 *   notification: (workout: import('../../core/plan.js').Workout) => { channel: string, title: string, text: string },
 *   onFailure: (error: unknown) => void,
 *   clock?: () => number,
 * }} options
 * @returns {import('../webCueEngine.js').CueEngine}
 */
export function createNativeCueEngine({ plugin, locales, speechText, notification, onFailure, clock = Date.now }) {
  /** @type {Promise<unknown> | null} */
  let permission = null;
  // Bumped on every start and stop, so a start still waiting for the
  // permission prompt does not revive cues after a later stop.
  let generation = 0;
  let testRun = 0;

  return {
    speaksInBackground: true,
    start(session, workout, now, settings, { announceCurrent }) {
      const run = ++generation;
      const calledAt = clock();
      /** Timeline as of `at`; the native side offsets its clock by the delivery lag. */
      const payload = (at, announce) => ({
        events: nativeEvents(buildTimeline(session, workout, at, settings, { announceCurrent: announce }), settings, speechText),
        locales: locales(),
        notification: notification(workout),
        sentAt: at,
      });
      permission ??= plugin.requestPermissions().catch(() => {});
      permission
        .then(() => {
          if (run !== generation) return undefined;
          const waited = clock() - calledAt;
          // After a slow permission prompt, start from now and say where the runner is.
          const data = waited > STALE_START_MS ? payload(now + waited, true) : payload(now, announceCurrent);
          return plugin.start(data);
        })
        .catch(onFailure);
      return true;
    },
    stop() {
      generation++;
      plugin.stop().catch(() => {});
    },
    test(settings, sampleText, onDone) {
      const run = ++testRun;
      plugin.test({ ...nativeTest(settings, sampleText), locales: locales() })
        .catch(() => {})
        .then(() => { if (run === testRun) onDone(); });
    },
  };
}
