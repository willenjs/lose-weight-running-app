import { emptyProgress } from '../core/progress.js';
import { DEFAULT_AUDIO_SETTINGS, normalizeAudioSettings } from '../core/audioSettings.js';

const VERSION = 1;
// v1 stored { muted }; v2 stores AudioSettings.
const SETTINGS_VERSION = 2;

export const STORAGE_KEYS = {
  progress: 'runningAssistant.progress',
  session: 'runningAssistant.session',
  lang: 'runningAssistant.lang',
  settings: 'runningAssistant.settings',
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

/** v1 → v2: a muted app starts at volume 0, otherwise at full volume. */
function migrateSettings(version, data) {
  if (version === 1 && isObject(data) && typeof data.muted === 'boolean') {
    return { ...DEFAULT_AUDIO_SETTINGS, volume: data.muted ? 0 : 100 };
  }
  return undefined;
}

/** @param {Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null} [backend] */
export function createStorage(backend = defaultBackend()) {
  /**
   * @param {{ version?: number, migrate?: (version: unknown, data: unknown) => unknown }} [options]
   *   migrate: turns data saved under an older version into the current shape.
   */
  function read(key, isValid, fallback, { version = VERSION, migrate } = {}) {
    try {
      const raw = backend?.getItem(key);
      if (raw == null) return fallback;
      const envelope = JSON.parse(raw);
      const data = envelope?.version === version ? envelope.data : migrate?.(envelope?.version, envelope?.data);
      return isValid(data) ? data : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, data, version = VERSION) {
    try {
      backend?.setItem(key, JSON.stringify({ version, data }));
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
    loadSettings: () => normalizeAudioSettings(
      read(STORAGE_KEYS.settings, isObject, null, { version: SETTINGS_VERSION, migrate: migrateSettings }),
    ),
    saveSettings: (settings) => write(STORAGE_KEYS.settings, settings, SETTINGS_VERSION),
  };
}
