import { describe, it, expect, vi } from 'vitest';
import { findWorkout } from '../../../src/core/plan.js';
import { startSession, pauseSession } from '../../../src/core/timer.js';
import { DEFAULT_AUDIO_SETTINGS } from '../../../src/core/audioSettings.js';
import { createNativeCueEngine } from '../../../src/platform/native/nativeCueEngine.js';

const w = findWorkout('w1d1');
const T0 = 1_000_000;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakePlugin() {
  let grant;
  const listeners = {};
  return {
    permission: new Promise((resolve) => { grant = resolve; }),
    grant: () => grant(),
    current: vi.fn(() => Promise.resolve({ state: null })),
    emit: (name, data) => listeners[name]?.(data),
    addListener: vi.fn((name, callback) => { listeners[name] = callback; return Promise.resolve({ remove() {} }); }),
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
    test: vi.fn(() => Promise.resolve()),
    requestPermissions() { return this.permission; },
  };
}

function engineWith(plugin, onFailure = vi.fn(), clock = () => T0) {
  return createNativeCueEngine({
    plugin,
    clock,
    locales: () => ['en-US'],
    speechText: (event) => ('finish' in event ? 'done' : `${event.phaseType} ${event.seconds}`),
    notification: (workout) => ({ channel: 'Workout', title: `W${workout.week}D${workout.day}`, text: 'Running', pausedText: 'Paused' }),
    watch: () => ({ title: 'Week 1 • Day 1', labels: { walk: 'Walk' } }),
    onFailure,
  });
}

const running = startSession('w1d1', T0);
const syncOpts = { announceCurrent: true };

