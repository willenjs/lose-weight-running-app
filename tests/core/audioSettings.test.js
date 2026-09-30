import { describe, it, expect } from 'vitest';
import {
  DEFAULT_AUDIO_SETTINGS, VOICE_STYLES,
  normalizeAudioSettings, migrateAudioSettings, isMuted, testSequence, activeCues, soloSettings,
} from '../../src/core/audioSettings.js';

describe('audio settings defaults', () => {
  it('have full voice, softer beeps and fanfare, plain commands', () => {
    expect(DEFAULT_AUDIO_SETTINGS).toEqual({
      voiceVolume: 100, beepVolume: 60, fanfareVolume: 60, voiceStyle: 'commands',
    });
    expect(Object.isFrozen(DEFAULT_AUDIO_SETTINGS)).toBe(true);
  });

  it('offer two coach styles', () => {
    expect(VOICE_STYLES).toEqual(['intense', 'commands']);
  });
});

describe('normalizeAudioSettings', () => {
  it('returns a fresh copy of the defaults for non-objects', () => {
    for (const value of [undefined, null, 'x', 42, []]) {
      const settings = normalizeAudioSettings(value);
      expect(settings).toEqual(DEFAULT_AUDIO_SETTINGS);
      expect(settings).not.toBe(DEFAULT_AUDIO_SETTINGS);
    }
  });

  it('keeps valid fields and fills missing ones from the defaults', () => {
    expect(normalizeAudioSettings({ voiceVolume: 40, voiceStyle: 'intense' })).toEqual({
      voiceVolume: 40, beepVolume: 60, fanfareVolume: 60, voiceStyle: 'intense',
    });
  });

  it('clamps and rounds every volume, and accepts numeric strings from range inputs', () => {
    expect(normalizeAudioSettings({ voiceVolume: 150, beepVolume: -3, fanfareVolume: 42.6 })).toEqual({
      voiceVolume: 100, beepVolume: 0, fanfareVolume: 43, voiceStyle: 'commands',
    });
    expect(normalizeAudioSettings({ beepVolume: '50' }).beepVolume).toBe(50);
  });

  it('replaces invalid fields with the defaults', () => {
    expect(normalizeAudioSettings({
      voiceVolume: 'loud', beepVolume: Number.NaN, fanfareVolume: '', voiceStyle: 'shouty',
    })).toEqual(DEFAULT_AUDIO_SETTINGS);
  });
});

describe('migrateAudioSettings', () => {
  it('turns v1 { muted } into all volumes 0, or the defaults', () => {
    expect(migrateAudioSettings(1, { muted: true })).toEqual({ voiceVolume: 0, beepVolume: 0, fanfareVolume: 0, voiceStyle: 'commands' });
    expect(migrateAudioSettings(1, { muted: false })).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('keeps what a v2 user heard: master volume × beep level for tones, switches as 0', () => {
    expect(migrateAudioSettings(2, {
      volume: 80, beepLevel: 50, beeps: true, voice: true, voiceStyle: 'intense', fanfare: true,
    })).toEqual({ voiceVolume: 80, beepVolume: 40, fanfareVolume: 40, voiceStyle: 'intense' });
    expect(migrateAudioSettings(2, {
      volume: 100, beeps: false, voice: false, voiceStyle: 'commands', fanfare: false,
    })).toEqual({ voiceVolume: 0, beepVolume: 60, fanfareVolume: 0, voiceStyle: 'commands' });
  });

  it('returns undefined for anything it cannot read', () => {
    expect(migrateAudioSettings(1, { muted: 'yes' })).toBeUndefined();
    expect(migrateAudioSettings(2, 'loud')).toBeUndefined();
    expect(migrateAudioSettings(99, {})).toBeUndefined();
  });
});

describe('isMuted', () => {
  it('is true only when every volume is 0', () => {
    const off = { voiceVolume: 0, beepVolume: 0, fanfareVolume: 0, voiceStyle: 'commands' };
    expect(isMuted(off)).toBe(true);
    expect(isMuted({ ...off, fanfareVolume: 1 })).toBe(false);
  });
});

describe('activeCues', () => {
  const all = { ...DEFAULT_AUDIO_SETTINGS };

  it('lists every cue with some volume, in a fixed order', () => {
    expect(activeCues(all)).toEqual(['beeps', 'voice', 'fanfare']);
    expect(activeCues({ ...all, voiceVolume: 0 })).toEqual(['beeps', 'fanfare']);
    expect(activeCues({ ...all, beepVolume: 0, fanfareVolume: 0 })).toEqual(['voice']);
    expect(activeCues({ ...all, voiceVolume: 0, beepVolume: 0, fanfareVolume: 0 })).toEqual([]);
  });
});

describe('testSequence', () => {
  const all = { ...DEFAULT_AUDIO_SETTINGS };

  it('follows the slider order: voice line, then the countdown beeps, then the fanfare', () => {
    expect(testSequence(all)).toEqual({ speak: true, voiceExtras: [], tones: ['pip', 'pip', 'lastPip', 'finish'] });
  });

  it('plays the phase tone after the countdown when the voice is at 0%', () => {
    expect(testSequence({ ...all, voiceVolume: 0 })).toEqual({
      speak: false, voiceExtras: [], tones: ['pip', 'pip', 'lastPip', 'run', 'finish'],
    });
  });

  it('leaves out the beeps at 0% beeps and the fanfare at 0% fanfare', () => {
    expect(testSequence({ ...all, beepVolume: 0 }).tones).toEqual(['finish']);
    expect(testSequence({ ...all, fanfareVolume: 0 }).tones).toEqual(['pip', 'pip', 'lastPip']);
    expect(testSequence({ ...all, voiceVolume: 0, beepVolume: 0 }).tones).toEqual(['finish']);
  });

  it('adds the intense coach line to the sample announcement', () => {
    expect(testSequence({ ...all, voiceStyle: 'intense' }).voiceExtras).toEqual(['coach.run']);
  });

  it('plays nothing when every volume is 0', () => {
    expect(testSequence({ ...all, voiceVolume: 0, beepVolume: 0, fanfareVolume: 0 }))
      .toEqual({ speak: false, voiceExtras: [], tones: [] });
  });
});

describe('soloSettings', () => {
  const settings = { voiceVolume: 80, beepVolume: 40, fanfareVolume: 70, voiceStyle: 'intense' };

  it('keeps only the chosen volume and the voice style', () => {
    expect(soloSettings(settings, 'beepVolume')).toEqual({
      voiceVolume: 0, beepVolume: 40, fanfareVolume: 0, voiceStyle: 'intense',
    });
    expect(soloSettings(settings, 'voiceVolume')).toEqual({
      voiceVolume: 80, beepVolume: 0, fanfareVolume: 0, voiceStyle: 'intense',
    });
  });

  it('makes the audio test play just that sound', () => {
    expect(testSequence(soloSettings(settings, 'fanfareVolume'))).toEqual({ speak: false, voiceExtras: [], tones: ['finish'] });
    expect(testSequence(soloSettings(settings, 'voiceVolume'))).toEqual({ speak: true, voiceExtras: ['coach.run'], tones: [] });
  });

  it('does not change the input', () => {
    soloSettings(settings, 'beepVolume');
    expect(settings.voiceVolume).toBe(80);
  });
});
