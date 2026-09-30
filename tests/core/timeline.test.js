import { describe, it, expect } from 'vitest';
import { findWorkout } from '../../src/core/plan.js';
import { startSession, pauseSession, skipPhase, resumeSession } from '../../src/core/timer.js';
import { upcomingCues } from '../../src/core/cues.js';
import { coachExtras } from '../../src/core/coach.js';
import { DEFAULT_AUDIO_SETTINGS } from '../../src/core/audioSettings.js';
import { buildTimeline, workoutSchedule, scheduleFrom } from '../../src/core/timeline.js';

const w = findWorkout('w1d1'); // 360/120/360/120/300 s; phases start at 0, 360, 480, 840, 960; ends at 1260
const T0 = 1_000_000;
const s = (seconds) => seconds * 1000;
const fresh = () => startSession('w1d1', T0);
const settings = (patch = {}) => ({ ...DEFAULT_AUDIO_SETTINGS, ...patch });
const speech = (events) => events.filter((e) => e.kind === 'speech');
const tones = (events) => events.filter((e) => e.kind === 'tone');
const announce = { announceCurrent: true };

describe('buildTimeline', () => {
  it('has a tone for every upcoming cue', () => {
    const events = buildTimeline(fresh(), w, T0, settings(), announce);
    expect(tones(events)).toEqual(
      upcomingCues(fresh(), w, T0).map((c) => ({ kind: 'tone', tone: c.kind, inMs: c.inMs })),
    );
  });

  it('announces every phase at its start and the finish at the end', () => {
    expect(speech(buildTimeline(fresh(), w, T0, settings(), announce))).toEqual([
      { kind: 'speech', inMs: 0, phaseType: 'walk', seconds: 360, extraKeys: [] },
      { kind: 'speech', inMs: s(360), phaseType: 'jog', seconds: 120, extraKeys: [] },
      { kind: 'speech', inMs: s(480), phaseType: 'walk', seconds: 360, extraKeys: [] },
      { kind: 'speech', inMs: s(840), phaseType: 'jog', seconds: 120, extraKeys: [] },
      { kind: 'speech', inMs: s(960), phaseType: 'run', seconds: 300, extraKeys: [] },
      { kind: 'speech', inMs: s(1260), finish: true },
    ]);
  });

  it('puts a tone before speech at the same moment and keeps time order', () => {
    const events = buildTimeline(fresh(), w, T0, settings(), announce);
    expect(events.slice(0, 2)).toEqual([
      { kind: 'tone', tone: 'walk', inMs: 0 },
      { kind: 'speech', inMs: 0, phaseType: 'walk', seconds: 360, extraKeys: [] },
    ]);
    expect(events.at(-2)).toEqual({ kind: 'tone', tone: 'finish', inMs: s(1260) });
    expect(events.at(-1)).toEqual({ kind: 'speech', inMs: s(1260), finish: true });
    const times = events.map((e) => e.inMs);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('announces the current phase with its remaining time only when asked', () => {
    const now = T0 + s(100);
    expect(speech(buildTimeline(fresh(), w, now, settings(), { announceCurrent: true }))[0])
      .toEqual({ kind: 'speech', inMs: 0, phaseType: 'walk', seconds: 260, extraKeys: [] });
    expect(speech(buildTimeline(fresh(), w, now, settings(), { announceCurrent: false }))[0])
      .toEqual({ kind: 'speech', inMs: s(260), phaseType: 'jog', seconds: 120, extraKeys: [] });
  });

  it('rounds the remaining seconds of the current phase', () => {
    // 259.6 s left in the first walk.
    expect(speech(buildTimeline(fresh(), w, T0 + 100_400, settings(), announce))[0].seconds).toBe(260);
  });

  it('announces the new phase after a skip', () => {
    const skipped = skipPhase(fresh(), w, T0 + s(30));
    expect(buildTimeline(skipped, w, T0 + s(30), settings(), announce).slice(0, 2)).toEqual([
      { kind: 'tone', tone: 'jog', inMs: 0 },
      { kind: 'speech', inMs: 0, phaseType: 'jog', seconds: 120, extraKeys: [] },
    ]);
  });

  it('keeps the phase tone when built a few ms after a start or skip', () => {
    expect(buildTimeline(fresh(), w, T0 + 9, settings(), announce).slice(0, 2)).toEqual([
      { kind: 'tone', tone: 'walk', inMs: 0 },
      { kind: 'speech', inMs: 0, phaseType: 'walk', seconds: 360, extraKeys: [] },
    ]);
    const skipped = skipPhase(fresh(), w, T0 + s(30));
    expect(buildTimeline(skipped, w, T0 + s(30) + 15, settings(), announce)[0])
      .toEqual({ kind: 'tone', tone: 'jog', inMs: 0 });
  });

  it('has no speech when the voice is off', () => {
    const events = buildTimeline(fresh(), w, T0, settings({ voiceVolume: 0 }), announce);
    expect(speech(events)).toEqual([]);
    expect(tones(events)).toHaveLength(21);
  });

  it('drops tones whose volume is off', () => {
    const events = buildTimeline(fresh(), w, T0, settings({ beepVolume: 0, fanfareVolume: 0 }), announce);
    expect(tones(events)).toEqual([]);
    expect(speech(events)).toHaveLength(6);
  });

  it('adds coach lines in intense style', () => {
    const events = buildTimeline(fresh(), w, T0, settings({ voiceStyle: 'intense' }), announce);
    speech(events).slice(0, 5).forEach((event, i) => {
      expect(event.extraKeys).toEqual(coachExtras(w, i, 'intense'));
    });
  });

  it('is empty while paused or once finished', () => {
    const paused = pauseSession(fresh(), T0 + s(10));
    expect(buildTimeline(paused, w, T0 + s(20), settings(), announce)).toEqual([]);
    expect(buildTimeline(fresh(), w, T0 + s(1260), settings(), announce)).toEqual([]);
  });
});

describe('workoutSchedule', () => {
  it('is the timeline of a fresh start, in workout time', () => {
    expect(workoutSchedule(w, settings())).toEqual(buildTimeline(fresh(), w, T0, settings(), announce));
  });

  it('does not depend on any session', () => {
    const events = workoutSchedule(w, settings());
    expect(events[0]).toEqual({ kind: 'tone', tone: 'walk', inMs: 0 });
    expect(speech(events).at(-1)).toEqual({ kind: 'speech', inMs: s(1260), finish: true });
  });
});

describe('scheduleFrom', () => {
  const shift = (events, elapsed) => events.map((e) => ({ ...e, inMs: e.inMs - elapsed }));

  it('after a skip, matches the timeline the app builds after the skip', () => {
    const now = T0 + s(100);
    const skipped = skipPhase(fresh(), w, now); // lands on 360 s
    const ahead = scheduleFrom(workoutSchedule(w, settings()), s(360));
    expect(shift(ahead, s(360))).toEqual(buildTimeline(skipped, w, now, settings(), announce));
  });

  it('mid-phase, matches the timeline of a resume (no announcement)', () => {
    const running = { ...fresh(), pausedTotalMs: 0 };
    const now = T0 + s(100);
    const ahead = scheduleFrom(workoutSchedule(w, settings()), s(100));
    expect(shift(ahead, s(100))).toEqual(buildTimeline(running, w, now, settings()));
  });

  it('keeps events that fell due within the grace window', () => {
    const ahead = scheduleFrom(workoutSchedule(w, settings()), s(360) + 200);
    expect(ahead[0]).toEqual({ kind: 'tone', tone: 'jog', inMs: s(360) });
    expect(speech(ahead)[0]).toMatchObject({ inMs: s(360), phaseType: 'jog' });
  });

  it('drops events older than the grace window', () => {
    const ahead = scheduleFrom(workoutSchedule(w, settings()), s(360) + 300);
    expect(ahead.some((e) => e.inMs === s(360))).toBe(false);
  });
});
