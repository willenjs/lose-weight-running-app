// Shared by the Android build scripts: finds Android Studio's JDK and the SDK
// when JAVA_HOME / ANDROID_HOME are not set, and runs commands with them.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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

// Capacitor packages that are the runtime or tooling, not plugins.
const NOT_PLUGINS = new Set(['@capacitor/android', '@capacitor/cli', '@capacitor/core', '@capacitor/ios']);

// cap sync lists only the plugins installed in node_modules: a checkout whose
// node_modules predates a new plugin builds an APK without it, silently.
export function checkPluginsSynced() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const wanted = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    .filter((name) => name.startsWith('@capacitor/') && !NOT_PLUGINS.has(name));
  const synced = JSON.parse(readFileSync('android/app/src/main/assets/capacitor.plugins.json', 'utf8'))
    .map((plugin) => plugin.pkg);
  const missing = wanted.filter((name) => !synced.includes(name));
  if (missing.length === 0) return;
  console.error(`Capacitor plugin(s) not synced: ${missing.join(', ')}. Run npm install, then build again.`);
  process.exit(1);
}
