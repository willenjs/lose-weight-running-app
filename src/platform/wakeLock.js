/**
 * Keeps the screen on while wanted; the browser drops the lock when the tab is hidden.
 * @param {{ onChange?: (active: boolean) => void }} [options]
 */
export function createWakeLock({ onChange = () => {} } = {}) {
  let wanted = false;
  /** @type {WakeLockSentinel | null} */
  let sentinel = null;

  async function request() {
    if (!wanted || sentinel || !navigator.wakeLock || document.visibilityState !== 'visible') return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (!wanted) {
        lock.release().catch(() => {});
        return;
      }
      sentinel = lock;
      // Fires when the browser drops the lock (tab hidden) or we release it.
      lock.addEventListener('release', () => {
        if (sentinel !== lock) return;
        sentinel = null;
        onChange(false);
      });
      onChange(true);
    } catch {
      sentinel = null;
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') request();
  }

  return {
    acquire() {
      wanted = true;
      document.addEventListener('visibilitychange', onVisibilityChange);
      request();
    },
    release() {
      wanted = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      const lock = sentinel;
      sentinel = null;
      if (lock) {
        lock.release().catch(() => {});
        onChange(false);
      }
    },
  };
}