describe('createNativeCueEngine', () => {
  it('speaks in the background', () => {
    expect(engineWith(fakePlugin()).speaksInBackground).toBe(true);
  });

  it('asks for permission once, then sends the run payload', async () => {
    const plugin = fakePlugin();
    const engine = engineWith(plugin);
    expect(engine.sync(running, w, T0, DEFAULT_AUDIO_SETTINGS, syncOpts)).toBe(true);
    plugin.grant();
    await flush();
    expect(plugin.start).toHaveBeenCalledTimes(1);
    const data = plugin.start.mock.calls[0][0];
    expect(data.session).toEqual(running);
    expect(data.locales).toEqual(['en-US']);
    expect(data.notification.pausedText).toBe('Paused');
    expect(data.watch.title).toBe('Week 1 • Day 1');
    expect(data.schedule[0]).toEqual({ type: 'tone', atMs: 0, tone: 'walk', volume: DEFAULT_AUDIO_SETTINGS.beepVolume });
    expect(data.announce).toBeNull();
  });

  it('pause sends the paused session, never stop', async () => {
    const plugin = fakePlugin();
    const engine = engineWith(plugin);
    plugin.grant();
    engine.sync(pauseSession(running, T0 + 5000), w, T0 + 5000, DEFAULT_AUDIO_SETTINGS, { announceCurrent: false });
    await flush();
    expect(plugin.stop).not.toHaveBeenCalled();
    expect(plugin.start.mock.calls[0][0].session.pausedAt).toBe(T0 + 5000);
  });

  it('announces where the runner is when a slow permission prompt delayed the start', async () => {
    const plugin = fakePlugin();
    let time = T0;
    const engine = engineWith(plugin, vi.fn(), () => time);
    engine.sync(running, w, T0, DEFAULT_AUDIO_SETTINGS, { announceCurrent: false });
    time = T0 + 4000;
    plugin.grant();
    await flush();
    expect(plugin.start.mock.calls[0][0].announce).toEqual({ text: 'walk 356', volume: DEFAULT_AUDIO_SETTINGS.voiceVolume });
  });

  it('does not start after a stop that came while waiting for permission', async () => {
    const plugin = fakePlugin();
    const engine = engineWith(plugin);
    engine.sync(running, w, T0, DEFAULT_AUDIO_SETTINGS, syncOpts);
    engine.stop();
    plugin.grant();
    await flush();
    expect(plugin.start).not.toHaveBeenCalled();
    expect(plugin.stop).toHaveBeenCalledWith({ reason: 'stopped' });
  });

  it('reports a failed start', async () => {
    const plugin = fakePlugin();
    const error = new Error('no service');
    plugin.start = vi.fn(() => Promise.reject(error));
    const onFailure = vi.fn();
    engineWith(plugin, onFailure).sync(running, w, T0, DEFAULT_AUDIO_SETTINGS, syncOpts);
    plugin.grant();
    await flush();
    expect(onFailure).toHaveBeenCalledWith(error);
  });

  it('passes newer states of its run to the listener, once', async () => {
    const plugin = fakePlugin();
    const engine = engineWith(plugin);
    const listener = vi.fn();
    engine.onRunState(listener);
    plugin.grant();
    engine.sync(running, w, T0, DEFAULT_AUDIO_SETTINGS, syncOpts);
    const paused = pauseSession(running, T0 + 9000);
    plugin.emit('stateChanged', { runId: T0, revision: 3, ended: null, session: paused });
    plugin.emit('stateChanged', { runId: T0, revision: 3, ended: null, session: paused });
    plugin.emit('stateChanged', { runId: 42, revision: 9, ended: null, session: paused });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ type: 'adopt', session: paused });
  });

  it('ignores states after its own stop', () => {
    const plugin = fakePlugin();
    const engine = engineWith(plugin);
    const listener = vi.fn();
    engine.onRunState(listener);
    engine.sync(running, w, T0, DEFAULT_AUDIO_SETTINGS, syncOpts);
    engine.stop();
    plugin.emit('stateChanged', { runId: T0, revision: 3, ended: 'stopped', session: running });
    expect(listener).not.toHaveBeenCalled();
  });

  it('checks the saved state for a session it has not sent yet', async () => {
    const plugin = fakePlugin();
    plugin.current = vi.fn(() => Promise.resolve({ state: { runId: T0, revision: 7, ended: 'stopped', session: running } }));
    const engine = engineWith(plugin);
    const listener = vi.fn();
    engine.onRunState(listener);
    engine.checkRunState(running);
    await flush();
    expect(listener).toHaveBeenCalledWith({ type: 'stopped' });
  });

  describe('confirmFinish', () => {
    // w1d1 lasts 30 minutes: by T0 + 40 min the running session is over locally.
    const LATE = T0 + 40 * 60_000;

    function confirmWith(state, { clockAt = LATE, reject = false } = {}) {
      const plugin = fakePlugin();
      plugin.current = vi.fn(() => (reject ? Promise.reject(new Error('gone')) : Promise.resolve({ state })));
      const engine = engineWith(plugin, vi.fn(), () => clockAt);
      const listener = vi.fn();
      engine.onRunState(listener);
      return { plugin, engine, listener };
    }

    it('adopts the session the watch paused instead of finishing', async () => {
      const paused = pauseSession(running, T0 + 60_000);
      const { engine, listener } = confirmWith({ runId: T0, revision: 4, ended: null, session: paused });
      engine.confirmFinish(running, w);
      await flush();
      expect(listener).toHaveBeenCalledWith({ type: 'adopt', session: paused });
    });

    it('finishes with the local session when the service has no state for the run', async () => {
      const { engine, listener } = confirmWith({ runId: 42, revision: 4, ended: null, session: running });
      engine.confirmFinish(running, w);
      await flush();
      expect(listener).toHaveBeenCalledWith({ type: 'finished', session: running });
    });

    it('finishes with the local session when the service cannot be asked', async () => {
      const { engine, listener } = confirmWith(null, { reject: true });
      engine.confirmFinish(running, w);
      await flush();
      expect(listener).toHaveBeenCalledWith({ type: 'finished', session: running });
    });

    it('finishes when the service still runs a session that is over by the clock', async () => {
      const { engine, listener } = confirmWith({ runId: T0, revision: 4, ended: null, session: running });
      engine.confirmFinish(running, w);
      await flush();
      expect(listener).toHaveBeenCalledWith({ type: 'finished', session: running });
    });

    it('ends the run the service stopped', async () => {
      const { engine, listener } = confirmWith({ runId: T0, revision: 4, ended: 'stopped', session: running });
      engine.confirmFinish(running, w);
      await flush();
      expect(listener).toHaveBeenCalledWith({ type: 'stopped' });
    });

    it('asks the service once while an answer is pending', async () => {
      const { plugin, engine, listener } = confirmWith({ runId: T0, revision: 4, ended: 'finished', session: running });
      engine.confirmFinish(running, w);
      engine.confirmFinish(running, w);
      engine.confirmFinish(running, w);
      await flush();
      expect(plugin.current).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledTimes(1);
      engine.confirmFinish(running, w);
      expect(plugin.current).toHaveBeenCalledTimes(2);
    });

    it('finishes after a local skip to the end the service has not received yet', async () => {
      const state = { runId: T0, revision: 4, ended: null, session: pauseSession(running, T0 + 60_000) };
      const { plugin, engine, listener } = confirmWith(state);
      engine.sync(running, w, T0, DEFAULT_AUDIO_SETTINGS, syncOpts);
      plugin.emit('stateChanged', state); // the echo of the app's last change
      listener.mockClear();
      engine.confirmFinish(running, w);
      await flush();
      expect(listener).toHaveBeenCalledWith({ type: 'finished', session: running });
    });

    it('drops the answer after a stop', async () => {
      const { engine, listener } = confirmWith({ runId: T0, revision: 4, ended: 'finished', session: running });
      engine.confirmFinish(running, w);
      engine.stop();
      await flush();
      expect(listener).not.toHaveBeenCalled();
    });

    it('does not re-deliver the adopted revision as a state change', async () => {
      const paused = pauseSession(running, T0 + 60_000);
      const state = { runId: T0, revision: 4, ended: null, session: paused };
      const { plugin, engine, listener } = confirmWith(state);
      engine.confirmFinish(running, w);
      await flush();
      plugin.emit('stateChanged', state);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  it('only finishes the latest audio test', async () => {
    const plugin = fakePlugin();
    const resolvers = [];
    plugin.test = vi.fn(() => new Promise((resolve) => resolvers.push(resolve)));
    const engine = engineWith(plugin);
    const first = vi.fn();
    const second = vi.fn();
    engine.test(DEFAULT_AUDIO_SETTINGS, 'sample', first);
    engine.test(DEFAULT_AUDIO_SETTINGS, 'sample', second);
    resolvers[0]();
    await flush();
    expect(first).not.toHaveBeenCalled();
    resolvers[1]();
    await flush();
    expect(second).toHaveBeenCalledTimes(1);
    expect(plugin.test.mock.calls[0][0]).toEqual(expect.objectContaining({ locales: ['en-US'] }));
  });

  it('finishes a failed audio test too', async () => {
    const plugin = fakePlugin();
    plugin.test = vi.fn(() => Promise.reject(new Error('no audio')));
    const onDone = vi.fn();
    engineWith(plugin).test(DEFAULT_AUDIO_SETTINGS, null, onDone);
    await flush();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
