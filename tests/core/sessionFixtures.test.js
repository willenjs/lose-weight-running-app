import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { findWorkout } from '../../src/core/plan.js';
import {
  elapsedMs, pauseSession, resumeSession, skipPhase, phaseBoundaries, formatClock,
} from '../../src/core/timer.js';

// Also read by the Java (phone) and Kotlin (watch) unit tests, so all three
// implementations of the session arithmetic stay in step.
const fixtures = JSON.parse(readFileSync(new URL('../fixtures/session-math.json', import.meta.url), 'utf8'));
const workout = findWorkout(fixtures.workoutId);
const withId = (session) => ({ workoutId: fixtures.workoutId, ...session });
const ACTIONS = {
  pause: (session, now) => pauseSession(session, now),
  resume: (session, now) => resumeSession(session, now),
  skip: (session, now) => skipPhase(session, workout, now),
};

describe('session fixtures', () => {
  it('describe the workout phases', () => {
    const bounds = phaseBoundaries(workout);
    expect(fixtures.phases).toEqual(bounds.map((b, i) => ({ type: workout.phases[i].type, ...b })));
  });

  for (const c of fixtures.elapsed) {
    it(`elapsed: ${c.name}`, () => {
      expect(elapsedMs(withId(c.session), workout, c.now)).toBe(c.elapsedMs);
    });
  }

  for (const c of fixtures.actions) {
    it(`action: ${c.name}`, () => {
      expect(ACTIONS[c.action](withId(c.session), c.now)).toEqual(withId(c.expected));
    });
  }

  for (const c of fixtures.clock) {
    it(`clock: ${c.ms} ms`, () => {
      expect(formatClock(c.ms)).toBe(c.text);
    });
  }
});
