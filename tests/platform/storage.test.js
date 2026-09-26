import { describe, it, expect } from 'vitest';
import { createStorage, STORAGE_KEYS } from '../../src/platform/storage.js';

function fakeBackend(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const throwingBackend = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); },
  removeItem() { throw new Error('SecurityError'); },
};

const session = { workoutId: 'w1d1', startedAt: 1000, pausedAt: null, pausedTotalMs: 0, skippedMs: 0 };

describe('createStorage', () => {
  it('uses the runningAssistant.* keys with a version envelope', () => {
    const backend = fakeBackend();
    createStorage(backend).saveLang('en');
    expect(STORAGE_KEYS).toEqual({
      progress: 'runningAssistant.progress',
      session: 'runningAssistant.session',
      lang: 'runningAssistant.lang',
    });
    expect(JSON.parse(backend.data.get('runningAssistant.lang'))).toEqual({ version: 1, data: 'en' });
  });

  it('round-trips progress, session and language', () => {
    const storage = createStorage(fakeBackend());
    storage.saveProgress({ completed: { w1d1: '2026-09-26T10:00:00.000Z' } });
    storage.saveSession(session);
    storage.saveLang('en');
    expect(storage.loadProgress()).toEqual({ completed: { w1d1: '2026-09-26T10:00:00.000Z' } });
    expect(storage.loadSession()).toEqual(session);
    expect(storage.loadLang()).toBe('en');
  });

  it('clears the session', () => {
    const storage = createStorage(fakeBackend());
    storage.saveSession(session);
    storage.clearSession();
    expect(storage.loadSession()).toBeNull();
  });

  it('returns defaults when nothing is saved', () => {
    const storage = createStorage(fakeBackend());
    expect(storage.loadProgress()).toEqual({ completed: {} });
    expect(storage.loadSession()).toBeNull();
    expect(storage.loadLang()).toBeNull();
  });

  it('returns defaults for corrupt JSON, wrong version or wrong shape', () => {
    const storage = createStorage(fakeBackend({
      [STORAGE_KEYS.progress]: '{not json',
      [STORAGE_KEYS.session]: JSON.stringify({ version: 1, data: { workoutId: 'w1d1' } }),
      [STORAGE_KEYS.lang]: JSON.stringify({ version: 99, data: 'en' }),
    }));
    expect(storage.loadProgress()).toEqual({ completed: {} });
    expect(storage.loadSession()).toBeNull();
    expect(storage.loadLang()).toBeNull();
  });

  it('works with no backend at all', () => {
    const storage = createStorage(null);
    expect(() => storage.saveSession(session)).not.toThrow();
    expect(storage.loadSession()).toBeNull();
    expect(storage.loadProgress()).toEqual({ completed: {} });
  });

  it('swallows errors thrown by the backend', () => {
    const storage = createStorage(throwingBackend);
    expect(() => storage.saveProgress({ completed: {} })).not.toThrow();
    expect(() => storage.clearSession()).not.toThrow();
    expect(storage.loadProgress()).toEqual({ completed: {} });
    expect(storage.loadLang()).toBeNull();
  });
});
