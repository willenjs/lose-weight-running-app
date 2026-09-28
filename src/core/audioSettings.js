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
 * What the audio test plays, mirroring the settings: tones in `lead`, then a
 * sample announcement (if `speak`) with `voiceExtras` i18n keys, then `tail`.
 * With the voice on, the sample line stands in for the phase tone; without
 * it, the phase tone plays and the tail joins the lead back to back.
 * @param {AudioSettings} settings
 * @returns {{ lead: CueKind[], speak: boolean, voiceExtras: string[], tail: CueKind[] }}
 */
export function testSequence(settings) {
  const beeps = settings.beepVolume > 0;
  /** @type {CueKind[]} */
  const countdown = beeps ? ['pip', 'pip', 'lastPip'] : [];
  /** @type {CueKind[]} */
  const tail = settings.fanfareVolume > 0 ? ['finish'] : [];
  if (settings.voiceVolume === 0) {
    /** @type {CueKind[]} */
    const phaseTone = beeps ? ['run'] : [];
    return { lead: [...countdown, ...phaseTone, ...tail], speak: false, voiceExtras: [], tail: [] };
  }
  const voiceExtras = settings.voiceStyle === 'intense' ? ['coach.run'] : [];
  return { lead: countdown, speak: true, voiceExtras, tail };
}
