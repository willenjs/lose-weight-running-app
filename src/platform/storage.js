import { emptyProgress } from '../core/progress.js';

const VERSION = 1;

export const STORAGE_KEYS = {
  progress: 'runningAssistant.progress',
  session: 'runningAssistant.session',
  lang: 'runningAssistant.lang',
};

function defaultBackend() {
  try {
    // Accessing localStorage itself can throw when site data is blocked.
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const isObject = (value) => typeof value === 'object' && value !== null;

const isProgress = (value) => isObject(value) && isObject(value.completed);

const isSession = (value) =>
  isObject(value) &&
  typeof value.workoutId === 'string' &&
  typeof value.startedAt === 'number' &&
  (value.pausedAt === null || typeof value.pausedAt === 'number') &&
  typeof value.pausedTotalMs === 'number' &&
  typeof value.skippedMs === 'number';

/** @param {Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null} [backend] */
export function createStorage(backend = defaultBackend()) {
  function read(key, isValid, fallback) {
    try {
      const raw = backend?.getItem(key);
      if (raw == null) return fallback;
      const envelope = JSON.parse(raw);
      if (envelope?.version !== VERSION || !isValid(envelope.data)) return fallback;
      return envelope.data;
    } catch {
      return fallback;
    }
  }

  function write(key, data) {
    try {
      backend?.setItem(key, JSON.stringify({ version: VERSION, data }));
    } catch {
      // Storage full or blocked: the app keeps working without persistence.
    }
  }

  function remove(key) {
    try {
      backend?.removeItem(key);
    } catch {
      // See write().
    }
  }

  return {
    loadProgress: () => read(STORAGE_KEYS.progress, isProgress, emptyProgress()),
    saveProgress: (progress) => write(STORAGE_KEYS.progress, progress),
    loadSession: () => read(STORAGE_KEYS.session, isSession, null),
    saveSession: (session) => write(STORAGE_KEYS.session, session),
    clearSession: () => remove(STORAGE_KEYS.session),
    loadLang: () => read(STORAGE_KEYS.lang, (value) => typeof value === 'string', null),
    saveLang: (lang) => write(STORAGE_KEYS.lang, lang),
  };
}
