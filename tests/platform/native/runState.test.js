import { describe, it, expect } from 'vitest';
import { reconcile, confirmFinish } from '../../../src/platform/native/runState.js';

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

describe('confirmFinish', () => {
  const over = () => true;
  const notOver = () => false;
  const paused = { ...session, pausedAt: 5000 };

  it('finishes with the local session when the service has no state', () => {
    expect(confirmFinish(session, -1, null, notOver)).toEqual({ type: 'finished', session });
  });

  it('finishes with the local session when the service reports another run', () => {
    expect(confirmFinish(session, -1, state({ runId: 42, session: paused }), notOver)).toEqual({ type: 'finished', session });
  });

  it('finishes when the service finished the run', () => {
    expect(confirmFinish(session, -1, state({ ended: 'finished', session: paused }), notOver))
      .toEqual({ type: 'finished', session: paused });
  });

  it('ends the run when the service stopped it', () => {
    expect(confirmFinish(session, -1, state({ ended: 'stopped' }), over)).toEqual({ type: 'stopped' });
  });

  it('adopts a session the watch paused instead of finishing', () => {
    expect(confirmFinish(session, -1, state({ session: paused }), notOver)).toEqual({ type: 'adopt', session: paused });
  });

  it('adopts a running session that is not over yet', () => {
    const resumed = { ...session, pausedTotalMs: 60_000 };
    expect(confirmFinish(session, -1, state({ session: resumed }), notOver)).toEqual({ type: 'adopt', session: resumed });
  });

  it('finishes with the local session when the service has nothing newer', () => {
    // e.g. a skip to the end the service has not received yet
    expect(confirmFinish(session, 5, state({ session: paused }), notOver)).toEqual({ type: 'finished', session });
    expect(confirmFinish(session, 6, state({ session: paused }), notOver)).toEqual({ type: 'finished', session });
  });

  it('finishes when the active service session is over by the clock too', () => {
    expect(confirmFinish(session, -1, state(), over)).toEqual({ type: 'finished', session });
  });
});
