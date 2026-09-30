// Shared by the Android build scripts: finds Android Studio's JDK and the SDK
// when JAVA_HOME / ANDROID_HOME are not set, and runs commands with them.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const isWindows = process.platform === 'win32';
export const env = { ...process.env };

const studioJdk = {
  win32: 'C:\\Program Files\\Android\\Android Studio\\jbr',
  darwin: '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
}[process.platform];
if (!env.JAVA_HOME && studioJdk && existsSync(studioJdk)) env.JAVA_HOME = studioJdk;

const defaultSdk = isWindows
  ? join(env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
  : join(env.HOME ?? '', process.platform === 'darwin' ? 'Library/Android/sdk' : 'Android/Sdk');
if (!env.ANDROID_HOME && existsSync(defaultSdk)) env.ANDROID_HOME = defaultSdk;

export const adb = env.ANDROID_HOME ? join(env.ANDROID_HOME, 'platform-tools', isWindows ? 'adb.exe' : 'adb') : 'adb';
// Explicit relative path: cmd may not search the current directory (NoDefaultCurrentDirectoryInExePath).
export const gradlew = isWindows ? '.\\gradlew.bat' : './gradlew';

export function run(command, args, cwd = '.') {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: isWindows });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
