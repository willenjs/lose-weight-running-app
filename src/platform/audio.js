import { upcomingCues } from '../core/cues.js';

// `at` (offset from the cue) and `dur` are in seconds, matching AudioContext time.
/** @typedef {{ freq: number, at: number, dur: number }} Note */

/** @type {Record<import('../core/cues.js').CueKind, Note[]>} */
const TONES = {
  pip: [{ freq: 880, at: 0, dur: 0.08 }],
  walk: [{ freq: 440, at: 0, dur: 0.5 }],
  jog: [{ freq: 660, at: 0, dur: 0.5 }],
  run: [{ freq: 990, at: 0, dur: 0.15 }, { freq: 990, at: 0.25, dur: 0.15 }],
  finish: [
    { freq: 523, at: 0, dur: 0.2 },
    { freq: 659, at: 0.22, dur: 0.2 },
    { freq: 784, at: 0.44, dur: 0.45 },
  ],
};

const VOLUME = 0.4;
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

  function oscillator(freq, volume) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain).connect(ctx.destination);
    nodes.push({ osc, gain });
    return { osc, gain };
  }

  function note(freq, startAt, dur) {
    const { osc, gain } = oscillator(freq, 0);
    // Short ramps avoid clicks at note start and end.
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(VOLUME, startAt + 0.01);
    gain.gain.setValueAtTime(VOLUME, startAt + dur - 0.02);
    gain.gain.linearRampToValueAtTime(0, startAt + dur);
    osc.start(startAt);
    osc.stop(startAt + dur);
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

  function start(session, workout, now) {
    if (!AudioContextClass) return false;
    try {
      stop();
      ctx ??= new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const base = ctx.currentTime;
      for (const cue of upcomingCues(session, workout, now)) {
        for (const n of TONES[cue.kind]) note(n.freq, base + cue.inMs / 1000 + n.at, n.dur);
      }
      oscillator(KEEP_ALIVE_FREQ, KEEP_ALIVE_VOLUME).osc.start(base);
      return true;
    } catch {
      return false;
    }
  }

  return { supported: Boolean(AudioContextClass), start, stop };
}
