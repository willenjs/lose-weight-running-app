import { describe, it, expect } from 'vitest';
import {
  DEFAULT_AUDIO_SETTINGS, VOICE_STYLES, MIN_BEEP_LEVEL,
  normalizeAudioSettings, volumeLevel, isMuted, testSequence,
} from '../../src/core/audioSettings.js';

describe('audio settings defaults', () => {
  it('keep today\'s behavior: full volume, everything on, plain commands', () => {
    expect(DEFAULT_AUDIO_SETTINGS).toEqual({
      volume: 100, beepLevel: 60, beeps: true, voice: true, voiceStyle: 'commands', fanfare: true,
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
    expect(normalizeAudioSettings({ volume: 40, voice: false })).toEqual({
      volume: 40, beepLevel: 60, beeps: true, voice: false, voiceStyle: 'commands', fanfare: true,
    });
    expect(normalizeAudioSettings({ voiceStyle: 'intense', beeps: false, fanfare: false })).toEqual({
      volume: 100, beepLevel: 60, beeps: false, voice: true, voiceStyle: 'intense', fanfare: false,
    });
  });

  it('clamps and rounds the volume, and accepts numeric strings from range inputs', () => {
    expect(normalizeAudioSettings({ volume: 150 }).volume).toBe(100);
    expect(normalizeAudioSettings({ volume: -3 }).volume).toBe(0);
    expect(normalizeAudioSettings({ volume: 42.6 }).volume).toBe(43);
    expect(normalizeAudioSettings({ volume: '50' }).volume).toBe(50);
  });

  it('replaces invalid fields with the defaults', () => {
    expect(normalizeAudioSettings({
      volume: 'loud', beeps: 'yes', voice: 1, voiceStyle: 'shouty', fanfare: null,
    })).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(normalizeAudioSettings({ volume: Number.NaN }).volume).toBe(100);
    expect(normalizeAudioSettings({ volume: '' }).volume).toBe(100);
  });
});

describe('volumeLevel', () => {
  it('names the level shown under the slider', () => {
    expect(volumeLevel(0)).toBe('off');
    expect(volumeLevel(1)).toBe('low');
    expect(volumeLevel(39)).toBe('low');
    expect(volumeLevel(40)).toBe('normal');
    expect(volumeLevel(84)).toBe('normal');
    expect(volumeLevel(85)).toBe('high');
    expect(volumeLevel(100)).toBe('high');
  });
});

describe('isMuted', () => {
  it('is true only at volume 0', () => {
    expect(isMuted({ ...DEFAULT_AUDIO_SETTINGS, volume: 0 })).toBe(true);
    expect(isMuted({ ...DEFAULT_AUDIO_SETTINGS, volume: 1 })).toBe(false);
    expect(isMuted({ ...DEFAULT_AUDIO_SETTINGS, beeps: false, voice: false, fanfare: false })).toBe(false);
  });
});

describe('beep level', () => {
  it('fills a missing level from the default (settings saved before it existed)', () => {
    expect(normalizeAudioSettings({ volume: 80, beeps: true }).beepLevel).toBe(60);
  });

  it('clamps to 0..100, rounds and accepts numeric strings', () => {
    expect(MIN_BEEP_LEVEL).toBe(0);
    expect(normalizeAudioSettings({ beepLevel: 10 }).beepLevel).toBe(10);
    expect(normalizeAudioSettings({ beepLevel: 0 }).beepLevel).toBe(0);
    expect(normalizeAudioSettings({ beepLevel: -5 }).beepLevel).toBe(0);
    expect(normalizeAudioSettings({ beepLevel: 130 }).beepLevel).toBe(100);
    expect(normalizeAudioSettings({ beepLevel: 44.4 }).beepLevel).toBe(44);
    expect(normalizeAudioSettings({ beepLevel: '75' }).beepLevel).toBe(75);
    expect(normalizeAudioSettings({ beepLevel: 'loud' }).beepLevel).toBe(60);
  });
});

describe('testSequence', () => {
  const all = { ...DEFAULT_AUDIO_SETTINGS };

  it('plays the countdown, the voice line (no phase tone over it), then the fanfare', () => {
    expect(testSequence(all)).toEqual({
      lead: ['pip', 'pip', 'lastPip'], speak: true, voiceExtras: [], tail: ['finish'],
    });
  });

  it('leaves the countdown out when beeps are off', () => {
    expect(testSequence({ ...all, beeps: false }).lead).toEqual([]);
    expect(testSequence({ ...all, beeps: false, voice: false }).lead).toEqual(['run', 'finish']);
  });

  it('leaves the fanfare out when it is off', () => {
    expect(testSequence({ ...all, fanfare: false }).tail).toEqual([]);
  });

  it('plays the fanfare right after the tones when the voice is off', () => {
    expect(testSequence({ ...all, voice: false })).toEqual({
      lead: ['pip', 'pip', 'lastPip', 'run', 'finish'], speak: false, voiceExtras: [], tail: [],
    });
  });

  it('adds the intense coach line to the sample announcement', () => {
    expect(testSequence({ ...all, voiceStyle: 'intense' }).voiceExtras).toEqual(['coach.run']);
  });

  it('plays nothing at volume 0', () => {
    expect(testSequence({ ...all, volume: 0 })).toEqual({ lead: [], speak: false, voiceExtras: [], tail: [] });
  });
});
