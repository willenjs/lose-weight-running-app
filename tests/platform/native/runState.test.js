import { describe, it, expect } from 'vitest';
import { reconcile } from '../../../src/platform/native/runState.js';

const session = { workoutId: 'w1d1', startedAt: 1000, pausedAt: null, pausedTotalMs: 0, skippedMs: 0 };
const state = (patch = {}) => ({ runId: 1000, revision: 5, ended: null, session, ...patch });

describe('reconcile', () => {
  it('ignores nothing to compare', () => {
    expect(reconcile(null, -1, state())).toEqual({ type: 'ignore' });
    expect(reconcile(1000, -1, null)).toEqual({ type: 'ignore' });
  });

  it('ignores a different run', () => {
    expect(reconcile(999, -1, state())).toEqual({ type: 'ignore' });
  });

  it('adopts a newer revision', () => {
    expect(reconcile(1000, 4, state())).toEqual({ type: 'adopt', session });
  });

  it('ignores a revision it already has', () => {
    expect(reconcile(1000, 5, state())).toEqual({ type: 'ignore' });
    expect(reconcile(1000, 6, state())).toEqual({ type: 'ignore' });
  });

  it('reports a stopped run, whatever the revision', () => {
    expect(reconcile(1000, 9, state({ ended: 'stopped' }))).toEqual({ type: 'stopped' });
  });

  it('reports a finished run with its final session', () => {
    expect(reconcile(1000, 9, state({ ended: 'finished' }))).toEqual({ type: 'finished', session });
  });
});
