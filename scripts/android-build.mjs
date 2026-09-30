// Builds the phone's debug APK (web build → cap sync → Gradle) and, with
// --install, installs it on the USB-connected phone (adb -d, so a watch
// connected over Wi-Fi is not picked).
import { run, adb, gradlew } from './android-env.mjs';

const APK = 'android/app/build/outputs/apk/debug/app-debug.apk';

run('npm', ['run', 'android:sync']);
run(gradlew, [':app:assembleDebug'], 'android');
console.log(`APK: ${APK}`);

if (process.argv.includes('--install')) run(adb, ['-d', 'install', '-r', APK]);
