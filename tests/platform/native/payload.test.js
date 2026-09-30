import { describe, it, expect } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS } from '../../../src/core/audioSettings.js';
import { findWorkout } from '../../../src/core/plan.js';
import { startSession, pauseSession, skipPhase } from '../../../src/core/timer.js';
import { workoutSchedule } from '../../../src/core/timeline.js';
import en from '../../../src/i18n/en.js';
import {
  nativeEvents, nativeTest, runPayload, announceEvent, phaseList, WATCH_LABEL_KEYS,
} from '../../../src/platform/native/payload.js';

const settings = { ...DEFAULT_AUDIO_SETTINGS, voiceVolume: 80, beepVolume: 40, fanfareVolume: 70 };
const w = findWorkout('w1d1');
const T0 = 1_000_000;
const text = (event) => ('finish' in event ? 'done' : `${event.phaseType} ${event.seconds}`);
const opts = (patch = {}) => ({
  speechText: text,
  locales: ['en-US'],
  notification: { channel: 'Workout', title: 'W1D1', text: 'Running', pausedText: 'Paused' },
  watch: { title: 'Week 1 • Day 1', labels: { walk: 'Walk' } },
  announceCurrent: false,
  ...patch,
});

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

describe('phaseList', () => {
  it('lists each phase with its bounds', () => {
    expect(phaseList(w).slice(0, 2)).toEqual([
      { type: 'walk', startMs: 0, endMs: 360_000 },
      { type: 'jog', startMs: 360_000, endMs: 480_000 },
    ]);
  });
});

describe('announceEvent', () => {
  it('is null at a phase start: the schedule already has that line', () => {
    expect(announceEvent(startSession('w1d1', T0), w, T0 + 100, DEFAULT_AUDIO_SETTINGS)).toBeNull();
    const skipped = skipPhase(startSession('w1d1', T0), w, T0 + 5000);
    expect(announceEvent(skipped, w, T0 + 5000, DEFAULT_AUDIO_SETTINGS)).toBeNull();
  });

  it('is the current phase with its remaining time mid-phase', () => {
    expect(announceEvent(startSession('w1d1', T0), w, T0 + 60_000, DEFAULT_AUDIO_SETTINGS))
      .toEqual({ kind: 'speech', inMs: 0, phaseType: 'walk', seconds: 300, extraKeys: [] });
  });

  it('is null when paused or with the voice off', () => {
    const paused = pauseSession(startSession('w1d1', T0), T0 + 60_000);
    expect(announceEvent(paused, w, T0 + 70_000, DEFAULT_AUDIO_SETTINGS)).toBeNull();
    const muted = { ...DEFAULT_AUDIO_SETTINGS, voiceVolume: 0 };
    expect(announceEvent(startSession('w1d1', T0), w, T0 + 60_000, muted)).toBeNull();
  });
});

describe('runPayload', () => {
  it('carries the session, phases, whole schedule and texts', () => {
    const session = startSession('w1d1', T0);
    const data = runPayload(session, w, T0, DEFAULT_AUDIO_SETTINGS, opts());
    expect(data.session).toEqual(session);
    expect(data.phases).toEqual(phaseList(w));
    expect(data.schedule).toEqual(nativeEvents(workoutSchedule(w, DEFAULT_AUDIO_SETTINGS), DEFAULT_AUDIO_SETTINGS, text));
    expect(data.announce).toBeNull();
    expect(data.locales).toEqual(['en-US']);
    expect(data.notification.pausedText).toBe('Paused');
    expect(data.watch.title).toBe('Week 1 • Day 1');
    expect(data).not.toHaveProperty('sentAt');
  });

  it('adds the mid-phase announcement only when asked', () => {
    const session = startSession('w1d1', T0);
    const quiet = runPayload(session, w, T0 + 60_000, DEFAULT_AUDIO_SETTINGS, opts());
    expect(quiet.announce).toBeNull();
    const loud = runPayload(session, w, T0 + 60_000, DEFAULT_AUDIO_SETTINGS, opts({ announceCurrent: true }));
    expect(loud.announce).toEqual({ text: 'walk 300', volume: DEFAULT_AUDIO_SETTINGS.voiceVolume });
  });

  it('keeps a paused session paused', () => {
    const paused = pauseSession(startSession('w1d1', T0), T0 + 5000);
    expect(runPayload(paused, w, T0 + 9000, DEFAULT_AUDIO_SETTINGS, opts()).session.pausedAt).toBe(T0 + 5000);
  });
});

describe('WATCH_LABEL_KEYS', () => {
  it('only names keys that exist', () => {
    for (const key of Object.values(WATCH_LABEL_KEYS)) expect(en).toHaveProperty([key]);
  });

  it('covers every label the watch shows', () => {
    expect(Object.keys(WATCH_LABEL_KEYS).sort()).toEqual([
      'done', 'idle', 'jog', 'last', 'next', 'pause', 'paused', 'remainingTotal', 'resume',
      'run', 'skip', 'stop', 'stopBody', 'stopKeep', 'stopTitle', 'unreachable', 'walk',
    ]);
  });
});
