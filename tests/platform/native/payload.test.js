import { describe, it, expect } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS } from '../../../src/core/audioSettings.js';
import { nativeEvents, nativeTest } from '../../../src/platform/native/payload.js';

const settings = { ...DEFAULT_AUDIO_SETTINGS, voiceVolume: 80, beepVolume: 40, fanfareVolume: 70 };

describe('nativeEvents', () => {
  it('resolves text and per-kind volume', () => {
    const timeline = [
      { kind: 'tone', tone: 'walk', inMs: 0 },
      { kind: 'speech', inMs: 0, phaseType: 'walk', seconds: 360, extraKeys: [] },
      { kind: 'tone', tone: 'pip', inMs: 357_000 },
      { kind: 'tone', tone: 'finish', inMs: 1_260_000 },
      { kind: 'speech', inMs: 1_260_000, finish: true },
    ];
    const text = (event) => ('finish' in event ? 'done' : `${event.phaseType} ${event.seconds}`);
    expect(nativeEvents(timeline, settings, text)).toEqual([
      { type: 'tone', atMs: 0, tone: 'walk', volume: 40 },
      { type: 'speech', atMs: 0, text: 'walk 360', volume: 80 },
      { type: 'tone', atMs: 357_000, tone: 'pip', volume: 40 },
      { type: 'tone', atMs: 1_260_000, tone: 'finish', volume: 70 },
      { type: 'speech', atMs: 1_260_000, text: 'done', volume: 80 },
    ]);
  });
});

describe('nativeTest', () => {
  it('plays the sample line, then the countdown and the fanfare', () => {
    expect(nativeTest(settings, 'Run for 5 minutes')).toEqual({
      speech: { text: 'Run for 5 minutes', volume: 80 },
      tones: [
        { tone: 'pip', volume: 40 },
        { tone: 'pip', volume: 40 },
        { tone: 'lastPip', volume: 40 },
        { tone: 'finish', volume: 70 },
      ],
    });
  });

  it('has no speech without a sample line', () => {
    expect(nativeTest({ ...settings, voiceVolume: 0 }, null).speech).toBeNull();
  });
});
