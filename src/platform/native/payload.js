import { cueVolume } from '../../core/cues.js';
import { testSequence } from '../../core/audioSettings.js';

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
