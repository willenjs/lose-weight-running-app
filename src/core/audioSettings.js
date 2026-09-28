/** @typedef {'commands' | 'intense'} VoiceStyle */
/**
 * @typedef {{
 *   volume: number,
 *   beepLevel: number,
 *   beeps: boolean,
 *   voice: boolean,
 *   voiceStyle: VoiceStyle,
 *   fanfare: boolean,
 * }} AudioSettings
 * volume: 0–100, where 100 is the loudest the app plays.
 * beepLevel: MIN_BEEP_LEVEL–100, tone loudness relative to the volume. Speech
 *   cannot be made louder, so this is how beeps are matched to a quiet voice.
 * beeps: the 3-2-1 countdown before each phase change.
 * voice: spoken phase announcements.
 * fanfare: the finish melody.
 */

/** @type {Readonly<AudioSettings>} */
export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  volume: 100,
  beepLevel: 60,
  beeps: true,
  voice: true,
  voiceStyle: 'commands',
  fanfare: true,
});

export const MIN_BEEP_LEVEL = 0;

/** @type {VoiceStyle[]} */
export const VOICE_STYLES = ['intense', 'commands'];

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

/** Range inputs report their value as a string, so numeric strings count. */
function toPercent(value, min = 0) {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.round(Math.min(100, Math.max(min, n)));
}

/**
 * Any input to a valid AudioSettings; invalid or missing fields take the default.
 * @returns {AudioSettings}
 */
export function normalizeAudioSettings(value) {
  const input = isObject(value) ? value : {};
  const d = DEFAULT_AUDIO_SETTINGS;
  return {
    volume: toPercent(input.volume) ?? d.volume,
    beepLevel: toPercent(input.beepLevel, MIN_BEEP_LEVEL) ?? d.beepLevel,
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

/** @typedef {import('./cues.js').CueKind} CueKind */

/**
 * What the audio test plays, mirroring the settings: tones in `lead`, then a
 * sample announcement (if `speak`) with `voiceExtras` i18n keys, then `tail`.
 * With the voice on, the sample line stands in for the phase tone; without
 * it, the phase tone plays and the tail joins the lead back to back.
 * @param {AudioSettings} settings
 * @returns {{ lead: CueKind[], speak: boolean, voiceExtras: string[], tail: CueKind[] }}
 */
export function testSequence(settings) {
  if (isMuted(settings)) return { lead: [], speak: false, voiceExtras: [], tail: [] };
  /** @type {CueKind[]} */
  const countdown = settings.beeps ? ['pip', 'pip', 'lastPip'] : [];
  /** @type {CueKind[]} */
  const tail = settings.fanfare ? ['finish'] : [];
  if (!settings.voice) return { lead: [...countdown, 'run', ...tail], speak: false, voiceExtras: [], tail: [] };
  const lead = countdown;
  const voiceExtras = settings.voiceStyle === 'intense' ? ['coach.run'] : [];
  return { lead, speak: true, voiceExtras, tail };
}

/**
 * The cues a runner will actually hear, for the run screen's audio chip.
 * Nothing at 0% volume; tones (beeps, fanfare) drop out at 0% beep level.
 * @param {AudioSettings} settings
 * @returns {('beeps' | 'voice' | 'fanfare')[]}
 */
export function activeCues(settings) {
  if (isMuted(settings)) return [];
  const tones = settings.beepLevel > 0;
  const on = { beeps: settings.beeps && tones, voice: settings.voice, fanfare: settings.fanfare && tones };
  return /** @type {const} */ (['beeps', 'voice', 'fanfare']).filter((cue) => on[cue]);
}
