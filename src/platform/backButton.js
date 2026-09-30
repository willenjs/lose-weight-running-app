import { App } from '@capacitor/app';
import { isNativeApp } from './native/coachPlugin.js';

// If leaving did not unload the page by then, there was no page to go back to.
const LEAVE_FALLBACK_MS = 500;

/**
 * Routes every back press (browser button, Android button or gesture) to
 * `onBack` instead of leaving the app. `leave()` then really leaves.
 * @param {() => void} onBack
 * @returns {{ leave: () => void }}
 */
export function createBackButton(onBack) {
  return isNativeApp() ? nativeBackButton(onBack) : webBackButton(onBack);
}

// With a listener registered, Capacitor hands every back press to JS.
function nativeBackButton(onBack) {
  App.addListener('backButton', () => onBack());
  return {
    leave: () => { App.exitApp(); },
  };
}

// Keeps one guard entry above the app's own entry: a back press pops the
// guard, and the handler pushes it again. The history never mirrors the
// screens, so the forward button cannot reopen old ones.
function webBackButton(onBack) {
  const pushGuard = () => history.pushState({ pulseRunGuard: true }, '');
  const onPopState = () => {
    pushGuard();
    onBack();
  };
  // Chrome skips history entries added without a tap, so two back presses in
  // a row can still leave: the browser's own "Leave site?" prompt covers that.
  const onBeforeUnload = (event) => event.preventDefault();

  history.replaceState({ pulseRunGuard: false }, '');
  pushGuard();
  window.addEventListener('popstate', onPopState);
  window.addEventListener('beforeunload', onBeforeUnload);

  return {
    leave() {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('beforeunload', onBeforeUnload);
      // Past the guard and the app's own entry, to the previous page.
      history.go(-2);
      // Opened in a fresh tab or as an installed web app: nothing to go back to.
      setTimeout(() => {
        window.close();
        window.addEventListener('popstate', onPopState);
        window.addEventListener('beforeunload', onBeforeUnload);
      }, LEAVE_FALLBACK_MS);
    },
  };
}
