// Builds the debug APK (web build → cap sync → Gradle) and, with --install,
// installs it on the USB-connected phone. Uses Android Studio's bundled JDK
// and the default SDK location when JAVA_HOME / ANDROID_HOME are not set.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const APK = 'android/app/build/outputs/apk/debug/app-debug.apk';
const isWindows = process.platform === 'win32';
const env = { ...process.env };

const studioJdk = {
  win32: 'C:\\Program Files\\Android\\Android Studio\\jbr',
  darwin: '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
}[process.platform];
if (!env.JAVA_HOME && studioJdk && existsSync(studioJdk)) env.JAVA_HOME = studioJdk;

const defaultSdk = isWindows
  ? join(env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
  : join(env.HOME ?? '', process.platform === 'darwin' ? 'Library/Android/sdk' : 'Android/Sdk');
if (!env.ANDROID_HOME && existsSync(defaultSdk)) env.ANDROID_HOME = defaultSdk;

function run(command, args, cwd = '.') {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: isWindows });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('npm', ['run', 'android:sync']);
// Explicit relative path: cmd may not search the current directory (NoDefaultCurrentDirectoryInExePath).
run(isWindows ? '.\\gradlew.bat' : './gradlew', ['assembleDebug'], 'android');
console.log(`APK: ${APK}`);

if (process.argv.includes('--install')) {
  const adb = env.ANDROID_HOME ? join(env.ANDROID_HOME, 'platform-tools', isWindows ? 'adb.exe' : 'adb') : 'adb';
  run(adb, ['install', '-r', APK]);
}
