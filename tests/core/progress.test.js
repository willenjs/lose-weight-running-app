import { describe, it, expect } from 'vitest';
import { PLAN } from '../../src/core/plan.js';
import { emptyProgress, isDone, nextWorkout, markDone, unmark, programStats } from '../../src/core/progress.js';

describe('progress', () => {
  it('starts empty and suggests the first workout', () => {
    expect(emptyProgress()).toEqual({ completed: {} });
    expect(nextWorkout(PLAN, emptyProgress()).id).toBe('w1d1');
  });

  it('suggests the first workout not done, in plan order', () => {
    let progress = markDone(emptyProgress(), 'w1d1', '2026-09-26T10:00:00.000Z');
    progress = markDone(progress, 'w1d3', '2026-09-27T10:00:00.000Z');
    expect(nextWorkout(PLAN, progress).id).toBe('w1d2');
  });

  it('returns null when every workout is done', () => {
    const progress = PLAN.reduce((p, w) => markDone(p, w.id, '2026-09-26T10:00:00.000Z'), emptyProgress());
    expect(nextWorkout(PLAN, progress)).toBeNull();
  });

  it('marks and unmarks without mutating the input', () => {
    const before = emptyProgress();
    const done = markDone(before, 'w2d1', '2026-09-26T10:00:00.000Z');
    expect(before).toEqual({ completed: {} });
    expect(isDone(done, 'w2d1')).toBe(true);
    const undone = unmark(done, 'w2d1');
    expect(isDone(undone, 'w2d1')).toBe(false);
    expect(isDone(done, 'w2d1')).toBe(true);
  });

  it('overwrites the date when a workout is repeated', () => {
    let progress = markDone(emptyProgress(), 'w1d1', '2026-09-26T10:00:00.000Z');
    progress = markDone(progress, 'w1d1', '2026-10-01T10:00:00.000Z');
    expect(progress.completed.w1d1).toBe('2026-10-01T10:00:00.000Z');
  });

  it('does not treat inherited object keys as done', () => {
    expect(isDone(emptyProgress(), 'toString')).toBe(false);
  });
});

describe('programStats', () => {
  const at = '2026-09-26T10:00:00.000Z';
  const doneIds = (...ids) => ids.reduce((p, id) => markDone(p, id, at), emptyProgress());

  it('starts at zero in week 1', () => {
    expect(programStats(PLAN, emptyProgress())).toEqual({
      done: 0, total: 15, percent: 0, doneMinutes: 0, currentWeek: 1,
    });
  });

  it('counts done workouts, minutes and the week of the next workout', () => {
    // 21 + 23 + 23 + 21 minutes.
    expect(programStats(PLAN, doneIds('w1d1', 'w1d2', 'w1d3', 'w2d1'))).toEqual({
      done: 4, total: 15, percent: 27, doneMinutes: 88, currentWeek: 2,
    });
  });

  it('reports the last week when everything is done', () => {
    const all = doneIds(...PLAN.map((w) => w.id));
    expect(programStats(PLAN, all)).toEqual({
      done: 15, total: 15, percent: 100, doneMinutes: 391, currentWeek: 5,
    });
  });

  it('ignores stored ids that are not in the plan', () => {
    expect(programStats(PLAN, doneIds('w1d1', 'w9d9'))).toMatchObject({ done: 1, percent: 7, doneMinutes: 21 });
  });
});
