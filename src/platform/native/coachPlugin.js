import { Capacitor, registerPlugin } from '@capacitor/core';

/** Java side: android/app/src/main/java/io/github/willenjs/pulserun/coach/CoachPlugin.java */
export const Coach = registerPlugin('Coach');

/** True inside the Android app, false in a browser. */
export function isNativeApp() {
  return Capacitor.isNativePlatform();
}
