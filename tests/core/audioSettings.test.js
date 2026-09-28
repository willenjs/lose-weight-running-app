import { describe, it, expect } from 'vitest';
import {
  DEFAULT_AUDIO_SETTINGS, VOLUME_PRESETS, VOICE_STYLES,
  normalizeAudioSettings, volumeLevel, isMuted,
} from '../../src/core/audioSettings.js';

describe('audio settings defaults', () => {
  it('keep today\'s behavior: full volume, everything on, plain commands', () => {
    expect(DEFAULT_AUDIO_SETTINGS).toEqual({
      volume: 100, beeps: true, voice: true, voiceStyle: 'commands', fanfare: true,
    });
    expect(Object.isFrozen(DEFAULT_AUDIO_SETTINGS)).toBe(true);
  });

  it('offer mute, medium, strong and max presets and two coach styles', () => {
    expect(VOLUME_PRESETS).toEqual([0, 50, 80, 100]);
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
      volume: 40, beeps: true, voice: false, voiceStyle: 'commands', fanfare: true,
    });
    expect(normalizeAudioSettings({ voiceStyle: 'intense', beeps: false, fanfare: false })).toEqual({
      volume: 100, beeps: false, voice: true, voiceStyle: 'intense', fanfare: false,
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
