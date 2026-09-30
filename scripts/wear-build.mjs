// Builds the watch app's debug APK and, with --install, installs it on the
// watch over Wi-Fi. Pair and connect first (watch: Developer options →
// Wireless debugging), then set WEAR_SERIAL to the watch's ip:port.
import { run, adb, gradlew, env } from './android-env.mjs';

const APK = 'android/wear/build/outputs/apk/debug/wear-debug.apk';

run(gradlew, [':wear:assembleDebug'], 'android');
console.log(`APK: ${APK}`);

if (process.argv.includes('--install')) {
  if (!env.WEAR_SERIAL) {
    console.error('Set WEAR_SERIAL to the watch address (ip:port from `adb devices`).');
    process.exit(1);
  }
  run(adb, ['-s', env.WEAR_SERIAL, 'install', '-r', APK]);
}
