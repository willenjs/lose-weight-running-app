/** @typedef {'commands' | 'intense'} VoiceStyle */
/**
 * @typedef {{
 *   voiceVolume: number,
 *   beepVolume: number,
 *   fanfareVolume: number,
 *   voiceStyle: VoiceStyle,
 * }} AudioSettings
 * Volumes are 0–100; 0 turns that sound off.
 * voiceVolume: spoken phase announcements.
 * beepVolume: the 3-2-1 countdown and the phase-start tones.
 * fanfareVolume: the finish melody.
 */

/** @type {Readonly<AudioSettings>} */
export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  voiceVolume: 100,
  beepVolume: 60,
  fanfareVolume: 60,
  voiceStyle: 'commands',
});

/** @type {VoiceStyle[]} */
export const VOICE_STYLES = ['intense', 'commands'];

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Range inputs report their value as a string, so numeric strings count. */
function toPercent(value) {
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
    voiceVolume: toPercent(input.voiceVolume) ?? d.voiceVolume,
    beepVolume: toPercent(input.beepVolume) ?? d.beepVolume,
    fanfareVolume: toPercent(input.fanfareVolume) ?? d.fanfareVolume,
    voiceStyle: VOICE_STYLES.includes(input.voiceStyle) ? input.voiceStyle : d.voiceStyle,
  };
}

/**
 * Settings saved by older versions, in the current shape (undefined if unreadable).
 * v1: { muted }. v2: a master volume, a beep level (% of it) and on/off switches;
 * tones played at volume × beep level, so that becomes the beep and fanfare volume.
 * @returns {AudioSettings | undefined}
 */
export function migrateAudioSettings(version, data) {
  if (!isObject(data)) return undefined;
  if (version === 1) {
    if (typeof data.muted !== 'boolean') return undefined;
    if (!data.muted) return { ...DEFAULT_AUDIO_SETTINGS };
    return { ...DEFAULT_AUDIO_SETTINGS, voiceVolume: 0, beepVolume: 0, fanfareVolume: 0 };
  }
  if (version === 2) {
    const volume = toPercent(data.volume) ?? 100;
    const tones = Math.round((volume * (toPercent(data.beepLevel) ?? 60)) / 100);
    return normalizeAudioSettings({
      voiceVolume: data.voice === false ? 0 : volume,
      beepVolume: tones,
      fanfareVolume: data.fanfare === false ? 0 : tones,
      voiceStyle: data.voiceStyle,
    });
  }
  return undefined;
}

/**
 * The sounds a runner will actually hear, for the run chip and workout note.
 * @param {AudioSettings} settings
 * @returns {('beeps' | 'voice' | 'fanfare')[]}
 */
export function activeCues(settings) {
  const on = { beeps: settings.beepVolume > 0, voice: settings.voiceVolume > 0, fanfare: settings.fanfareVolume > 0 };
  return /** @type {const} */ (['beeps', 'voice', 'fanfare']).filter((cue) => on[cue]);
}

/** @param {AudioSettings} settings */
export function isMuted(settings) {
  return activeCues(settings).length === 0;
}

/** @typedef {import('./cues.js').CueKind} CueKind */

/**
 * What the audio test plays, in the order of the sliders: a sample
 * announcement (if the voice has volume) with `voiceExtras` i18n keys, then
 * `tones` back to back: the countdown beeps and the fanfare. Without the
 * voice, the phase tone follows the countdown so beeps still sound complete.
 * @param {AudioSettings} settings
 * @returns {{ speak: boolean, voiceExtras: string[], tones: CueKind[] }}
 */
export function testSequence(settings) {
  const speak = settings.voiceVolume > 0;
  /** @type {CueKind[]} */
  const beeps = settings.beepVolume > 0 ? ['pip', 'pip', 'lastPip', ...(speak ? [] : ['run'])] : [];
  /** @type {CueKind[]} */
  const fanfare = settings.fanfareVolume > 0 ? ['finish'] : [];
  const voiceExtras = speak && settings.voiceStyle === 'intense' ? ['coach.run'] : [];
  return { speak, voiceExtras, tones: [...beeps, ...fanfare] };
}
