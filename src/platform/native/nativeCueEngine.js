import { buildTimeline } from '../../core/timeline.js';
import { nativeEvents, nativeTest } from './payload.js';

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
 * }} options
 * @returns {import('../webCueEngine.js').CueEngine}
 */
export function createNativeCueEngine({ plugin, locales, speechText, notification, onFailure }) {
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
      const data = {
        events: nativeEvents(buildTimeline(session, workout, now, settings, { announceCurrent }), settings, speechText),
        locales: locales(),
        notification: notification(workout),
      };
      permission ??= plugin.requestPermissions().catch(() => {});
      permission
        .then(() => (run === generation ? plugin.start(data) : undefined))
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
