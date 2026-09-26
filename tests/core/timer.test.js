import { describe, it, expect } from 'vitest';
import { findWorkout } from '../../src/core/plan.js';
import {
  startSession, pauseSession, resumeSession, skipPhase, getState,
  formatClock, shouldOfferResume, RESUME_MAX_AGE_MS,
} from '../../src/core/timer.js';

const w = findWorkout('w1d1'); // 360/120/360/120/300 s, total 1260 s
const T0 = 1_000_000;
const s = (seconds) => seconds * 1000;
const fresh = () => startSession('w1d1', T0);

describe('getState', () => {
  it('starts in the first phase with its full duration', () => {
    expect(getState(fresh(), w, T0)).toEqual({
      phaseIndex: 0, phaseRemainingMs: s(360), totalRemainingMs: s(1260),
      elapsedMs: 0, finished: false, paused: false,
    });
  });

  it('moves to the next phase exactly at the boundary', () => {
    expect(getState(fresh(), w, T0 + s(360) - 1).phaseIndex).toBe(0);
    expect(getState(fresh(), w, T0 + s(360)).phaseIndex).toBe(1);
    expect(getState(fresh(), w, T0 + s(360)).phaseRemainingMs).toBe(s(120));
  });

  it('is finished exactly at the total', () => {
    expect(getState(fresh(), w, T0 + s(1260))).toMatchObject({
      finished: true, phaseIndex: 4, phaseRemainingMs: 0, totalRemainingMs: 0,
    });
    expect(getState(fresh(), w, T0 + s(1260) - 1).finished).toBe(false);
  });

  it('clamps past the end', () => {
    expect(getState(fresh(), w, T0 + s(5000)).elapsedMs).toBe(s(1260));
  });

  it('treats a clock that went backwards as the start', () => {
    expect(getState(fresh(), w, T0 - 5000)).toMatchObject({ elapsedMs: 0, phaseIndex: 0 });
  });
});

describe('pause and resume', () => {
  it('freezes time while paused', () => {
    const paused = pauseSession(fresh(), T0 + s(10));
    expect(getState(paused, w, T0 + s(500))).toMatchObject({ elapsedMs: s(10), paused: true });
  });

  it('does not count paused time after resume', () => {
    const paused = pauseSession(fresh(), T0 + s(10));
    const resumed = resumeSession(paused, T0 + s(100));
    expect(getState(resumed, w, T0 + s(110))).toMatchObject({ elapsedMs: s(20), paused: false });
  });

  it('accumulates multiple pauses', () => {
    let session = pauseSession(fresh(), T0 + s(10));
    session = resumeSession(session, T0 + s(20));
    session = pauseSession(session, T0 + s(30));
    session = resumeSession(session, T0 + s(50));
    expect(getState(session, w, T0 + s(60)).elapsedMs).toBe(s(30));
  });

  it('ignores pause when paused and resume when running', () => {
    const paused = pauseSession(fresh(), T0 + s(10));
    expect(pauseSession(paused, T0 + s(20))).toBe(paused);
    const running = fresh();
    expect(resumeSession(running, T0 + s(20))).toBe(running);
  });

  it('keeps a restored paused session paused with the same elapsed time', () => {
    const paused = pauseSession(fresh(), T0 + s(10));
    const restored = JSON.parse(JSON.stringify(paused));
    expect(getState(restored, w, T0 + s(3000))).toMatchObject({ elapsedMs: s(10), paused: true });
  });
});

describe('skipPhase', () => {
  it('jumps to the start of the next phase', () => {
    const skipped = skipPhase(fresh(), w, T0 + s(100));
    expect(getState(skipped, w, T0 + s(100))).toMatchObject({ phaseIndex: 1, phaseRemainingMs: s(120) });
  });

  it('keeps a paused session paused at the next phase start', () => {
    const paused = pauseSession(fresh(), T0 + s(100));
    const skipped = skipPhase(paused, w, T0 + s(200));
    expect(getState(skipped, w, T0 + s(300))).toMatchObject({
      paused: true, phaseIndex: 1, phaseRemainingMs: s(120),
    });
  });

  it('finishes the workout when skipping the last phase', () => {
    const skipped = skipPhase(fresh(), w, T0 + s(1000));
    expect(getState(skipped, w, T0 + s(1000)).finished).toBe(true);
  });

  it('does nothing when already finished', () => {
    const session = fresh();
    expect(skipPhase(session, w, T0 + s(2000))).toBe(session);
  });
});

describe('formatClock', () => {
  it('formats as mm:ss rounding up partial seconds', () => {
    expect(formatClock(s(360))).toBe('06:00');
    expect(formatClock(59_001)).toBe('01:00');
    expect(formatClock(1)).toBe('00:01');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(-5)).toBe('00:00');
    expect(formatClock(s(3600))).toBe('60:00');
  });
});

describe('shouldOfferResume', () => {
  it('offers a recent session', () => {
    expect(shouldOfferResume(fresh(), T0 + RESUME_MAX_AGE_MS - 1)).toBe(true);
  });

  it('rejects a session at or beyond the max age', () => {
    expect(shouldOfferResume(fresh(), T0 + RESUME_MAX_AGE_MS)).toBe(false);
  });

  it('rejects a session for a workout that is not in the plan', () => {
    expect(shouldOfferResume(startSession('w9d9', T0), T0 + 1000)).toBe(false);
  });
});
