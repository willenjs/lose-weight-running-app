import { upcomingCues, filterCues, cueVolume } from '../core/cues.js';
import { DEFAULT_AUDIO_SETTINGS } from '../core/audioSettings.js';

// `at` (offset from the cue) and `dur` are in seconds, matching AudioContext time.
/** @typedef {{ freq: number, at: number, dur: number }} Note */

const fanfare = (offset) => [
  { freq: 523, at: offset, dur: 0.15 },
  { freq: 659, at: offset + 0.18, dur: 0.15 },
  { freq: 784, at: offset + 0.36, dur: 0.15 },
  { freq: 1047, at: offset + 0.54, dur: 0.55 },
];

// Each phase type has its own beep count so it can be told apart without looking.
/** @type {Record<import('../core/cues.js').CueKind, Note[]>} */
const TONES = {
  pip: [{ freq: 880, at: 0, dur: 0.15 }],
  lastPip: [{ freq: 1320, at: 0, dur: 0.5 }],
  walk: [{ freq: 440, at: 0, dur: 0.35 }, { freq: 440, at: 0.5, dur: 0.35 }],
  jog: [
    { freq: 660, at: 0, dur: 0.2 },
    { freq: 660, at: 0.3, dur: 0.2 },
    { freq: 660, at: 0.6, dur: 0.2 },
  ],
  run: [
    { freq: 990, at: 0, dur: 0.1 },
    { freq: 990, at: 0.16, dur: 0.1 },
    { freq: 990, at: 0.32, dur: 0.1 },
    { freq: 990, at: 0.48, dur: 0.1 },
  ],
  finish: [...fanfare(0), ...fanfare(1.3)],
};

// Silence between consecutive tones in the audio test.
const TEST_GAP_S = 0.25;
/** @param {Note[]} notes */
const lengthOf = (notes) => Math.max(...notes.map((n) => n.at + n.dur));

// Triangle waves stay full-sounding near maximum volume without the harshness of square waves.
const WAVE = 'triangle';
// Gain at 100% volume; each sound's volume scales it down linearly.
const MAX_GAIN = 0.95;
/**
 * @param {import('../core/cues.js').CueKind} kind
 * @param {{ beepVolume: number, fanfareVolume: number }} settings
 */
const gainFor = (kind, settings) => (MAX_GAIN * Math.min(100, Math.max(0, cueVolume(kind, settings)))) / 100;
// Quiet enough to be inaudible, loud enough for Chrome to treat the tab as
// "playing audio", which exempts it from intensive background throttling.
const KEEP_ALIVE_VOLUME = 0.001;
const KEEP_ALIVE_FREQ = 40;

export function createCuePlayer() {
  const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  /** @type {AudioContext | null} */
  let ctx = null;
  /** @type {{ osc: OscillatorNode, gain: GainNode }[]} */
  let nodes = [];

  function oscillator(freq, volume, type = 'sine') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain).connect(ctx.destination);
    nodes.push({ osc, gain });
    return { osc, gain };
  }

  function note(freq, startAt, dur, level) {
    const { osc, gain } = oscillator(freq, 0, WAVE);
    // Short ramps avoid clicks at note start and end.
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(level, startAt + 0.01);
    gain.gain.setValueAtTime(level, startAt + dur - 0.02);
    gain.gain.linearRampToValueAtTime(0, startAt + dur);
    osc.start(startAt);
    osc.stop(startAt + dur);
  }

  function ensureContext() {
    ctx ??= new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function stop() {
    for (const { osc, gain } of nodes) {
      try {
        osc.stop();
      } catch {
        // Already stopped.
      }
      osc.disconnect();
      gain.disconnect();
    }
    nodes = [];
  }

  /**
   * Schedules every upcoming cue the settings allow. The keep-alive tone
   * always runs, even when muted, so the tab is not throttled.
   * @param {import('../core/audioSettings.js').AudioSettings} [settings]
   */
  function start(session, workout, now, settings = DEFAULT_AUDIO_SETTINGS) {
    if (!AudioContextClass) return false;
    try {
      stop();
      ensureContext();
      const base = ctx.currentTime;
      for (const cue of filterCues(upcomingCues(session, workout, now), settings)) {
        const level = gainFor(cue.kind, settings);
        for (const n of TONES[cue.kind]) note(n.freq, base + cue.inMs / 1000 + n.at, n.dur, level);
      }
      oscillator(KEEP_ALIVE_FREQ, KEEP_ALIVE_VOLUME).osc.start(base);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Plays the given cue kinds one after another, starting now. The first call
   * must come from a user gesture (it may create the AudioContext).
   * @param {import('../core/cues.js').CueKind[]} kinds
   * @param {{ beepVolume: number, fanfareVolume: number }} settings
   * @returns {number} how long the tones take, in ms (0 when nothing plays)
   */
  function test(kinds, settings) {
    if (!AudioContextClass) return 0;
    try {
      // Created/resumed even with no kinds, so a tap can unlock audio for later tones.
      ensureContext();
      let at = ctx.currentTime + 0.05;
      const start = at;
      for (const kind of kinds) {
        const level = gainFor(kind, settings);
        for (const n of TONES[kind]) note(n.freq, at + n.at, n.dur, level);
        at += lengthOf(TONES[kind]) + TEST_GAP_S;
      }
      return Math.round((at - start) * 1000);
    } catch {
      return 0;
    }
  }

  return { supported: Boolean(AudioContextClass), start, stop, test };
}
