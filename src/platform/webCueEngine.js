import { createCuePlayer } from './audio.js';
import { speak } from './speech.js';
import { testSequence } from '../core/audioSettings.js';

/**
 * @typedef {{
 *   speaksInBackground: boolean,
 *   start(session: import('../core/timer.js').Session, workout: import('../core/plan.js').Workout,
 *     now: number, settings: import('../core/audioSettings.js').AudioSettings,
 *     options: { announceCurrent: boolean }): boolean,
 *   stop(): void,
 *   test(settings: import('../core/audioSettings.js').AudioSettings, sampleText: string | null,
 *     onDone: () => void): void,
 * }} CueEngine
 * Plays a workout's cues. `speaksInBackground` engines speak the phase
 * lines themselves; otherwise the controller speaks them while visible.
 */

/**
 * Browser cues: tones pre-scheduled on the Web Audio clock; the controller
 * speaks phase lines from its tick while the page is visible.
 * @param {{ locales: () => string[] }} options voice locales, best first
 * @returns {CueEngine}
 */
export function createWebCueEngine({ locales }) {
  const player = createCuePlayer();
  let testTimer = null;
  // Bumped on each test so callbacks from an earlier test are ignored.
  let testRun = 0;

  return {
    speaksInBackground: false,
    // announceCurrent is ignored: the controller's tick announces phases here.
    start(session, workout, now, settings) {
      return player.start(session, workout, now, settings);
    },
    stop() {
      player.stop();
    },
    test(settings, sampleText, onDone) {
      const run = ++testRun;
      clearTimeout(testTimer);
      const { tones } = testSequence(settings);
      const playTones = () => {
        if (run !== testRun) return;
        const ms = player.test(tones, settings);
        testTimer = setTimeout(() => { if (run === testRun) onDone(); }, ms);
      };
      // Unlock audio within the tap, even when the voice goes first.
      player.test([], settings);
      const spoke = sampleText !== null
        && speak(sampleText, locales(), { volume: settings.voiceVolume, onEnd: playTones });
      if (!spoke) playTones();
    },
  };
}
