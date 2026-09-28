/** @typedef {'commands' | 'intense'} VoiceStyle */
/**
 * @typedef {{
 *   volume: number,
 *   beeps: boolean,
 *   voice: boolean,
 *   voiceStyle: VoiceStyle,
 *   fanfare: boolean,
 * }} AudioSettings
 * volume: 0–100, where 100 is the loudest the app plays.
 * beeps: the 3-2-1 countdown before each phase change.
 * voice: spoken phase announcements.
 * fanfare: the finish melody.
 */

/** @type {Readonly<AudioSettings>} */
export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  volume: 100,
  beeps: true,
  voice: true,
  voiceStyle: 'commands',
  fanfare: true,
});

export const VOLUME_PRESETS = [0, 50, 80, 100];

/** @type {VoiceStyle[]} */
export const VOICE_STYLES = ['intense', 'commands'];

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

/** Range inputs report their value as a string, so numeric strings count. */
function toVolume(value) {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.round(Math.min(100, Math.max(0, n)));
}

/**
 * Any input to a valid AudioSettings; invalid or missing fields take the default.
 * @returns {AudioSettings}
 */
export function normalizeAudioSettings(value) {
  const input = isObject(value) ? value : {};
  const d = DEFAULT_AUDIO_SETTINGS;
  return {
    volume: toVolume(input.volume) ?? d.volume,
    beeps: bool(input.beeps, d.beeps),
    voice: bool(input.voice, d.voice),
    voiceStyle: VOICE_STYLES.includes(input.voiceStyle) ? input.voiceStyle : d.voiceStyle,
    fanfare: bool(input.fanfare, d.fanfare),
  };
}

/** @returns {'off' | 'low' | 'normal' | 'high'} */
export function volumeLevel(volume) {
  if (volume <= 0) return 'off';
  if (volume < 40) return 'low';
  if (volume < 85) return 'normal';
  return 'high';
}

/** @param {AudioSettings} settings */
export function isMuted(settings) {
  return settings.volume === 0;
}
