/** Keeps the screen on while wanted; the browser drops the lock when the tab is hidden. */
export function createWakeLock() {
  let wanted = false;
  /** @type {WakeLockSentinel | null} */
  let sentinel = null;

  async function request() {
    if (!wanted || !navigator.wakeLock || document.visibilityState !== 'visible') return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (!wanted) {
        lock.release().catch(() => {});
        return;
      }
      sentinel = lock;
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
      sentinel?.release().catch(() => {});
      sentinel = null;
    },
  };
}
