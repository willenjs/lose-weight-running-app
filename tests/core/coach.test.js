import { describe, it, expect } from 'vitest';
import { findWorkout } from '../../src/core/plan.js';
import { coachExtras } from '../../src/core/coach.js';

const w1d1 = findWorkout('w1d1'); // walk 6, jog 2, walk 6, jog 2, run 5 (min); half = 10.5 min
const w4d2 = findWorkout('w4d2'); // 5/2/5/2/5/2/5 (min); half = 13 min

describe('coachExtras', () => {
  it('adds nothing in commands style', () => {
    for (let i = 0; i < w1d1.phases.length; i++) expect(coachExtras(w1d1, i, 'commands')).toEqual([]);
  });

  it('adds a line for the phase type in intense style', () => {
    expect(coachExtras(w1d1, 0, 'intense')).toEqual(['coach.walk']);
    expect(coachExtras(w1d1, 1, 'intense')).toEqual(['coach.jog']);
  });

  it('marks the first phase starting at or past half the workout', () => {
    // w1d1 starts: 0, 6, 8, 14, 16 min → phase 3 is the first at/after 10.5.
    expect(coachExtras(w1d1, 2, 'intense')).toEqual(['coach.walk']);
    expect(coachExtras(w1d1, 3, 'intense')).toEqual(['coach.jog', 'coach.halfway']);
    // w4d2 starts: 0, 5, 7, 12, 14, 19, 21 → phase 4.
    expect(coachExtras(w4d2, 3, 'intense')).toEqual(['coach.jog']);
    expect(coachExtras(w4d2, 4, 'intense')).toEqual(['coach.walk', 'coach.halfway']);
    expect(coachExtras(w4d2, 5, 'intense')).toEqual(['coach.jog']);
  });

  it('announces the last phase', () => {
    expect(coachExtras(w1d1, 4, 'intense')).toEqual(['coach.run', 'coach.last']);
  });

  it('says only "last" when the halfway phase is also the last one', () => {
    const workout = { id: 'x', week: 1, day: 1, phases: [{ type: 'walk', seconds: 600 }, { type: 'run', seconds: 60 }] };
    expect(coachExtras(workout, 1, 'intense')).toEqual(['coach.run', 'coach.last']);
  });

  it('never says halfway on the first phase', () => {
    const single = { id: 'y', week: 1, day: 1, phases: [{ type: 'jog', seconds: 60 }] };
    expect(coachExtras(single, 0, 'intense')).toEqual(['coach.jog', 'coach.last']);
    expect(coachExtras(w1d1, 0, 'intense')).not.toContain('coach.halfway');
  });
});
