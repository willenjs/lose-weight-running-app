import { describe, it, expect } from 'vitest';
import {
  PLAN, findWorkout, totalSeconds, groupByWeek, phaseSeconds, phaseRole, intervalPattern,
} from '../../src/core/plan.js';

// Totals (in minutes) exactly as given in the program's schedule.
const SCHEDULE_TOTALS = {
  w1d1: 35, w1d2: 30, w1d3: 35, w1d4: 30, w1d5: 35,
  w2d1: 40, w2d2: 30, w2d3: 40, w2d4: 30, w2d5: 40,
  w3d1: 45, w3d2: 40, w3d3: 45, w3d4: 40, w3d5: 45,
  w4d1: 46, w4d2: 45, w4d3: 46, w4d4: 45, w4d5: 46,
  w5d1: 46, w5d2: 50, w5d3: 46, w5d4: 50, w5d5: 46,
};
const WEEK_TOTALS = [165, 180, 215, 228, 238];

// Run days: [run minutes, walk minutes, repeats], same on days 1, 3 and 5.
const INTERVALS = [[3, 2, 5], [4, 2, 5], [5, 2, 5], [7, 2, 4], [10, 2, 3]];

describe('PLAN', () => {
  it('has 25 workouts in week/day order with unique ids', () => {
    expect(PLAN.map((w) => w.id)).toEqual(Object.keys(SCHEDULE_TOTALS));
    expect(new Set(PLAN.map((w) => w.id)).size).toBe(25);
  });

  it('matches every day total', () => {
    for (const workout of PLAN) {
      expect(totalSeconds(workout), workout.id).toBe(SCHEDULE_TOTALS[workout.id] * 60);
    }
  });

  it('matches every week total', () => {
    expect(groupByWeek(PLAN).map((w) => w.workouts.reduce((s, x) => s + totalSeconds(x), 0) / 60))
      .toEqual(WEEK_TOTALS);
  });

  it('makes days 2 and 4 a single brisk walk', () => {
    for (const workout of PLAN.filter((w) => w.day % 2 === 0)) {
      expect(workout.phases, workout.id).toEqual([{ type: 'walk', seconds: totalSeconds(workout) }]);
    }
  });

  it('wraps the run intervals in a 5-minute walk at each end', () => {
    for (const workout of PLAN.filter((w) => w.day % 2 === 1)) {
      const [runMin, walkMin, repeats] = INTERVALS[workout.week - 1];
      const expected = [['walk', 5]];
      for (let i = 0; i < repeats; i++) expected.push(['run', runMin], ['walk', walkMin]);
      // The last interval walk runs straight into the 5-minute cool-down.
      expected.at(-1)[1] += 5;
      expect(workout.phases.map((p) => [p.type, p.seconds / 60]), workout.id).toEqual(expected);
    }
  });
});

describe('findWorkout', () => {
  it('returns the workout with week and day', () => {
    expect(findWorkout('w3d4')).toMatchObject({ id: 'w3d4', week: 3, day: 4 });
  });

  it('returns null for an unknown id', () => {
    expect(findWorkout('w9d9')).toBeNull();
  });
});

describe('groupByWeek', () => {
  it('groups into 5 weeks of 5 days', () => {
    const weeks = groupByWeek(PLAN);
    expect(weeks.map((w) => w.week)).toEqual([1, 2, 3, 4, 5]);
    expect(weeks.every((w) => w.workouts.length === 5)).toBe(true);
    expect(weeks[1].workouts.map((w) => w.id)).toEqual(['w2d1', 'w2d2', 'w2d3', 'w2d4', 'w2d5']);
  });
});

describe('phaseSeconds', () => {
  it('sums seconds per phase type', () => {
    expect(phaseSeconds(findWorkout('w1d1'))).toEqual({ walk: 1200, jog: 0, run: 900 });
    expect(phaseSeconds(findWorkout('w2d2'))).toEqual({ walk: 1800, jog: 0, run: 0 });
  });

  it('adds up to the workout total', () => {
    for (const workout of PLAN) {
      const { walk, jog, run } = phaseSeconds(workout);
      expect(walk + jog + run, workout.id).toBe(totalSeconds(workout));
    }
  });
});

describe('phaseRole', () => {
  const roles = (workout) => workout.phases.map((_, i) => phaseRole(workout, i));

  it('labels warm-up, build, recovery and cool-down on a run day', () => {
    expect(roles(findWorkout('w5d1'))).toEqual([
      'warmup', 'build', 'recovery', 'build', 'recovery', 'build', 'cooldown',
    ]);
  });

  it('labels a single walk as a brisk walk', () => {
    expect(roles(findWorkout('w1d2'))).toEqual(['brisk']);
  });

  it('treats a last run as the finale and a run that is not last as build', () => {
    const phases = (...types) => ({ id: 'x', week: 1, day: 1, phases: types.map((type) => ({ type, seconds: 60 })) });
    expect(roles(phases('walk', 'jog', 'run'))).toEqual(['warmup', 'build', 'finale']);
    expect(roles(phases('walk', 'run', 'walk'))).toEqual(['warmup', 'build', 'cooldown']);
  });
});

describe('intervalPattern', () => {
  it('describes a run day as repeats of run and walk', () => {
    expect(intervalPattern(findWorkout('w1d1'))).toEqual({ repeats: 5, runSeconds: 180, walkSeconds: 120 });
    expect(intervalPattern(findWorkout('w5d5'))).toEqual({ repeats: 3, runSeconds: 600, walkSeconds: 120 });
  });

  it('returns null for a walk day or uneven intervals', () => {
    expect(intervalPattern(findWorkout('w1d2'))).toBeNull();
    const uneven = { id: 'x', week: 1, day: 1, phases: [
      { type: 'walk', seconds: 300 }, { type: 'run', seconds: 180 }, { type: 'walk', seconds: 120 },
      { type: 'run', seconds: 240 }, { type: 'walk', seconds: 300 },
    ] };
    expect(intervalPattern(uneven)).toBeNull();
  });
});
