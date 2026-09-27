import { describe, it, expect } from 'vitest';
import { PLAN, findWorkout, totalSeconds, groupByWeek, phaseSeconds, phaseRole } from '../../src/core/plan.js';

// Totals (in minutes) exactly as printed on each screenshot in image-sources/.
const SCREENSHOT_TOTALS = {
  w1d1: 21, w1d2: 23, w1d3: 23,
  w2d1: 21, w2d2: 23, w2d3: 21,
  w3d1: 27, w3d2: 27, w3d3: 23,
  w4d1: 27, w4d2: 26, w4d3: 34,
  w5d1: 34, w5d2: 27, w5d3: 34,
};

describe('PLAN', () => {
  it('has 15 workouts in week/day order with unique ids', () => {
    expect(PLAN.map((w) => w.id)).toEqual(Object.keys(SCREENSHOT_TOTALS));
    expect(new Set(PLAN.map((w) => w.id)).size).toBe(15);
  });

  it('matches every screenshot total', () => {
    for (const workout of PLAN) {
      expect(totalSeconds(workout), workout.id).toBe(SCREENSHOT_TOTALS[workout.id] * 60);
    }
  });

  it('ends every workout with a 5-minute run', () => {
    for (const workout of PLAN) {
      expect(workout.phases.at(-1), workout.id).toEqual({ type: 'run', seconds: 300 });
    }
  });

  it('transcribes the 7-phase workouts exactly', () => {
    expect(findWorkout('w4d2').phases.map((p) => [p.type, p.seconds])).toEqual([
      ['walk', 300], ['jog', 120], ['walk', 300], ['jog', 120], ['walk', 300], ['jog', 120], ['run', 300],
    ]);
    expect(findWorkout('w4d3').phases.map((p) => [p.type, p.seconds])).toEqual([
      ['walk', 420], ['jog', 120], ['walk', 420], ['jog', 180], ['walk', 420], ['jog', 180], ['run', 300],
    ]);
  });
});

describe('findWorkout', () => {
  it('returns the workout with week and day', () => {
    expect(findWorkout('w3d2')).toMatchObject({ id: 'w3d2', week: 3, day: 2 });
  });

  it('returns null for an unknown id', () => {
    expect(findWorkout('w9d9')).toBeNull();
  });
});

describe('groupByWeek', () => {
  it('groups into 5 weeks of 3 days', () => {
    const weeks = groupByWeek(PLAN);
    expect(weeks.map((w) => w.week)).toEqual([1, 2, 3, 4, 5]);
    expect(weeks.every((w) => w.workouts.length === 3)).toBe(true);
    expect(weeks[1].workouts.map((w) => w.id)).toEqual(['w2d1', 'w2d2', 'w2d3']);
  });
});

describe('phaseSeconds', () => {
  it('sums seconds per phase type', () => {
    expect(phaseSeconds(findWorkout('w2d2'))).toEqual({ walk: 840, jog: 240, run: 300 });
    expect(phaseSeconds(findWorkout('w4d2'))).toEqual({ walk: 900, jog: 360, run: 300 });
  });

  it('adds up to the workout total', () => {
    for (const workout of PLAN) {
      const { walk, jog, run } = phaseSeconds(workout);
      expect(walk + jog + run, workout.id).toBe(totalSeconds(workout));
    }
  });
});

describe('phaseRole', () => {
  it('labels warm-up, build, recovery and finale', () => {
    const workout = findWorkout('w4d2'); // W J W J W J R
    expect(workout.phases.map((_, i) => phaseRole(workout, i))).toEqual([
      'warmup', 'build', 'recovery', 'build', 'recovery', 'build', 'finale',
    ]);
  });

  it('treats a run that is not last as build', () => {
    const workout = { id: 'x', week: 1, day: 1, phases: [
      { type: 'walk', seconds: 60 }, { type: 'run', seconds: 60 }, { type: 'walk', seconds: 60 },
    ] };
    expect(workout.phases.map((_, i) => phaseRole(workout, i))).toEqual(['warmup', 'build', 'recovery']);
  });
});
