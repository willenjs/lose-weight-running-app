import { describe, it, expect } from 'vitest';
import { findWorkout } from '../../src/core/plan.js';
import { startSession, pauseSession } from '../../src/core/timer.js';
import { upcomingCues, filterCues } from '../../src/core/cues.js';

const w = findWorkout('w1d1'); // 360/120/360/120/300 s
const T0 = 1_000_000;
const s = (seconds) => seconds * 1000;
const fresh = () => startSession('w1d1', T0);

describe('upcomingCues', () => {
  it('schedules every cue for a fresh session', () => {
    const cues = upcomingCues(fresh(), w, T0);
    expect(cues).toHaveLength(5 + 5 * 3 + 1);
    expect(cues.slice(0, 5)).toEqual([
      { kind: 'walk', inMs: 0 },
      { kind: 'pip', inMs: s(357) },
      { kind: 'pip', inMs: s(358) },
      { kind: 'lastPip', inMs: s(359) },
      { kind: 'jog', inMs: s(360) },
    ]);
    expect(cues.at(-1)).toEqual({ kind: 'finish', inMs: s(1260) });
    expect(cues.find((c) => c.kind === 'run')).toEqual({ kind: 'run', inMs: s(960) });
  });

  it('is sorted by time', () => {
    const times = upcomingCues(fresh(), w, T0).map((c) => c.inMs);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('drops cues that are already past and offsets the rest from now', () => {
    const cues = upcomingCues(fresh(), w, T0 + 359_500);
    expect(cues[0]).toEqual({ kind: 'jog', inMs: 500 });
  });

  it('schedules nothing while paused', () => {
    expect(upcomingCues(pauseSession(fresh(), T0 + s(10)), w, T0 + s(20))).toEqual([]);
  });

  it('schedules nothing once finished', () => {
    expect(upcomingCues(fresh(), w, T0 + s(1260))).toEqual([]);
  });
});

describe('filterCues', () => {
  const all = upcomingCues(fresh(), w, T0);
  const on = { beepVolume: 60, fanfareVolume: 60 };

  it('keeps everything when beeps and fanfare have volume', () => {
    expect(filterCues(all, on)).toEqual(all);
  });

  it('drops the countdown and phase tones at 0% beeps', () => {
    expect(filterCues(all, { ...on, beepVolume: 0 }).map((c) => c.kind)).toEqual(['finish']);
  });

  it('drops the finish melody at 0% fanfare', () => {
    const cues = filterCues(all, { ...on, fanfareVolume: 0 });
    expect(cues.some((c) => c.kind === 'finish')).toBe(false);
    expect(cues).toHaveLength(all.length - 1);
  });

  it('schedules nothing when both are at 0%', () => {
    expect(filterCues(all, { beepVolume: 0, fanfareVolume: 0 })).toEqual([]);
  });
});
