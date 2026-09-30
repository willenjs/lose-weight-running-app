import { describe, it, expect, vi } from 'vitest';
import { findWorkout } from '../../../src/core/plan.js';
import { startSession } from '../../../src/core/timer.js';
import { DEFAULT_AUDIO_SETTINGS } from '../../../src/core/audioSettings.js';
import { createNativeCueEngine } from '../../../src/platform/native/nativeCueEngine.js';

const w = findWorkout('w1d1');
const T0 = 1_000_000;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakePlugin() {
  let grant;
  return {
    permission: new Promise((resolve) => { grant = resolve; }),
    grant: () => grant(),
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
    test: vi.fn(() => Promise.resolve()),
    requestPermissions() { return this.permission; },
  };
}

function engineWith(plugin, onFailure = vi.fn()) {
  return createNativeCueEngine({
    plugin,
    locales: () => ['en-US'],
    speechText: (event) => ('finish' in event ? 'done' : event.phaseType),
    notification: (workout) => ({ channel: 'Workout', title: `W${workout.week}D${workout.day}`, text: 'Running' }),
    onFailure,
  });
}

describe('createNativeCueEngine', () => {
  it('speaks in the background', () => {
    expect(engineWith(fakePlugin()).speaksInBackground).toBe(true);
  });

  it('asks for permission once, then sends the timeline', async () => {
    const plugin = fakePlugin();
    const engine = engineWith(plugin);
    expect(engine.start(startSession('w1d1', T0), w, T0, DEFAULT_AUDIO_SETTINGS, { announceCurrent: true })).toBe(true);
    plugin.grant();
    await flush();
    expect(plugin.start).toHaveBeenCalledTimes(1);
    const data = plugin.start.mock.calls[0][0];
    expect(data.locales).toEqual(['en-US']);
    expect(data.notification).toEqual({ channel: 'Workout', title: 'W1D1', text: 'Running' });
    expect(data.events[0]).toEqual({ type: 'tone', atMs: 0, tone: 'walk', volume: DEFAULT_AUDIO_SETTINGS.beepVolume });
    expect(data.events[1]).toEqual({ type: 'speech', atMs: 0, text: 'walk', volume: DEFAULT_AUDIO_SETTINGS.voiceVolume });
  });

  it('does not start after a stop that came while waiting for permission', async () => {
    const plugin = fakePlugin();
    const engine = engineWith(plugin);
    engine.start(startSession('w1d1', T0), w, T0, DEFAULT_AUDIO_SETTINGS, { announceCurrent: true });
    engine.stop();
    plugin.grant();
    await flush();
    expect(plugin.start).not.toHaveBeenCalled();
    expect(plugin.stop).toHaveBeenCalledTimes(1);
  });

  it('reports a failed start', async () => {
    const plugin = fakePlugin();
    const error = new Error('no service');
    plugin.start = vi.fn(() => Promise.reject(error));
    const onFailure = vi.fn();
    engineWith(plugin, onFailure).start(startSession('w1d1', T0), w, T0, DEFAULT_AUDIO_SETTINGS, { announceCurrent: true });
    plugin.grant();
    await flush();
    expect(onFailure).toHaveBeenCalledWith(error);
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
