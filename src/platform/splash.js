// The splash is static markup in index.html so it paints before this script
// loads. This fills in its translated tagline and fades it out.

// Long enough for the wordmark to settle and the pulse to play a few times.
const MIN_VISIBLE_MS = 3000;
const FADE_MS = 300;

/**
 * Hides the splash once it has been visible for MIN_VISIBLE_MS since the page
 * started loading. Does nothing if the splash is already gone.
 * @param {{ tagline: string }} options
 */
export function finishSplash({ tagline }) {
  const splash = document.getElementById('splash');
  if (!splash) {
    document.documentElement.classList.remove('splashing');
    return;
  }
  const taglineEl = document.getElementById('splash-tagline');
  if (taglineEl) taglineEl.textContent = tagline;

  const wait = Math.max(0, MIN_VISIBLE_MS - performance.now());
  setTimeout(() => {
    splash.classList.add('splash-out');
    // A timer, not transitionend: that never fires with reduced motion.
    setTimeout(() => {
      splash.remove();
      document.documentElement.classList.remove('splashing');
    }, FADE_MS);
  }, wait);
}
