# Wear OS Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Galaxy Watch8 companion app that mirrors a PulseRun workout running on the phone (phase, countdown, pace-coloured rings, haptics) and controls it (pause / resume / skip / stop), with the phone's `CoachService` owning the run so watch commands work while the phone is locked.

**Architecture:** JavaScript builds the whole workout's cue schedule once, in workout time, and sends it with the session timestamps to the phone's `CoachService`. The service holds the session (plus a `revision`), applies pause / resume / skip / stop with the same arithmetic as `timer.js`, re-schedules cues, persists state, tells JS (plugin event + `current()`), and publishes the state to the watch over the Wearable Data Layer. The watch app (Kotlin + Compose for Wear OS) computes its display and haptics from those timestamps and sends commands back by MessageClient.

**Tech Stack:** Svelte 5 + vitest (existing), Capacitor 8 Android app in Java (existing), Google Play services Wearable 19, Kotlin 2.2 + Compose for Wear OS Material 3, androidx.wear ongoing + ambient, JUnit 4 with `org.json`.

**Spec:** `docs/superpowers/specs/2026-09-30-wear-os-companion-design.md`

## Global Constraints

- `src/core/` stays pure JS (no DOM, no browser APIs, no imports from outside `core/`).
- Timer state is always derived from `startedAt`, `pausedAt`, `pausedTotalMs`, `skippedMs`; never count ticks. Every session change stops and re-schedules cues.
- Everything in code is English. Portuguese only in `src/i18n/pt.js` (Spanish in `es.js`). Every new i18n key goes into `pt.js`, `en.js` and `es.js` (a test enforces matching keys).
- Durations are passed in seconds in JS APIs; the native payload uses milliseconds (`atMs`, `startMs`, `endMs`) as today.
- The phone app's native code stays **Java**; the watch module `android/wear/` is **Kotlin**.
- Watch module: `applicationId "io.github.willenjs.pulserun"` (same as the phone), `minSdk 30`, compile/target SDK from `android/variables.gradle` (36).
- Data Layer paths: DataItem `/pulserun/run` (key `state`: JSON string, key `publishedAt`: long), messages `/pulserun/command`, `/pulserun/ping`, `/pulserun/pong`. Phone capability name: `pulserun_phone`.
- Grace window: an event is still due if `atMs ≥ elapsed − 250` (`DUE_GRACE_MS` in `src/core/cues.js`). Same constant in Java and Kotlin.
- Watch colours: surface `#0C0D12`, track `#25293A`, muted `#8A91A8`, mint `#10F49C`, on-mint `#002111`, Walk `#00D2FF`, Jog `#FFAB00`, Run `#FF334B`.
- Haptics: Walk one long pulse, Jog two short, Run three short, finish long–short–long.
- The web build (GitHub Pages) must behave exactly as before.
- Before claiming a task done: `npm test` and `npm run build` pass; for tasks touching `android/`, `npm run android:test` (added in Task 5; before that, `cd android && ./gradlew assembleDebug`) passes too.
- Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), each ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.

## Review Focus

1. **A phone pause must keep the service alive.** Today pause calls `engine.stop()`; after Task 4 it must send the paused session. If any path still stops the service on pause, the watch goes blank mid-run. Pinned by the controller-facing engine test in Task 4 ("pause sends the paused session, never stop").
2. **The finish must not cut the fanfare.** The service's finish handler must not clear scheduled events or stop the player. Pinned in Task 6 by design (separate `broadcast()` from `reschedule()`) and the phone check "finish plays fanfare + line".
3. **Double-tapped Skip on the watch skips once.** Pinned by `RunModelTest.ignoresStaleBasedOn` (Task 5).
4. **A command for an old run never touches a new one.** Pinned by `RunModelTest.ignoresOtherRun` (Task 5) and `reconcile` "ignores a different run" (Task 3).
5. **A skip's phase line survives transport lag.** Pinned by the `scheduleFrom` grace test in Task 2 and `ScheduleTest.keepsEventsWithinGrace` (Task 5).

---

## File map

**JS**
- Modify `src/core/timeline.js` — add `workoutSchedule`, `scheduleFrom`.
- Create `tests/fixtures/session-math.json` — shared session arithmetic cases (JS, Java, Kotlin).
- Create `tests/core/sessionFixtures.test.js`.
- Modify `src/platform/native/payload.js` — `runPayload`, `announceEvent`, `phaseList`, `WATCH_LABEL_KEYS`; drop `sentAt`.
- Create `src/platform/native/runState.js` — `reconcile`.
- Modify `src/platform/native/nativeCueEngine.js` — `sync`, `onRunState`, `checkRunState`.
- Modify `src/platform/webCueEngine.js` — `start` → `sync`, add no-op `onRunState`/`checkRunState`.
- Modify `src/ui/controller.svelte.js` — use `engine.sync`, apply run states.
- Modify `src/i18n/{pt,en,es}.js` — `watch.idle`, `watch.unreachable`, `notification.paused`.

**Phone (Java)**
- Create `android/app/src/main/java/io/github/willenjs/pulserun/coach/SessionMath.java`, `Schedule.java`, `RunModel.java`, `WatchLink.java`, `CommandListenerService.java`.
- Modify `CoachService.java`, `CoachPlugin.java`, `AndroidManifest.xml`, `android/app/build.gradle`.
- Create `android/app/src/main/res/values/wear.xml`.
- Create tests in `android/app/src/test/java/io/github/willenjs/pulserun/coach/`.

**Watch (Kotlin)** — new module `android/wear/`
- `build.gradle`, `src/main/AndroidManifest.xml`, `res/` (icons, notification icon).
- `src/main/java/io/github/willenjs/pulserun/wear/`: `RunState.kt`, `Haptics.kt`, `RunRepository.kt`, `PhoneLink.kt`, `RunListenerService.kt`, `WorkoutService.kt`, `MainActivity.kt`, `ui/Theme.kt`, `ui/Rings.kt`, `ui/Screens.kt`.
- Tests in `android/wear/src/test/java/io/github/willenjs/pulserun/wear/`.

**Build / docs**
- Modify `android/settings.gradle`, `android/build.gradle`, `android/variables.gradle`, `package.json`, `scripts/android-build.mjs`; create `scripts/android-env.mjs`, `scripts/wear-build.mjs`.
- Modify `README.md`, `AGENTS.md`.

Execution note: after Task 4 the JS sends the new payload, which the Java side only understands after Task 6. That is expected; the APK is only built and installed from Task 6 on.

---

### Task 1: Watch module skeleton and phone ↔ watch ping

Proves the riskiest assumption first: the Data Layer works between the Xiaomi phone and the Galaxy Watch8 with same-key debug builds.

**Files:**
- Modify: `android/variables.gradle`, `android/build.gradle`, `android/settings.gradle`, `android/app/build.gradle`, `android/app/src/main/AndroidManifest.xml`, `package.json`, `scripts/android-build.mjs`
- Create: `scripts/android-env.mjs`, `scripts/wear-build.mjs`
- Create: `android/app/src/main/res/values/wear.xml`
- Create: `android/app/src/main/java/io/github/willenjs/pulserun/coach/CommandListenerService.java`
- Create: `android/wear/build.gradle`, `android/wear/src/main/AndroidManifest.xml`, `android/wear/src/main/java/io/github/willenjs/pulserun/wear/{MainActivity.kt,PhoneLink.kt,RunListenerService.kt}`
- Copy: phone launcher icons and `ic_notification.xml` into `android/wear/src/main/res/`

**Interfaces:**
- Produces: `PhoneLink` object (Kotlin) with `const val PING_PATH = "/pulserun/ping"`, `PONG_PATH = "/pulserun/pong"`, `COMMAND_PATH = "/pulserun/command"`, `CAPABILITY = "pulserun_phone"`, `val phoneReachable: StateFlow<Boolean?>`, `fun ping(context: Context)`, `fun onPong()`, `fun sendCommand(context: Context, json: String, onResult: (Boolean) -> Unit)`.
- Produces: phone `CommandListenerService` with constants `PING_PATH`, `PONG_PATH`, `COMMAND_PATH` (command handling added in Task 6).
- Produces: npm scripts `wear:build`, `wear:install`; `android:install` targets the USB device (`adb -d`).

- [ ] **Step 1: Shared versions and Kotlin plugins**

`android/variables.gradle` — add inside `ext { ... }`:

```groovy
    playServicesWearableVersion = '19.0.0'
    orgJsonVersion = '20240303'
```

`android/build.gradle` — add to `buildscript.dependencies`:

```groovy
        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.20'
        classpath 'org.jetbrains.kotlin:compose-compiler-gradle-plugin:2.2.20'
```

`android/settings.gradle` — add after `include ':app'`:

```groovy
include ':wear'
```

If Gradle reports the Kotlin version is incompatible with AGP 8.13 / Gradle 9.2.1, use the newest 2.2.x or 2.3.x Kotlin that resolves (both classpath lines must use the same version) and note the version in the commit message.

- [ ] **Step 2: Phone side — dependency, capability, ping listener**

`android/app/build.gradle` — add to `dependencies`:

```groovy
    implementation "com.google.android.gms:play-services-wearable:$playServicesWearableVersion"
```

Create `android/app/src/main/res/values/wear.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- Lets the watch app find this phone (CapabilityClient). -->
<resources xmlns:tools="http://schemas.android.com/tools"
    tools:keep="@array/android_wear_capabilities">
    <string-array name="android_wear_capabilities">
        <item>pulserun_phone</item>
    </string-array>
</resources>
```

Create `android/app/src/main/java/io/github/willenjs/pulserun/coach/CommandListenerService.java`:

```java
package io.github.willenjs.pulserun.coach;

import com.google.android.gms.wearable.MessageEvent;
import com.google.android.gms.wearable.Wearable;
import com.google.android.gms.wearable.WearableListenerService;

/** Messages from the PulseRun watch app. */
public class CommandListenerService extends WearableListenerService {
    static final String PING_PATH = "/pulserun/ping";
    static final String PONG_PATH = "/pulserun/pong";
    static final String COMMAND_PATH = "/pulserun/command";

    @Override
    public void onMessageReceived(MessageEvent event) {
        if (PING_PATH.equals(event.getPath())) {
            Wearable.getMessageClient(this).sendMessage(event.getSourceNodeId(), PONG_PATH, event.getData());
        }
    }
}
```

`android/app/src/main/AndroidManifest.xml` — add inside `<application>` after the `CoachService` entry:

```xml
        <service
            android:name=".coach.CommandListenerService"
            android:exported="true">
            <intent-filter>
                <action android:name="com.google.android.gms.wearable.MESSAGE_RECEIVED" />
                <data android:scheme="wear" android:host="*" android:pathPrefix="/pulserun/" />
            </intent-filter>
        </service>
```

- [ ] **Step 3: Watch module build file and manifest**

Create `android/wear/build.gradle`:

```groovy
apply plugin: 'com.android.application'
apply plugin: 'org.jetbrains.kotlin.android'
apply plugin: 'org.jetbrains.kotlin.plugin.compose'

android {
    namespace = "io.github.willenjs.pulserun.wear"
    compileSdk = rootProject.ext.compileSdkVersion
    defaultConfig {
        // Same id and (debug) signing key as the phone app: the Data Layer requires both.
        applicationId "io.github.willenjs.pulserun"
        minSdkVersion 30
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0"
    }
    buildFeatures {
        compose true
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_21
        targetCompatibility JavaVersion.VERSION_21
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21
    }
}

dependencies {
    implementation "androidx.core:core-ktx:$androidxCoreVersion"
    implementation "androidx.activity:activity-compose:$androidxActivityVersion"
    implementation "androidx.wear.compose:compose-material3:1.5.0"
    implementation "androidx.wear.compose:compose-foundation:1.5.0"
    implementation "androidx.wear:wear:1.3.0"
    implementation "androidx.wear:wear-ongoing:1.0.0"
    implementation "com.google.android.gms:play-services-wearable:$playServicesWearableVersion"
    testImplementation "junit:junit:$junitVersion"
    testImplementation "org.json:json:$orgJsonVersion"
}
```

If a listed androidx version does not resolve, use the newest stable version on Google Maven for that artifact.

Create `android/wear/src/main/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-feature android:name="android.hardware.type.watch" />

    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />

    <application
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:label="PulseRun"
        android:theme="@android:style/Theme.DeviceDefault">

        <!-- A companion: it needs the phone app. -->
        <meta-data
            android:name="com.google.android.wearable.standalone"
            android:value="false" />

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask"
            android:taskAffinity="">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".RunListenerService"
            android:exported="true">
            <intent-filter>
                <action android:name="com.google.android.gms.wearable.DATA_CHANGED" />
                <data android:scheme="wear" android:host="*" android:path="/pulserun/run" />
            </intent-filter>
            <intent-filter>
                <action android:name="com.google.android.gms.wearable.MESSAGE_RECEIVED" />
                <data android:scheme="wear" android:host="*" android:pathPrefix="/pulserun/" />
            </intent-filter>
        </service>
    </application>
</manifest>
```

(`WorkoutService` is added in Task 8.)

Copy resources (PowerShell or bash, from the repo root):

```bash
for d in mipmap-anydpi-v26 mipmap-hdpi mipmap-mdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi; do mkdir -p android/wear/src/main/res/$d && cp android/app/src/main/res/$d/ic_launcher* android/wear/src/main/res/$d/; done
mkdir -p android/wear/src/main/res/drawable && cp android/app/src/main/res/drawable/ic_notification.xml android/wear/src/main/res/drawable/
```

If `mipmap-anydpi-v26/ic_launcher.xml` references a `@color/...` or `@drawable/...` that lives in `values/` or `drawable/` of the phone app, copy that resource file too (the build error names it).

- [ ] **Step 4: Watch ping code**

Create `android/wear/src/main/java/io/github/willenjs/pulserun/wear/PhoneLink.kt`:

```kotlin
package io.github.willenjs.pulserun.wear

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.Node
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Messages to the phone app (the node advertising [CAPABILITY]). */
object PhoneLink {
    const val PING_PATH = "/pulserun/ping"
    const val PONG_PATH = "/pulserun/pong"
    const val COMMAND_PATH = "/pulserun/command"
    const val CAPABILITY = "pulserun_phone"
    private const val PING_TIMEOUT_MS = 3_000L

    private val main = Handler(Looper.getMainLooper())
    private val timeout = Runnable { reachable.value = false }
    private val reachable = MutableStateFlow<Boolean?>(null)

    /** null until the first ping settles. */
    val phoneReachable: StateFlow<Boolean?> = reachable

    fun ping(context: Context) {
        main.removeCallbacks(timeout)
        main.postDelayed(timeout, PING_TIMEOUT_MS)
        send(context, PING_PATH, ByteArray(0)) { ok -> if (!ok) reachable.value = false }
    }

    fun onPong() {
        main.removeCallbacks(timeout)
        reachable.value = true
    }

    fun sendCommand(context: Context, json: String, onResult: (Boolean) -> Unit) {
        send(context, COMMAND_PATH, json.toByteArray(Charsets.UTF_8), onResult)
    }

    private fun send(context: Context, path: String, data: ByteArray, onResult: (Boolean) -> Unit) {
        val app = context.applicationContext
        Wearable.getCapabilityClient(app)
            .getCapability(CAPABILITY, CapabilityClient.FILTER_REACHABLE)
            .addOnSuccessListener { info ->
                val node: Node? = info.nodes.firstOrNull { it.isNearby } ?: info.nodes.firstOrNull()
                if (node == null) {
                    onResult(false)
                    return@addOnSuccessListener
                }
                Wearable.getMessageClient(app).sendMessage(node.id, path, data)
                    .addOnSuccessListener { onResult(true) }
                    .addOnFailureListener { onResult(false) }
            }
            .addOnFailureListener { onResult(false) }
    }
}
```

Create `android/wear/src/main/java/io/github/willenjs/pulserun/wear/RunListenerService.kt`:

```kotlin
package io.github.willenjs.pulserun.wear

import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

/** Data Layer events from the phone app. */
class RunListenerService : WearableListenerService() {
    override fun onMessageReceived(event: MessageEvent) {
        if (event.path == PhoneLink.PONG_PATH) PhoneLink.onPong()
    }
}
```

Create `android/wear/src/main/java/io/github/willenjs/pulserun/wear/MainActivity.kt` (temporary screen; Task 9 replaces the content):

```kotlin
package io.github.willenjs.pulserun.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.wear.compose.material3.Text

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val reachable by PhoneLink.phoneReachable.collectAsState()
            Box(Modifier.fillMaxSize().background(Color(0xFF0C0D12)), contentAlignment = Alignment.Center) {
                Text(
                    when (reachable) {
                        null -> "PulseRun…"
                        true -> "PulseRun ● phone"
                        false -> "PulseRun ○ no phone"
                    },
                    color = Color(0xFF10F49C),
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        PhoneLink.ping(this)
    }
}
```

- [ ] **Step 5: Build scripts**

Create `scripts/android-env.mjs`:

```js
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
```

Replace `scripts/android-build.mjs` with:

```js
// Builds the phone's debug APK (web build → cap sync → Gradle) and, with
// --install, installs it on the USB-connected phone (adb -d, so a watch
// connected over Wi-Fi is not picked).
import { run, adb, gradlew } from './android-env.mjs';

const APK = 'android/app/build/outputs/apk/debug/app-debug.apk';

run('npm', ['run', 'android:sync']);
run(gradlew, [':app:assembleDebug'], 'android');
console.log(`APK: ${APK}`);

if (process.argv.includes('--install')) run(adb, ['-d', 'install', '-r', APK]);
```

Create `scripts/wear-build.mjs`:

```js
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
```

`package.json` — add to `scripts` after `android:install`:

```json
    "wear:build": "node scripts/wear-build.mjs",
    "wear:install": "node scripts/wear-build.mjs --install"
```

- [ ] **Step 6: Build both APKs**

Run: `npm run android:build` then `npm run wear:build`
Expected: both end with `BUILD SUCCESSFUL` and print the APK path. Also run `npm test` and `npm run build` (unchanged, must pass).

- [ ] **Step 7: Commit**

```bash
git add android/variables.gradle android/build.gradle android/settings.gradle android/app/build.gradle android/app/src/main/AndroidManifest.xml android/app/src/main/res/values/wear.xml android/app/src/main/java/io/github/willenjs/pulserun/coach/CommandListenerService.java android/wear scripts package.json
git commit -m "feat: add the watch module with a phone ping"
```

- [ ] **Step 8: Device gate (the controller does this with the user, not the implementer)**

Install the phone APK (`npm run android:install`), connect the watch over Wi-Fi (`adb pair <ip>:<pair-port>` with the code, then `adb connect <ip>:<port>`), `WEAR_SERIAL=<ip>:<port> npm run wear:install`, open PulseRun on the watch. Expected: "PulseRun ● phone". If it shows "○ no phone", stop the plan and rethink (check `adb logcat` on both for Wearable errors, signing, capability).

---

### Task 2: Workout-time schedule and shared session fixtures

**Files:**
- Modify: `src/core/timeline.js`
- Test: `tests/core/timeline.test.js`
- Create: `tests/fixtures/session-math.json`, `tests/core/sessionFixtures.test.js`

**Interfaces:**
- Produces: `workoutSchedule(workout, settings): TimelineEvent[]` — `inMs` is ms since the workout start.
- Produces: `scheduleFrom(schedule, elapsedMs): TimelineEvent[]` — events with `inMs ≥ elapsedMs − DUE_GRACE_MS`, order kept, `inMs` unchanged (still workout time).
- Produces: `tests/fixtures/session-math.json` (format below), read by JUnit in Tasks 5 and 7 via the relative path `../../tests/fixtures/session-math.json` from the module directory.

- [ ] **Step 1: Write the failing timeline tests**

Append to `tests/core/timeline.test.js` (it already defines `w`, `T0`, `s`, `fresh`, `settings`, `speech`, `tones`, `announce`; add `workoutSchedule, scheduleFrom` to the import from `timeline.js` and `resumeSession` if needed):

```js
describe('workoutSchedule', () => {
  it('is the timeline of a fresh start, in workout time', () => {
    expect(workoutSchedule(w, settings())).toEqual(buildTimeline(fresh(), w, T0, settings(), announce));
  });

  it('does not depend on any session', () => {
    const events = workoutSchedule(w, settings());
    expect(events[0]).toEqual({ kind: 'tone', tone: 'walk', inMs: 0 });
    expect(speech(events).at(-1)).toEqual({ kind: 'speech', inMs: s(1260), finish: true });
  });
});

describe('scheduleFrom', () => {
  const shift = (events, elapsed) => events.map((e) => ({ ...e, inMs: e.inMs - elapsed }));

  it('after a skip, matches the timeline the app builds after the skip', () => {
    const now = T0 + s(100);
    const skipped = skipPhase(fresh(), w, now); // lands on 360 s
    const ahead = scheduleFrom(workoutSchedule(w, settings()), s(360));
    expect(shift(ahead, s(360))).toEqual(buildTimeline(skipped, w, now, settings(), announce));
  });

  it('mid-phase, matches the timeline of a resume (no announcement)', () => {
    const running = { ...fresh(), pausedTotalMs: 0 };
    const now = T0 + s(100);
    const ahead = scheduleFrom(workoutSchedule(w, settings()), s(100));
    expect(shift(ahead, s(100))).toEqual(buildTimeline(running, w, now, settings()));
  });

  it('keeps events that fell due within the grace window', () => {
    const ahead = scheduleFrom(workoutSchedule(w, settings()), s(360) + 200);
    expect(ahead[0]).toEqual({ kind: 'tone', tone: 'jog', inMs: s(360) });
    expect(speech(ahead)[0]).toMatchObject({ inMs: s(360), phaseType: 'jog' });
  });

  it('drops events older than the grace window', () => {
    const ahead = scheduleFrom(workoutSchedule(w, settings()), s(360) + 300);
    expect(ahead.some((e) => e.inMs === s(360))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/core/timeline.test.js`
Expected: FAIL — `workoutSchedule is not a function` (or not exported).

- [ ] **Step 3: Implement**

In `src/core/timeline.js`, change the imports and add after `buildTimeline`:

```js
import { getState, phaseBoundaries, startSession } from './timer.js';
import { upcomingCues, filterCues, DUE_GRACE_MS } from './cues.js';
```

```js
/**
 * Every event of the workout, with `inMs` measured from the workout start:
 * the timeline of a fresh start. The Android service keeps it for the whole
 * run and picks the part still ahead after each pause, resume or skip.
 * @param {import('./plan.js').Workout} workout
 * @param {import('./audioSettings.js').AudioSettings} settings
 * @returns {TimelineEvent[]}
 */
export function workoutSchedule(workout, settings) {
  return buildTimeline(startSession(workout.id, 0), workout, 0, settings, { announceCurrent: true });
}

/**
 * The part of a workout schedule still ahead at `elapsedMs`. An event that
 * fell due at most DUE_GRACE_MS ago is kept: a skip lands exactly on a phase
 * start, and the change takes a few ms to reach whoever plays it.
 * @param {TimelineEvent[]} schedule from workoutSchedule
 * @param {number} elapsedMs
 * @returns {TimelineEvent[]}
 */
export function scheduleFrom(schedule, elapsedMs) {
  return schedule.filter((event) => event.inMs >= elapsedMs - DUE_GRACE_MS);
}
```

- [ ] **Step 4: Run the timeline tests**

Run: `npx vitest run tests/core/timeline.test.js`
Expected: PASS.

- [ ] **Step 5: Write the shared fixtures**

Create `tests/fixtures/session-math.json` (workout `w1d1`: phases 360/120/360/120/300 s; `T0` = 1000000):

```json
{
  "workoutId": "w1d1",
  "phases": [
    { "type": "walk", "startMs": 0, "endMs": 360000 },
    { "type": "jog", "startMs": 360000, "endMs": 480000 },
    { "type": "walk", "startMs": 480000, "endMs": 840000 },
    { "type": "jog", "startMs": 840000, "endMs": 960000 },
    { "type": "walk", "startMs": 960000, "endMs": 1260000 }
  ],
  "elapsed": [
    { "name": "fresh start", "session": { "startedAt": 1000000, "pausedAt": null, "pausedTotalMs": 0, "skippedMs": 0 }, "now": 1000000, "elapsedMs": 0 },
    { "name": "running 100 s", "session": { "startedAt": 1000000, "pausedAt": null, "pausedTotalMs": 0, "skippedMs": 0 }, "now": 1100000, "elapsedMs": 100000 },
    { "name": "paused at 50 s", "session": { "startedAt": 1000000, "pausedAt": 1050000, "pausedTotalMs": 0, "skippedMs": 0 }, "now": 1999000, "elapsedMs": 50000 },
    { "name": "after a 20 s pause", "session": { "startedAt": 1000000, "pausedAt": null, "pausedTotalMs": 20000, "skippedMs": 0 }, "now": 1100000, "elapsedMs": 80000 },
    { "name": "with a skip", "session": { "startedAt": 1000000, "pausedAt": null, "pausedTotalMs": 0, "skippedMs": 300000 }, "now": 1060000, "elapsedMs": 360000 },
    { "name": "clock before the start", "session": { "startedAt": 1000000, "pausedAt": null, "pausedTotalMs": 0, "skippedMs": 0 }, "now": 995000, "elapsedMs": 0 },
    { "name": "past the end", "session": { "startedAt": 1000000, "pausedAt": null, "pausedTotalMs": 0, "skippedMs": 0 }, "now": 3000000, "elapsedMs": 1260000 }
  ],
  "actions": [
    { "name": "pause while running", "action": "pause", "now": 1010000,
      "session": { "startedAt": 1000000, "pausedAt": null, "pausedTotalMs": 0, "skippedMs": 0 },
      "expected": { "startedAt": 1000000, "pausedAt": 1010000, "pausedTotalMs": 0, "skippedMs": 0 } },
    { "name": "pause while paused", "action": "pause", "now": 1010000,
      "session": { "startedAt": 1000000, "pausedAt": 1005000, "pausedTotalMs": 0, "skippedMs": 0 },
      "expected": { "startedAt": 1000000, "pausedAt": 1005000, "pausedTotalMs": 0, "skippedMs": 0 } },
    { "name": "resume adds the paused time", "action": "resume", "now": 1025000,
      "session": { "startedAt": 1000000, "pausedAt": 1010000, "pausedTotalMs": 0, "skippedMs": 0 },
      "expected": { "startedAt": 1000000, "pausedAt": null, "pausedTotalMs": 15000, "skippedMs": 0 } },
    { "name": "resume while running", "action": "resume", "now": 1005000,
      "session": { "startedAt": 1000000, "pausedAt": null, "pausedTotalMs": 0, "skippedMs": 0 },
      "expected": { "startedAt": 1000000, "pausedAt": null, "pausedTotalMs": 0, "skippedMs": 0 } },
    { "name": "resume with the clock gone back", "action": "resume", "now": 1005000,
      "session": { "startedAt": 1000000, "pausedAt": 1010000, "pausedTotalMs": 0, "skippedMs": 0 },
      "expected": { "startedAt": 1000000, "pausedAt": null, "pausedTotalMs": 0, "skippedMs": 0 } },
    { "name": "skip mid-phase", "action": "skip", "now": 1100000,
      "session": { "startedAt": 1000000, "pausedAt": null, "pausedTotalMs": 0, "skippedMs": 0 },
      "expected": { "startedAt": 1000000, "pausedAt": null, "pausedTotalMs": 0, "skippedMs": 260000 } },
    { "name": "skip while paused", "action": "skip", "now": 1500000,
      "session": { "startedAt": 1000000, "pausedAt": 1400000, "pausedTotalMs": 0, "skippedMs": 0 },
      "expected": { "startedAt": 1000000, "pausedAt": 1400000, "pausedTotalMs": 0, "skippedMs": 80000 } },
    { "name": "skip when finished", "action": "skip", "now": 2300000,
      "session": { "startedAt": 1000000, "pausedAt": null, "pausedTotalMs": 0, "skippedMs": 0 },
      "expected": { "startedAt": 1000000, "pausedAt": null, "pausedTotalMs": 0, "skippedMs": 0 } }
  ],
  "clock": [
    { "ms": 0, "text": "00:00" },
    { "ms": 1, "text": "00:01" },
    { "ms": 359001, "text": "06:00" },
    { "ms": 360000, "text": "06:00" },
    { "ms": 61000, "text": "01:01" },
    { "ms": -5, "text": "00:00" }
  ]
}
```

- [ ] **Step 6: Test the fixtures against `timer.js`**

Create `tests/core/sessionFixtures.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { findWorkout } from '../../src/core/plan.js';
import {
  elapsedMs, pauseSession, resumeSession, skipPhase, phaseBoundaries, formatClock,
} from '../../src/core/timer.js';

// Also read by the Java (phone) and Kotlin (watch) unit tests, so all three
// implementations of the session arithmetic stay in step.
const fixtures = JSON.parse(readFileSync(new URL('../fixtures/session-math.json', import.meta.url), 'utf8'));
const workout = findWorkout(fixtures.workoutId);
const withId = (session) => ({ workoutId: fixtures.workoutId, ...session });
const ACTIONS = {
  pause: (session, now) => pauseSession(session, now),
  resume: (session, now) => resumeSession(session, now),
  skip: (session, now) => skipPhase(session, workout, now),
};

describe('session fixtures', () => {
  it('describe the workout phases', () => {
    const bounds = phaseBoundaries(workout);
    expect(fixtures.phases).toEqual(bounds.map((b, i) => ({ type: workout.phases[i].type, ...b })));
  });

  for (const c of fixtures.elapsed) {
    it(`elapsed: ${c.name}`, () => {
      expect(elapsedMs(withId(c.session), workout, c.now)).toBe(c.elapsedMs);
    });
  }

  for (const c of fixtures.actions) {
    it(`action: ${c.name}`, () => {
      expect(ACTIONS[c.action](withId(c.session), c.now)).toEqual(withId(c.expected));
    });
  }

  for (const c of fixtures.clock) {
    it(`clock: ${c.ms} ms`, () => {
      expect(formatClock(c.ms)).toBe(c.text);
    });
  }
});
```

- [ ] **Step 7: Run all tests and the build**

Run: `npm test` then `npm run build`
Expected: all PASS; build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/core/timeline.js tests/core/timeline.test.js tests/fixtures/session-math.json tests/core/sessionFixtures.test.js
git commit -m "feat: build the whole workout schedule in workout time"
```

---

### Task 3: Run payload, watch labels and reconcile

**Files:**
- Modify: `src/platform/native/payload.js`
- Test: `tests/platform/native/payload.test.js`
- Create: `src/platform/native/runState.js`, `tests/platform/native/runState.test.js`
- Modify: `src/i18n/pt.js`, `src/i18n/en.js`, `src/i18n/es.js`

**Interfaces:**
- Consumes: `workoutSchedule` (Task 2), `nativeEvents` (existing, `payload.js`).
- Produces (all in `payload.js`):
  - `WATCH_LABEL_KEYS: Record<string, string>` — label name → i18n key.
  - `phaseList(workout): { type, startMs, endMs }[]`
  - `announceEvent(session, workout, now, settings): TimelineEvent | null`
  - `runPayload(session, workout, now, settings, { speechText, locales, notification, watch, announceCurrent }): RunPayload` where `RunPayload = { session, phases, schedule, announce: { text, volume } | null, locales, notification, watch }`.
- Produces (`runState.js`): `reconcile(runId: number | null, revision: number, remote: RunState | null): RunDecision` with
  - `RunState = { runId: number, revision: number, ended: null | 'stopped' | 'finished', session: Session, phases?, watch? }`
  - `RunDecision = { type: 'ignore' } | { type: 'adopt', session } | { type: 'stopped' } | { type: 'finished', session }`
- Produces i18n keys: `watch.idle`, `watch.unreachable`, `notification.paused`.

- [ ] **Step 1: Write the failing payload tests**

Add to `tests/platform/native/payload.test.js` (keep the existing tests of `nativeEvents` and `nativeTest`; merge these imports with the file's existing ones, and if the file already defines `w` or `T0`, reuse them):

```js
import { findWorkout } from '../../../src/core/plan.js';
import { startSession, pauseSession, skipPhase } from '../../../src/core/timer.js';
import { DEFAULT_AUDIO_SETTINGS } from '../../../src/core/audioSettings.js';
import { workoutSchedule } from '../../../src/core/timeline.js';
import en from '../../../src/i18n/en.js';
import {
  nativeEvents, runPayload, announceEvent, phaseList, WATCH_LABEL_KEYS,
} from '../../../src/platform/native/payload.js';

const w = findWorkout('w1d1');
const T0 = 1_000_000;
const text = (event) => ('finish' in event ? 'done' : `${event.phaseType} ${event.seconds}`);
const opts = (patch = {}) => ({
  speechText: text,
  locales: ['en-US'],
  notification: { channel: 'Workout', title: 'W1D1', text: 'Running', pausedText: 'Paused' },
  watch: { title: 'Week 1 • Day 1', labels: { walk: 'Walk' } },
  announceCurrent: false,
  ...patch,
});

describe('phaseList', () => {
  it('lists each phase with its bounds', () => {
    expect(phaseList(w).slice(0, 2)).toEqual([
      { type: 'walk', startMs: 0, endMs: 360_000 },
      { type: 'jog', startMs: 360_000, endMs: 480_000 },
    ]);
  });
});

describe('announceEvent', () => {
  it('is null at a phase start: the schedule already has that line', () => {
    expect(announceEvent(startSession('w1d1', T0), w, T0 + 100, DEFAULT_AUDIO_SETTINGS)).toBeNull();
    const skipped = skipPhase(startSession('w1d1', T0), w, T0 + 5000);
    expect(announceEvent(skipped, w, T0 + 5000, DEFAULT_AUDIO_SETTINGS)).toBeNull();
  });

  it('is the current phase with its remaining time mid-phase', () => {
    expect(announceEvent(startSession('w1d1', T0), w, T0 + 60_000, DEFAULT_AUDIO_SETTINGS))
      .toEqual({ kind: 'speech', inMs: 0, phaseType: 'walk', seconds: 300, extraKeys: [] });
  });

  it('is null when paused or with the voice off', () => {
    const paused = pauseSession(startSession('w1d1', T0), T0 + 60_000);
    expect(announceEvent(paused, w, T0 + 70_000, DEFAULT_AUDIO_SETTINGS)).toBeNull();
    const muted = { ...DEFAULT_AUDIO_SETTINGS, voiceVolume: 0 };
    expect(announceEvent(startSession('w1d1', T0), w, T0 + 60_000, muted)).toBeNull();
  });
});

describe('runPayload', () => {
  it('carries the session, phases, whole schedule and texts', () => {
    const session = startSession('w1d1', T0);
    const data = runPayload(session, w, T0, DEFAULT_AUDIO_SETTINGS, opts());
    expect(data.session).toEqual(session);
    expect(data.phases).toEqual(phaseList(w));
    expect(data.schedule).toEqual(nativeEvents(workoutSchedule(w, DEFAULT_AUDIO_SETTINGS), DEFAULT_AUDIO_SETTINGS, text));
    expect(data.announce).toBeNull();
    expect(data.locales).toEqual(['en-US']);
    expect(data.notification.pausedText).toBe('Paused');
    expect(data.watch.title).toBe('Week 1 • Day 1');
    expect(data).not.toHaveProperty('sentAt');
  });

  it('adds the mid-phase announcement only when asked', () => {
    const session = startSession('w1d1', T0);
    const quiet = runPayload(session, w, T0 + 60_000, DEFAULT_AUDIO_SETTINGS, opts());
    expect(quiet.announce).toBeNull();
    const loud = runPayload(session, w, T0 + 60_000, DEFAULT_AUDIO_SETTINGS, opts({ announceCurrent: true }));
    expect(loud.announce).toEqual({ text: 'walk 300', volume: DEFAULT_AUDIO_SETTINGS.voiceVolume });
  });

  it('keeps a paused session paused', () => {
    const paused = pauseSession(startSession('w1d1', T0), T0 + 5000);
    expect(runPayload(paused, w, T0 + 9000, DEFAULT_AUDIO_SETTINGS, opts()).session.pausedAt).toBe(T0 + 5000);
  });
});

describe('WATCH_LABEL_KEYS', () => {
  it('only names keys that exist', () => {
    for (const key of Object.values(WATCH_LABEL_KEYS)) expect(en).toHaveProperty([key]);
  });

  it('covers every label the watch shows', () => {
    expect(Object.keys(WATCH_LABEL_KEYS).sort()).toEqual([
      'done', 'idle', 'jog', 'last', 'next', 'pause', 'paused', 'remainingTotal', 'resume',
      'run', 'skip', 'stop', 'stopBody', 'stopKeep', 'stopTitle', 'unreachable', 'walk',
    ]);
  });
});
```

Note: `toHaveProperty([key])` uses the array form because keys contain dots.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/platform/native/payload.test.js`
Expected: FAIL — missing exports.

- [ ] **Step 3: Add the i18n keys**

Add next to the other `notification.*` keys and at the end of the file (keep each file's existing formatting):

`src/i18n/en.js`:
```js
  'notification.paused': 'Workout paused',
  'watch.idle': 'Start a workout on your phone',
  'watch.unreachable': 'Phone not reachable',
```

`src/i18n/pt.js`:
```js
  'notification.paused': 'Treino pausado',
  'watch.idle': 'Inicie um treino no celular',
  'watch.unreachable': 'Celular fora de alcance',
```

`src/i18n/es.js`:
```js
  'notification.paused': 'Entrenamiento en pausa',
  'watch.idle': 'Inicia un entrenamiento en tu teléfono',
  'watch.unreachable': 'Teléfono fuera de alcance',
```

If `pt.js` elsewhere says "telefone" rather than "celular", use the file's existing word.

- [ ] **Step 4: Implement the payload**

In `src/platform/native/payload.js`, extend the imports and add:

```js
import { cueVolume, DUE_GRACE_MS } from '../../core/cues.js';
import { testSequence } from '../../core/audioSettings.js';
import { getState, phaseBoundaries } from '../../core/timer.js';
import { buildTimeline, workoutSchedule } from '../../core/timeline.js';
```

```js
/** Watch text: label name → i18n key. `next` keeps its {phase} and {time} placeholders. */
export const WATCH_LABEL_KEYS = {
  walk: 'phase.walk',
  jog: 'phase.jog',
  run: 'phase.run',
  paused: 'run.paused',
  next: 'run.next',
  last: 'run.last',
  remainingTotal: 'run.remainingTotal',
  pause: 'run.pause',
  resume: 'run.resume',
  skip: 'run.skip',
  stop: 'run.stop',
  stopTitle: 'run.stopTitle',
  stopBody: 'run.stopBody',
  stopKeep: 'run.stopKeep',
  done: 'cue.finish',
  idle: 'watch.idle',
  unreachable: 'watch.unreachable',
};

/** @param {import('../../core/plan.js').Workout} workout */
export function phaseList(workout) {
  return phaseBoundaries(workout).map((bounds, i) => ({ type: workout.phases[i].type, ...bounds }));
}

/**
 * The line announcing the phase under way with its remaining time, when the
 * runner is mid-phase. At a phase start (fresh start, skip) the schedule
 * already has that phase's line, so there is nothing to add.
 * @returns {import('../../core/timeline.js').TimelineEvent | null}
 */
export function announceEvent(session, workout, now, settings) {
  const state = getState(session, workout, now);
  if (state.paused || state.finished) return null;
  const { startMs } = phaseBoundaries(workout)[state.phaseIndex];
  if (state.elapsedMs - startMs <= DUE_GRACE_MS) return null;
  return buildTimeline(session, workout, now, settings, { announceCurrent: true })
    .find((event) => event.kind === 'speech' && event.inMs === 0 && !('finish' in event)) ?? null;
}

/**
 * Everything the Android service needs to run the workout on its own: it
 * derives the state from the session timestamps, plays the part of the
 * schedule still ahead, and mirrors the run to the watch.
 * @param {import('../../core/timer.js').Session} session
 * @param {import('../../core/plan.js').Workout} workout
 * @param {number} now
 * @param {import('../../core/audioSettings.js').AudioSettings} settings
 * @param {{
 *   speechText: (event: any) => string,
 *   locales: string[],
 *   notification: { channel: string, title: string, text: string, pausedText: string },
 *   watch: { title: string, labels: Record<string, string> },
 *   announceCurrent: boolean,
 * }} options
 */
export function runPayload(session, workout, now, settings, { speechText, locales, notification, watch, announceCurrent }) {
  const current = announceCurrent ? announceEvent(session, workout, now, settings) : null;
  return {
    session: {
      workoutId: session.workoutId,
      startedAt: session.startedAt,
      pausedAt: session.pausedAt,
      pausedTotalMs: session.pausedTotalMs,
      skippedMs: session.skippedMs,
    },
    phases: phaseList(workout),
    schedule: nativeEvents(workoutSchedule(workout, settings), settings, speechText),
    announce: current === null ? null : { text: speechText(current), volume: settings.voiceVolume },
    locales,
    notification,
    watch,
  };
}
```

- [ ] **Step 5: Run the payload and i18n tests**

Run: `npx vitest run tests/platform/native/payload.test.js tests/i18n`
Expected: PASS.

- [ ] **Step 6: Write the failing reconcile tests**

Create `tests/platform/native/runState.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { reconcile } from '../../../src/platform/native/runState.js';

const session = { workoutId: 'w1d1', startedAt: 1000, pausedAt: null, pausedTotalMs: 0, skippedMs: 0 };
const state = (patch = {}) => ({ runId: 1000, revision: 5, ended: null, session, ...patch });

describe('reconcile', () => {
  it('ignores nothing to compare', () => {
    expect(reconcile(null, -1, state())).toEqual({ type: 'ignore' });
    expect(reconcile(1000, -1, null)).toEqual({ type: 'ignore' });
  });

  it('ignores a different run', () => {
    expect(reconcile(999, -1, state())).toEqual({ type: 'ignore' });
  });

  it('adopts a newer revision', () => {
    expect(reconcile(1000, 4, state())).toEqual({ type: 'adopt', session });
  });

  it('ignores a revision it already has', () => {
    expect(reconcile(1000, 5, state())).toEqual({ type: 'ignore' });
    expect(reconcile(1000, 6, state())).toEqual({ type: 'ignore' });
  });

  it('reports a stopped run, whatever the revision', () => {
    expect(reconcile(1000, 9, state({ ended: 'stopped' }))).toEqual({ type: 'stopped' });
  });

  it('reports a finished run with its final session', () => {
    expect(reconcile(1000, 9, state({ ended: 'finished' }))).toEqual({ type: 'finished', session });
  });
});
```

- [ ] **Step 7: Run to see it fail**

Run: `npx vitest run tests/platform/native/runState.test.js`
Expected: FAIL — module not found.

- [ ] **Step 8: Implement reconcile**

Create `src/platform/native/runState.js`:

```js
/**
 * @typedef {import('../../core/timer.js').Session} Session
 * @typedef {{ runId: number, revision: number, ended: null | 'stopped' | 'finished', session: Session }} RunState
 *   What the Android service reports: it owns the run while it is active,
 *   and every change (phone, watch, finish) gets a higher revision.
 * @typedef {{ type: 'ignore' }
 *   | { type: 'adopt', session: Session }
 *   | { type: 'stopped' }
 *   | { type: 'finished', session: Session }} RunDecision
 */

/**
 * What the app should do with a state reported by the service.
 * @param {number | null} runId the run the app shows (its session's startedAt)
 * @param {number} revision the newest revision the app has seen (-1: none)
 * @param {RunState | null} remote
 * @returns {RunDecision}
 */
export function reconcile(runId, revision, remote) {
  if (!remote || runId === null || remote.runId !== runId) return { type: 'ignore' };
  if (remote.ended === 'stopped') return { type: 'stopped' };
  if (remote.ended === 'finished') return { type: 'finished', session: remote.session };
  if (remote.revision > revision) return { type: 'adopt', session: remote.session };
  return { type: 'ignore' };
}
```

- [ ] **Step 9: Run all tests and the build**

Run: `npm test` then `npm run build`
Expected: PASS (existing `nativeCueEngine` tests still pass: the engine is unchanged until Task 4).

- [ ] **Step 10: Commit**

```bash
git add src/platform/native/payload.js src/platform/native/runState.js tests/platform/native src/i18n
git commit -m "feat: add the run payload, watch labels and run-state reconcile"
```

---

### Task 4: Engines and controller: send every session change, follow the service

**Files:**
- Modify: `src/platform/native/nativeCueEngine.js`, `tests/platform/native/nativeCueEngine.test.js`
- Modify: `src/platform/webCueEngine.js`
- Modify: `src/ui/controller.svelte.js`

**Interfaces:**
- Consumes: `runPayload`, `reconcile` (Task 3).
- Produces: `CueEngine` (typedef in `webCueEngine.js`) becomes:
  ```js
  {
    speaksInBackground: boolean,
    sync(session, workout, now, settings, { announceCurrent: boolean }): boolean, // was start()
    stop(): void,
    test(settings, sampleText, onDone): void,
    onRunState(listener: (decision: RunDecision) => void): void,
    checkRunState(session: Session): void,
  }
  ```
- Produces: plugin calls the Java side must implement (Task 6): `start(payload)`, `stop({ reason: 'stopped' })`, `current() → { state: RunState | null }`, event `stateChanged` with a `RunState`.
- `createNativeCueEngine` options gain `watch: (workout) => { title, labels }`; `notification(workout)` gains `pausedText`.

- [ ] **Step 1: Rewrite the native engine tests**

Replace the body of `tests/platform/native/nativeCueEngine.test.js` with:

```js
import { describe, it, expect, vi } from 'vitest';
import { findWorkout } from '../../../src/core/plan.js';
import { startSession, pauseSession } from '../../../src/core/timer.js';
import { DEFAULT_AUDIO_SETTINGS } from '../../../src/core/audioSettings.js';
import { createNativeCueEngine } from '../../../src/platform/native/nativeCueEngine.js';

const w = findWorkout('w1d1');
const T0 = 1_000_000;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakePlugin() {
  let grant;
  const listeners = {};
  return {
    permission: new Promise((resolve) => { grant = resolve; }),
    grant: () => grant(),
    current: vi.fn(() => Promise.resolve({ state: null })),
    emit: (name, data) => listeners[name]?.(data),
    addListener: vi.fn((name, callback) => { listeners[name] = callback; return Promise.resolve({ remove() {} }); }),
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
    test: vi.fn(() => Promise.resolve()),
    requestPermissions() { return this.permission; },
  };
}

function engineWith(plugin, onFailure = vi.fn(), clock = () => T0) {
  return createNativeCueEngine({
    plugin,
    clock,
    locales: () => ['en-US'],
    speechText: (event) => ('finish' in event ? 'done' : `${event.phaseType} ${event.seconds}`),
    notification: (workout) => ({ channel: 'Workout', title: `W${workout.week}D${workout.day}`, text: 'Running', pausedText: 'Paused' }),
    watch: () => ({ title: 'Week 1 • Day 1', labels: { walk: 'Walk' } }),
    onFailure,
  });
}

const running = startSession('w1d1', T0);
const syncOpts = { announceCurrent: true };

describe('createNativeCueEngine', () => {
  it('speaks in the background', () => {
    expect(engineWith(fakePlugin()).speaksInBackground).toBe(true);
  });

  it('asks for permission once, then sends the run payload', async () => {
    const plugin = fakePlugin();
    const engine = engineWith(plugin);
    expect(engine.sync(running, w, T0, DEFAULT_AUDIO_SETTINGS, syncOpts)).toBe(true);
    plugin.grant();
    await flush();
    expect(plugin.start).toHaveBeenCalledTimes(1);
    const data = plugin.start.mock.calls[0][0];
    expect(data.session).toEqual(running);
    expect(data.locales).toEqual(['en-US']);
    expect(data.notification.pausedText).toBe('Paused');
    expect(data.watch.title).toBe('Week 1 • Day 1');
    expect(data.schedule[0]).toEqual({ type: 'tone', atMs: 0, tone: 'walk', volume: DEFAULT_AUDIO_SETTINGS.beepVolume });
    expect(data.announce).toBeNull();
  });

  it('pause sends the paused session, never stop', async () => {
    const plugin = fakePlugin();
    const engine = engineWith(plugin);
    plugin.grant();
    engine.sync(pauseSession(running, T0 + 5000), w, T0 + 5000, DEFAULT_AUDIO_SETTINGS, { announceCurrent: false });
    await flush();
    expect(plugin.stop).not.toHaveBeenCalled();
    expect(plugin.start.mock.calls[0][0].session.pausedAt).toBe(T0 + 5000);
  });

  it('announces where the runner is when a slow permission prompt delayed the start', async () => {
    const plugin = fakePlugin();
    let time = T0;
    const engine = engineWith(plugin, vi.fn(), () => time);
    engine.sync(running, w, T0, DEFAULT_AUDIO_SETTINGS, { announceCurrent: false });
    time = T0 + 4000;
    plugin.grant();
    await flush();
    expect(plugin.start.mock.calls[0][0].announce).toEqual({ text: 'walk 356', volume: DEFAULT_AUDIO_SETTINGS.voiceVolume });
  });

  it('does not start after a stop that came while waiting for permission', async () => {
    const plugin = fakePlugin();
    const engine = engineWith(plugin);
    engine.sync(running, w, T0, DEFAULT_AUDIO_SETTINGS, syncOpts);
    engine.stop();
    plugin.grant();
    await flush();
    expect(plugin.start).not.toHaveBeenCalled();
    expect(plugin.stop).toHaveBeenCalledWith({ reason: 'stopped' });
  });

  it('reports a failed start', async () => {
    const plugin = fakePlugin();
    const error = new Error('no service');
    plugin.start = vi.fn(() => Promise.reject(error));
    const onFailure = vi.fn();
    engineWith(plugin, onFailure).sync(running, w, T0, DEFAULT_AUDIO_SETTINGS, syncOpts);
    plugin.grant();
    await flush();
    expect(onFailure).toHaveBeenCalledWith(error);
  });

  it('passes newer states of its run to the listener, once', async () => {
    const plugin = fakePlugin();
    const engine = engineWith(plugin);
    const listener = vi.fn();
    engine.onRunState(listener);
    plugin.grant();
    engine.sync(running, w, T0, DEFAULT_AUDIO_SETTINGS, syncOpts);
    const paused = pauseSession(running, T0 + 9000);
    plugin.emit('stateChanged', { runId: T0, revision: 3, ended: null, session: paused });
    plugin.emit('stateChanged', { runId: T0, revision: 3, ended: null, session: paused });
    plugin.emit('stateChanged', { runId: 42, revision: 9, ended: null, session: paused });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ type: 'adopt', session: paused });
  });

  it('ignores states after its own stop', () => {
    const plugin = fakePlugin();
    const engine = engineWith(plugin);
    const listener = vi.fn();
    engine.onRunState(listener);
    engine.sync(running, w, T0, DEFAULT_AUDIO_SETTINGS, syncOpts);
    engine.stop();
    plugin.emit('stateChanged', { runId: T0, revision: 3, ended: 'stopped', session: running });
    expect(listener).not.toHaveBeenCalled();
  });

  it('checks the saved state for a session it has not sent yet', async () => {
    const plugin = fakePlugin();
    plugin.current = vi.fn(() => Promise.resolve({ state: { runId: T0, revision: 7, ended: 'stopped', session: running } }));
    const engine = engineWith(plugin);
    const listener = vi.fn();
    engine.onRunState(listener);
    engine.checkRunState(running);
    await flush();
    expect(listener).toHaveBeenCalledWith({ type: 'stopped' });
  });

  it('only finishes the latest audio test', async () => {
    const plugin = fakePlugin();
    const resolvers = [];
    plugin.test = vi.fn(() => new Promise((resolve) => resolvers.push(resolve)));
    const engine = engineWith(plugin);
    const first = vi.fn();
    const second = vi.fn();
    engine.test(DEFAULT_AUDIO_SETTINGS, 'sample', first);
    engine.test(DEFAULT_AUDIO_SETTINGS, 'sample', second);
    resolvers[0]();
    await flush();
    expect(first).not.toHaveBeenCalled();
    resolvers[1]();
    await flush();
    expect(second).toHaveBeenCalledTimes(1);
    expect(plugin.test.mock.calls[0][0]).toEqual(expect.objectContaining({ locales: ['en-US'] }));
  });

  it('finishes a failed audio test too', async () => {
    const plugin = fakePlugin();
    plugin.test = vi.fn(() => Promise.reject(new Error('no audio')));
    const onDone = vi.fn();
    engineWith(plugin).test(DEFAULT_AUDIO_SETTINGS, null, onDone);
    await flush();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
```

(`walk 356`: 4 s into the 360 s first phase, `announceEvent` gives the remaining 356 s.)

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/platform/native/nativeCueEngine.test.js`
Expected: FAIL — `engine.sync is not a function`.

- [ ] **Step 3: Rewrite the native engine**

Replace `src/platform/native/nativeCueEngine.js` with:

```js
import { runPayload, nativeTest } from './payload.js';
import { reconcile } from './runState.js';

// A start delayed longer than this (the permission prompt) announces where the runner is.
const STALE_START_MS = 1000;

/**
 * Cues played by the Android app's Coach plugin. Its foreground service owns
 * the run: it plays the whole schedule (tones and speech) with the screen
 * locked, applies pause / resume / skip / stop coming from the watch, and
 * reports each change back, as a `stateChanged` event while the page runs
 * and through `current()` when it wakes up.
 * @param {{
 *   plugin: {
 *     start(data: object): Promise<unknown>, stop(data: object): Promise<unknown>,
 *     current(): Promise<{ state: import('./runState.js').RunState | null }>,
 *     addListener(event: string, callback: (data: any) => void): Promise<unknown>,
 *     test(data: object): Promise<unknown>, requestPermissions(): Promise<unknown>,
 *   },
 *   locales: () => string[],
 *   speechText: (event: any) => string,
 *   notification: (workout: import('../../core/plan.js').Workout) => { channel: string, title: string, text: string, pausedText: string },
 *   watch: (workout: import('../../core/plan.js').Workout) => { title: string, labels: Record<string, string> },
 *   onFailure: (error: unknown) => void,
 *   clock?: () => number,
 * }} options
 * @returns {import('../webCueEngine.js').CueEngine}
 */
export function createNativeCueEngine({ plugin, locales, speechText, notification, watch, onFailure, clock = Date.now }) {
  /** @type {Promise<unknown> | null} */
  let permission = null;
  // Bumped on every sync and stop, so a sync still waiting for the
  // permission prompt does not revive a run after a later stop.
  let generation = 0;
  let testRun = 0;
  /** The run the app shows and the newest revision seen for it. @type {{ runId: number, revision: number } | null} */
  let tracked = null;
  /** @type {(decision: import('./runState.js').RunDecision) => void} */
  let listener = () => {};

  const track = (session) => {
    if (tracked?.runId !== session.startedAt) tracked = { runId: session.startedAt, revision: -1 };
  };

  /** @param {import('./runState.js').RunState | null} state */
  const deliver = (state) => {
    const decision = reconcile(tracked?.runId ?? null, tracked?.revision ?? -1, state);
    if (decision.type === 'ignore') return;
    if (decision.type === 'adopt') tracked = { runId: state.runId, revision: state.revision };
    else tracked = null;
    listener(decision);
  };

  return {
    speaksInBackground: true,
    sync(session, workout, now, settings, { announceCurrent }) {
      const run = ++generation;
      const calledAt = clock();
      track(session);
      permission ??= plugin.requestPermissions().catch(() => {});
      permission
        .then(() => {
          if (run !== generation) return undefined;
          const at = clock();
          return plugin.start(runPayload(session, workout, at, settings, {
            speechText,
            locales: locales(),
            notification: notification(workout),
            watch: watch(workout),
            announceCurrent: announceCurrent || at - calledAt > STALE_START_MS,
          }));
        })
        .catch(onFailure);
      return true;
    },
    stop() {
      generation++;
      tracked = null;
      plugin.stop({ reason: 'stopped' }).catch(() => {});
    },
    onRunState(callback) {
      listener = callback;
      plugin.addListener('stateChanged', deliver).catch(() => {});
    },
    checkRunState(session) {
      track(session);
      plugin.current().then(({ state }) => deliver(state)).catch(() => {});
    },
    test(settings, sampleText, onDone) {
      const run = ++testRun;
      plugin.test({ ...nativeTest(settings, sampleText), locales: locales() })
        .catch(() => {})
        .then(() => { if (run === testRun) onDone(); });
    },
  };
}
```

- [ ] **Step 4: Run the engine tests**

Run: `npx vitest run tests/platform/native/nativeCueEngine.test.js`
Expected: PASS.

- [ ] **Step 5: Web engine: `start` → `sync`**

In `src/platform/webCueEngine.js`, update the `CueEngine` typedef:

```js
/**
 * @typedef {{
 *   speaksInBackground: boolean,
 *   sync(session: import('../core/timer.js').Session, workout: import('../core/plan.js').Workout,
 *     now: number, settings: import('../core/audioSettings.js').AudioSettings,
 *     options: { announceCurrent: boolean }): boolean,
 *   stop(): void,
 *   test(settings: import('../core/audioSettings.js').AudioSettings, sampleText: string | null, onDone: () => void): void,
 *   onRunState(listener: (decision: import('./native/runState.js').RunDecision) => void): void,
 *   checkRunState(session: import('../core/timer.js').Session): void,
 * }} CueEngine
 * Plays a workout's cues. `sync` is called after every session change (start,
 * pause, resume, skip, settings, language) and returns whether audio is
 * available. `speaksInBackground` engines speak the phase lines themselves;
 * otherwise the controller speaks them while visible. Only the Android
 * engine reports run states (changes made from the watch).
 */
```

(keep the existing `test` signature if it differs from the line above — copy it from the current typedef.) Replace the `start` method with:

```js
    // announceCurrent is ignored: the controller's tick announces phases here.
    sync(session, workout, now, settings) {
      player.stop();
      if (session.pausedAt !== null) return true;
      return player.start(session, workout, now, settings);
    },
```

and add after `stop()`:

```js
    onRunState() {},
    checkRunState() {},
```

- [ ] **Step 6: Controller wiring**

In `src/ui/controller.svelte.js`:

1. Engine options — change `notification` and add `watch` (import `WATCH_LABEL_KEYS` from `'../platform/native/payload.js'`):

```js
    notification: (workout) => ({
      channel: t('notification.channel'),
      title: t('workout.title', { week: workout.week, day: workout.day }),
      text: t('notification.running'),
      pausedText: t('notification.paused'),
    }),
    watch: (workout) => ({
      title: t('common.weekDay', { week: workout.week, day: workout.day }),
      labels: Object.fromEntries(Object.entries(WATCH_LABEL_KEYS).map(([name, key]) => [name, t(key)])),
    }),
```

2. Right after the `let engine = ...` declaration and `useWebEngine`, register the listener:

```js
engine.onRunState(applyRunState);
```

3. `useWebEngine` — replace `playCues()` with `syncCues()`.

4. `init()` — after setting `app.pendingResume`:

```js
  if (shouldOfferResume(saved, Date.now())) {
    app.pendingResume = saved;
    // The Android service may have moved on (watch commands) or ended the run.
    engine.checkRunState(saved);
  } else storage.clearSession();
```

5. `setLang` — replace the re-send block with:

```js
  // The native engine speaks and shows pre-rendered text: re-send it in the new language.
  if (engine.speaksInBackground && app.session) syncCues();
```

6. `setAudio` — replace the re-schedule block with:

```js
  // Re-schedule so the change applies now.
  if (app.session) syncCues();
```

7. `pause`, `resume`, `skip`:

```js
export function pause() {
  setSession(pauseSession(app.session, Date.now()));
  syncCues();
}

export function resume() {
  setSession(resumeSession(app.session, Date.now()));
  syncCues();
}

export function skip() {
  setSession(skipPhase(app.session, currentWorkout(), Date.now()));
  syncCues(true);
  tick();
}
```

8. `beginRun` — replace `if (session.pausedAt === null) playCues(true);` with `syncCues(true);` (a paused session is sent too, so the service and the watch show it paused).

9. Rename `playCues` to `syncCues` and call `engine.sync`:

```js
function syncCues(announceCurrent = false) {
  app.audioAvailable = engine.sync(
    $state.snapshot(app.session), currentWorkout(), Date.now(), $state.snapshot(app.settings),
    { announceCurrent },
  );
}
```

10. `onVisibilityChange`:

```js
function onVisibilityChange() {
  if (document.visibilityState !== 'visible') return;
  tick();
  if (!app.session) return;
  // Android: catch up with changes made from the watch while the page slept.
  if (engine.speaksInBackground) engine.checkRunState($state.snapshot(app.session));
  else if (app.session.pausedAt === null) syncCues();
}
```

(`tick()` can end the run; hence the `app.session` check after it.)

11. Add `applyRunState` next to `tick`:

```js
/**
 * A change the Android service made on its own: a watch command, the finish
 * while the page slept, or a stop.
 * @param {import('../platform/native/runState.js').RunDecision} decision
 */
function applyRunState(decision) {
  if (app.session) {
    if (decision.type === 'stopped') {
      endRun();
      app.screen = 'workout';
      return;
    }
    setSession(decision.session);
    tick();
    return;
  }
  if (!app.pendingResume) return;
  if (decision.type === 'stopped') {
    app.pendingResume = null;
    storage.clearSession();
  } else if (decision.type === 'finished') {
    app.pendingResume = null;
    app.workoutId = decision.session.workoutId;
    finish(findWorkout(decision.session.workoutId));
  } else {
    app.pendingResume = decision.session;
    storage.saveSession(decision.session);
  }
}
```

Search the file for any remaining `playCues` or `engine.start` and replace them as above; there must be none left. `stop()`, `discardResume()` and `finish()` keep calling `engine.stop()` as today.

- [ ] **Step 7: Run all tests and the build**

Run: `npm test` then `npm run build`
Expected: PASS.

- [ ] **Step 8: Check the web build in the browser**

Run the dev server (launch config or `npm run dev`), open Week 1 Day 1, start, pause, resume, skip, stop. Expected: identical behaviour to before (beeps, voice while visible, countdown), no console errors.

- [ ] **Step 9: Commit**

```bash
git add src tests
git commit -m "feat: send every session change to the Android service and follow its run state"
```

---

### Task 5: Phone session arithmetic, schedule filter and run model (pure Java)

**Files:**
- Create: `android/app/src/main/java/io/github/willenjs/pulserun/coach/SessionMath.java`, `Schedule.java`, `RunModel.java`
- Create: `android/app/src/test/java/io/github/willenjs/pulserun/coach/SessionMathTest.java`, `ScheduleTest.java`, `RunModelTest.java`
- Delete: `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java`
- Modify: `android/app/build.gradle`, `package.json`

**Interfaces:**
- Produces `SessionMath` (package-private, final):
  - `static final class Session { final String workoutId; final long startedAt; final Long pausedAt; final long pausedTotalMs; final long skippedMs; boolean paused(); static Session fromJson(JSONObject); JSONObject toJson(); }`
  - `static long elapsedMs(Session s, long totalMs, long now)`
  - `static Session pause(Session s, long now)`, `static Session resume(Session s, long now)`, `static Session skip(Session s, long[] phaseEnds, long now)`
- Produces `Schedule`: `static final long DUE_GRACE_MS = 250`; `static final class Event { final String type; final long atMs; final String tone; final String text; final int volume; }`; `static List<Event> parse(JSONArray)`; `static List<Event> ahead(List<Event>, long elapsedMs)`.
- Produces `RunModel`:
  - `static RunModel fromPayload(JSONObject payload, long revision) throws JSONException`
  - fields/getters: `long runId()`, `long revision()`, `String ended()` (null / "stopped" / "finished"), `SessionMath.Session session()`, `long totalMs()`, `List<Schedule.Event> schedule()`, `JSONObject payload()` (the original: `locales`, `notification`, `announce`)
  - `long elapsedMs(long now)`, `boolean finishedAt(long now)`
  - `boolean applyCommand(JSONObject command, long now, long newRevision)` — true when applied
  - `void end(String reason, long newRevision)`
  - `JSONObject toState()` → `{ runId, revision, ended, session, phases, watch }`
- Produces npm script `android:test` → `gradlew :app:testDebugUnitTest :wear:testDebugUnitTest`.

- [ ] **Step 1: Test dependency and npm script**

`android/app/build.gradle` — add to `dependencies`:

```groovy
    // Local unit tests run on the JVM, where Android's org.json is only a stub.
    testImplementation "org.json:json:$orgJsonVersion"
```

Create `scripts/android-test.mjs`:

```js
// Runs the phone and watch JVM unit tests.
import { run, gradlew } from './android-env.mjs';

run(gradlew, [':app:testDebugUnitTest', ':wear:testDebugUnitTest'], 'android');
```

and add `"android:test": "node scripts/android-test.mjs"` to `scripts` in `package.json`. Delete `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java` (template leftover).

- [ ] **Step 2: Write the failing tests**

On Android, `org.json`'s `getLong`, `put` etc. throw the **checked** `JSONException`; the Maven `org.json` jar used by the tests throws an unchecked one. So every test method and helper below declares `throws Exception`, and main code either declares `throws JSONException` or wraps.

Create `android/app/src/test/java/io/github/willenjs/pulserun/coach/SessionMathTest.java`:

```java
package io.github.willenjs.pulserun.coach;

import static org.junit.Assert.assertEquals;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Checks SessionMath against tests/fixtures/session-math.json, which vitest checks against timer.js. */
public class SessionMathTest {
    static JSONObject fixtures() throws Exception {
        // Unit tests run with the module directory (android/app) as working directory.
        return new JSONObject(new String(Files.readAllBytes(Paths.get("../../tests/fixtures/session-math.json")), StandardCharsets.UTF_8));
    }

    static long[] phaseEnds(JSONArray phases) throws Exception {
        long[] ends = new long[phases.length()];
        for (int i = 0; i < ends.length; i++) ends[i] = phases.getJSONObject(i).getLong("endMs");
        return ends;
    }

    static void assertSession(String name, JSONObject expected, SessionMath.Session actual) throws Exception {
        assertEquals(name + " startedAt", expected.getLong("startedAt"), actual.startedAt);
        assertEquals(name + " pausedAt", expected.isNull("pausedAt") ? null : expected.getLong("pausedAt"), actual.pausedAt);
        assertEquals(name + " pausedTotalMs", expected.getLong("pausedTotalMs"), actual.pausedTotalMs);
        assertEquals(name + " skippedMs", expected.getLong("skippedMs"), actual.skippedMs);
    }

    @Test
    public void elapsedMatchesFixtures() throws Exception {
        JSONObject f = fixtures();
        long[] ends = phaseEnds(f.getJSONArray("phases"));
        JSONArray cases = f.getJSONArray("elapsed");
        for (int i = 0; i < cases.length(); i++) {
            JSONObject c = cases.getJSONObject(i);
            SessionMath.Session s = SessionMath.Session.fromJson(c.getJSONObject("session"));
            assertEquals(c.getString("name"), c.getLong("elapsedMs"), SessionMath.elapsedMs(s, ends[ends.length - 1], c.getLong("now")));
        }
    }

    @Test
    public void actionsMatchFixtures() throws Exception {
        JSONObject f = fixtures();
        long[] ends = phaseEnds(f.getJSONArray("phases"));
        JSONArray cases = f.getJSONArray("actions");
        for (int i = 0; i < cases.length(); i++) {
            JSONObject c = cases.getJSONObject(i);
            SessionMath.Session s = SessionMath.Session.fromJson(c.getJSONObject("session"));
            long now = c.getLong("now");
            SessionMath.Session result;
            switch (c.getString("action")) {
                case "pause": result = SessionMath.pause(s, now); break;
                case "resume": result = SessionMath.resume(s, now); break;
                default: result = SessionMath.skip(s, ends, now); break;
            }
            assertSession(c.getString("name"), c.getJSONObject("expected"), result);
        }
    }

    @Test
    public void roundTripsJson() throws Exception {
        JSONObject json = new JSONObject().put("workoutId", "w1d1").put("startedAt", 5L)
            .put("pausedAt", JSONObject.NULL).put("pausedTotalMs", 1L).put("skippedMs", 2L);
        JSONObject back = SessionMath.Session.fromJson(json).toJson();
        assertEquals("w1d1", back.getString("workoutId"));
        assertEquals(true, back.isNull("pausedAt"));
        assertEquals(2L, back.getLong("skippedMs"));
    }
}
```

Create `ScheduleTest.java` (same package):

```java
package io.github.willenjs.pulserun.coach;

import static org.junit.Assert.assertEquals;

import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

public class ScheduleTest {
    static JSONArray events() throws Exception {
        return new JSONArray()
            .put(new JSONObject().put("type", "tone").put("atMs", 0).put("tone", "walk").put("volume", 60))
            .put(new JSONObject().put("type", "speech").put("atMs", 0).put("text", "Walk").put("volume", 60))
            .put(new JSONObject().put("type", "tone").put("atMs", 360000).put("tone", "jog").put("volume", 60))
            .put(new JSONObject().put("type", "speech").put("atMs", 360000).put("text", "Jog").put("volume", 60))
            .put("not an event")
            .put(new JSONObject().put("type", "vibrate").put("atMs", 5));
    }

    @Test
    public void parsesToneAndSpeechEventsOnly() throws Exception {
        List<Schedule.Event> list = Schedule.parse(events());
        assertEquals(4, list.size());
        assertEquals("walk", list.get(0).tone);
        assertEquals("Jog", list.get(3).text);
        assertEquals(360000, list.get(3).atMs);
    }

    @Test
    public void keepsEventsWithinGrace() throws Exception {
        List<Schedule.Event> ahead = Schedule.ahead(Schedule.parse(events()), 360000 + 200);
        assertEquals(2, ahead.size());
        assertEquals("jog", ahead.get(0).tone);
    }

    @Test
    public void dropsEventsOlderThanGrace() throws Exception {
        assertEquals(0, Schedule.ahead(Schedule.parse(events()), 360000 + 300).size());
    }

    @Test
    public void parsesNullAsEmpty() {
        assertEquals(0, Schedule.parse(null).size());
    }
}
```

Create `RunModelTest.java` (same package):

```java
package io.github.willenjs.pulserun.coach;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

public class RunModelTest {
    static final long T0 = 1_000_000;

    static JSONObject payload() throws Exception {
        JSONObject session = new JSONObject().put("workoutId", "w1d1").put("startedAt", T0)
            .put("pausedAt", JSONObject.NULL).put("pausedTotalMs", 0).put("skippedMs", 0);
        JSONArray phases = new JSONArray()
            .put(new JSONObject().put("type", "walk").put("startMs", 0).put("endMs", 360000))
            .put(new JSONObject().put("type", "jog").put("startMs", 360000).put("endMs", 480000));
        return new JSONObject().put("session", session).put("phases", phases).put("schedule", ScheduleTest.events())
            .put("announce", JSONObject.NULL).put("locales", new JSONArray().put("en-US"))
            .put("notification", new JSONObject().put("title", "W1D1"))
            .put("watch", new JSONObject().put("title", "Week 1 • Day 1"));
    }

    static JSONObject command(String action, long basedOn) throws Exception {
        return new JSONObject().put("runId", T0).put("action", action).put("basedOn", basedOn);
    }

    @Test
    public void readsThePayload() throws Exception {
        RunModel run = RunModel.fromPayload(payload(), 4);
        assertEquals(T0, run.runId());
        assertEquals(4, run.revision());
        assertNull(run.ended());
        assertEquals(480000, run.totalMs());
        assertEquals(4, run.schedule().size());
        assertEquals(100000, run.elapsedMs(T0 + 100000));
    }

    @Test
    public void appliesAPauseFromTheCurrentRevision() throws Exception {
        RunModel run = RunModel.fromPayload(payload(), 4);
        assertTrue(run.applyCommand(command("pause", 4), T0 + 10000, 5));
        assertEquals(5, run.revision());
        assertEquals(Long.valueOf(T0 + 10000), run.session().pausedAt);
    }

    @Test
    public void resumesAndSkips() throws Exception {
        RunModel run = RunModel.fromPayload(payload(), 1);
        run.applyCommand(command("pause", 1), T0 + 10000, 2);
        assertTrue(run.applyCommand(command("resume", 2), T0 + 25000, 3));
        assertEquals(15000, run.session().pausedTotalMs);
        assertTrue(run.applyCommand(command("skip", 3), T0 + 25000, 4));
        assertEquals(360000, run.elapsedMs(T0 + 25000));
    }

    @Test
    public void ignoresStaleBasedOn() throws Exception {
        RunModel run = RunModel.fromPayload(payload(), 1);
        assertTrue(run.applyCommand(command("skip", 1), T0 + 1000, 2));
        assertFalse(run.applyCommand(command("skip", 1), T0 + 1100, 3));
        assertEquals(2, run.revision());
        assertEquals(360000, run.elapsedMs(T0 + 1000));
    }

    @Test
    public void ignoresOtherRun() throws Exception {
        RunModel run = RunModel.fromPayload(payload(), 1);
        JSONObject other = command("pause", 1).put("runId", T0 + 1);
        assertFalse(run.applyCommand(other, T0 + 1000, 2));
        assertNull(run.session().pausedAt);
    }

    @Test
    public void ignoresUnknownActionsAndEndedRuns() throws Exception {
        RunModel run = RunModel.fromPayload(payload(), 1);
        assertFalse(run.applyCommand(command("dance", 1), T0, 2));
        assertTrue(run.applyCommand(command("stop", 1), T0, 2));
        assertEquals("stopped", run.ended());
        assertFalse(run.applyCommand(command("resume", 2), T0, 3));
    }

    @Test
    public void knowsWhenItIsFinished() throws Exception {
        RunModel run = RunModel.fromPayload(payload(), 1);
        assertFalse(run.finishedAt(T0 + 479999));
        assertTrue(run.finishedAt(T0 + 480000));
    }

    @Test
    public void reportsItsState() throws Exception {
        RunModel run = RunModel.fromPayload(payload(), 7);
        run.end("finished", 8);
        JSONObject state = run.toState();
        assertEquals(T0, state.getLong("runId"));
        assertEquals(8, state.getLong("revision"));
        assertEquals("finished", state.getString("ended"));
        assertEquals("w1d1", state.getJSONObject("session").getString("workoutId"));
        assertEquals(2, state.getJSONArray("phases").length());
        assertEquals("Week 1 • Day 1", state.getJSONObject("watch").getString("title"));
    }

    @Test(expected = org.json.JSONException.class)
    public void rejectsAPayloadWithoutPhases() throws Exception {
        JSONObject bad = payload();
        bad.remove("phases");
        RunModel.fromPayload(bad, 1);
    }
}
```

- [ ] **Step 3: Run to see them fail**

Run: `npm run android:test`
Expected: FAIL — compilation errors (`SessionMath`, `Schedule`, `RunModel` not found). If the `:wear:testDebugUnitTest` part fails only because the wear module has no tests yet, that is fine; it must not be a build error.

- [ ] **Step 4: Implement `SessionMath`**

Create `android/app/src/main/java/io/github/willenjs/pulserun/coach/SessionMath.java`:

```java
package io.github.willenjs.pulserun.coach;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * The session arithmetic of src/core/timer.js, for the service to apply
 * watch commands while the page's JavaScript sleeps. All times are epoch ms;
 * state is always derived from these four timestamps. Pinned to timer.js by
 * tests/fixtures/session-math.json.
 */
final class SessionMath {
    private SessionMath() {}

    static final class Session {
        final String workoutId;
        final long startedAt;
        final Long pausedAt;
        final long pausedTotalMs;
        final long skippedMs;

        Session(String workoutId, long startedAt, Long pausedAt, long pausedTotalMs, long skippedMs) {
            this.workoutId = workoutId;
            this.startedAt = startedAt;
            this.pausedAt = pausedAt;
            this.pausedTotalMs = pausedTotalMs;
            this.skippedMs = skippedMs;
        }

        boolean paused() {
            return pausedAt != null;
        }

        static Session fromJson(JSONObject json) throws JSONException {
            return new Session(
                json.optString("workoutId", ""),
                json.getLong("startedAt"),
                json.isNull("pausedAt") ? null : json.getLong("pausedAt"),
                json.optLong("pausedTotalMs"),
                json.optLong("skippedMs"));
        }

        JSONObject toJson() {
            try {
                return new JSONObject()
                    .put("workoutId", workoutId)
                    .put("startedAt", startedAt)
                    .put("pausedAt", pausedAt == null ? JSONObject.NULL : pausedAt)
                    .put("pausedTotalMs", pausedTotalMs)
                    .put("skippedMs", skippedMs);
            } catch (JSONException e) {
                throw new IllegalStateException(e); // plain numbers and strings: cannot happen
            }
        }
    }

    static long elapsedMs(Session s, long totalMs, long now) {
        long at = s.pausedAt != null ? s.pausedAt : now;
        long raw = at - s.startedAt - s.pausedTotalMs + s.skippedMs;
        return Math.min(totalMs, Math.max(0, raw));
    }

    static Session pause(Session s, long now) {
        if (s.paused()) return s;
        return new Session(s.workoutId, s.startedAt, now, s.pausedTotalMs, s.skippedMs);
    }

    static Session resume(Session s, long now) {
        if (!s.paused()) return s;
        return new Session(s.workoutId, s.startedAt, null, s.pausedTotalMs + Math.max(0, now - s.pausedAt), s.skippedMs);
    }

    /** Jumps to the start of the next phase (skipPhase in timer.js). */
    static Session skip(Session s, long[] phaseEnds, long now) {
        long total = phaseEnds[phaseEnds.length - 1];
        long elapsed = elapsedMs(s, total, now);
        if (elapsed >= total) return s;
        for (long end : phaseEnds) {
            if (elapsed < end) {
                return new Session(s.workoutId, s.startedAt, s.pausedAt, s.pausedTotalMs, s.skippedMs + end - elapsed);
            }
        }
        return s;
    }
}
```

- [ ] **Step 5: Implement `Schedule`**

Create `Schedule.java`:

```java
package io.github.willenjs.pulserun.coach;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** A workout's cue schedule in workout time (workoutSchedule in src/core/timeline.js). */
final class Schedule {
    /** DUE_GRACE_MS in src/core/cues.js. */
    static final long DUE_GRACE_MS = 250;

    private Schedule() {}

    static final class Event {
        final String type;
        final long atMs;
        final String tone;
        final String text;
        final int volume;

        Event(String type, long atMs, String tone, String text, int volume) {
            this.type = type;
            this.atMs = atMs;
            this.tone = tone;
            this.text = text;
            this.volume = volume;
        }

        boolean isTone() {
            return "tone".equals(type);
        }
    }

    /** Tone and speech events; anything else is skipped. */
    static List<Event> parse(JSONArray array) {
        if (array == null) return Collections.emptyList();
        List<Event> events = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) {
            JSONObject e = array.optJSONObject(i);
            if (e == null) continue;
            String type = e.optString("type");
            if (!"tone".equals(type) && !"speech".equals(type)) continue;
            events.add(new Event(type, e.optLong("atMs"), e.optString("tone"), e.optString("text"), e.optInt("volume")));
        }
        return events;
    }

    /** Events still due at elapsedMs, allowing DUE_GRACE_MS of lateness. */
    static List<Event> ahead(List<Event> events, long elapsedMs) {
        List<Event> result = new ArrayList<>();
        for (Event e : events) {
            if (e.atMs >= elapsedMs - DUE_GRACE_MS) result.add(e);
        }
        return result;
    }
}
```

- [ ] **Step 6: Implement `RunModel`**

Create `RunModel.java`:

```java
package io.github.willenjs.pulserun.coach;

import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The run the service owns: the session from the page plus every change made
 * since (watch commands, the finish). Each change takes a new, higher
 * revision so the page and the watch can tell newer states from older ones.
 */
final class RunModel {
    private final JSONObject payload;
    private final JSONArray phases;
    private final long[] phaseEnds;
    private final List<Schedule.Event> schedule;
    private SessionMath.Session session;
    private long revision;
    private String ended;

    private RunModel(JSONObject payload, JSONArray phases, long[] phaseEnds, List<Schedule.Event> schedule,
                     SessionMath.Session session, long revision) {
        this.payload = payload;
        this.phases = phases;
        this.phaseEnds = phaseEnds;
        this.schedule = schedule;
        this.session = session;
        this.revision = revision;
    }

    static RunModel fromPayload(JSONObject payload, long revision) throws JSONException {
        JSONArray phases = payload.getJSONArray("phases");
        if (phases.length() == 0) throw new JSONException("No phases");
        long[] ends = new long[phases.length()];
        for (int i = 0; i < ends.length; i++) ends[i] = phases.getJSONObject(i).getLong("endMs");
        return new RunModel(payload, phases, ends, Schedule.parse(payload.optJSONArray("schedule")),
            SessionMath.Session.fromJson(payload.getJSONObject("session")), revision);
    }

    long runId() { return session.startedAt; }
    long revision() { return revision; }
    String ended() { return ended; }
    SessionMath.Session session() { return session; }
    long totalMs() { return phaseEnds[phaseEnds.length - 1]; }
    List<Schedule.Event> schedule() { return schedule; }
    JSONObject payload() { return payload; }

    long elapsedMs(long now) {
        return SessionMath.elapsedMs(session, totalMs(), now);
    }

    boolean finishedAt(long now) {
        return elapsedMs(now) >= totalMs();
    }

    /**
     * A watch command: { runId, action, basedOn }. Ignored unless it is for
     * this run, still running, and based on the current revision (so a
     * double-tapped skip only skips once).
     */
    boolean applyCommand(JSONObject command, long now, long newRevision) {
        if (command == null || ended != null) return false;
        if (command.optLong("runId", -1) != runId() || command.optLong("basedOn", -1) != revision) return false;
        String action = command.optString("action");
        switch (action) {
            case "pause": session = SessionMath.pause(session, now); break;
            case "resume": session = SessionMath.resume(session, now); break;
            case "skip": session = SessionMath.skip(session, phaseEnds, now); break;
            case "stop": ended = "stopped"; break;
            default: return false;
        }
        revision = newRevision;
        return true;
    }

    void end(String reason, long newRevision) {
        ended = reason;
        revision = newRevision;
    }

    /** What the page, the saved state and the watch get. */
    JSONObject toState() {
        JSONObject watch = payload.optJSONObject("watch");
        try {
            return new JSONObject()
                .put("runId", runId())
                .put("revision", revision)
                .put("ended", ended == null ? JSONObject.NULL : ended)
                .put("session", session.toJson())
                .put("phases", phases)
                .put("watch", watch == null ? new JSONObject() : watch);
        } catch (JSONException e) {
            throw new IllegalStateException(e); // our own values: cannot happen
        }
    }
}
```

If the compiler still reports an unreported `JSONException` somewhere, handle it the same way (declare it on parsing methods, wrap in builders).

- [ ] **Step 7: Run the tests**

Run: `npm run android:test`
Expected: `BUILD SUCCESSFUL`, all tests in `SessionMathTest`, `ScheduleTest`, `RunModelTest` pass.

- [ ] **Step 8: Commit**

```bash
git add android/app package.json scripts/android-test.mjs
git commit -m "feat: add the phone's session arithmetic and run model"
```

---

### Task 6: The service owns the run: commands, persistence, plugin events, watch publishing

**Files:**
- Modify: `android/app/src/main/java/io/github/willenjs/pulserun/coach/CoachService.java` (rewrite)
- Modify: `CoachPlugin.java`, `CommandListenerService.java`
- Create: `WatchLink.java`

**Interfaces:**
- Consumes: `RunModel`, `Schedule`, `SessionMath` (Task 5); `CuePlayer`, `ToneBank` (existing).
- Produces (for `CommandListenerService` and `CoachPlugin`): `CoachService.start(Context, String payload)`, `CoachService.stop(Context)`, `CoachService.command(Context, String json)`, `static JSONObject CoachService.savedState(Context)`, `interface CoachService.StateListener { void onState(JSONObject state); }`, `static volatile StateListener CoachService.listener`.
- Produces: `WatchLink.publish(Context, JSONObject state)`.
- Implements the JS contract from Task 4: `start(payload)`, `stop({reason})`, `current() → { state }`, event `stateChanged`.

- [ ] **Step 1: `WatchLink`**

Create `WatchLink.java`:

```java
package io.github.willenjs.pulserun.coach;

import android.content.Context;
import android.util.Log;
import com.google.android.gms.wearable.PutDataMapRequest;
import com.google.android.gms.wearable.Wearable;
import org.json.JSONObject;

/** Publishes the run state to the PulseRun watch app (DataItem /pulserun/run). */
final class WatchLink {
    static final String RUN_PATH = "/pulserun/run";

    private WatchLink() {}

    static void publish(Context context, JSONObject state) {
        try {
            PutDataMapRequest request = PutDataMapRequest.create(RUN_PATH);
            request.getDataMap().putString("state", state.toString());
            // Changes on every publish, so the watch hears even an unchanged state (its command acknowledgement).
            request.getDataMap().putLong("publishedAt", System.currentTimeMillis());
            Wearable.getDataClient(context).putDataItem(request.asPutDataRequest().setUrgent())
                .addOnFailureListener(e -> Log.w("PulseRun", "Watch publish failed", e));
        } catch (RuntimeException e) {
            // No Play services or no Wear API: the phone works without a watch.
            Log.w("PulseRun", "Watch publish failed", e);
        }
    }
}
```

- [ ] **Step 2: Rewrite `CoachService`**

Replace `CoachService.java` with:

```java
package io.github.willenjs.pulserun.coach;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import io.github.willenjs.pulserun.R;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Owns the workout run while it is active: holds the session the page sent,
 * plays the part of the cue schedule still ahead in the foreground (so cues
 * stay on time with the screen locked), applies pause / resume / skip / stop
 * from the watch, and reports every change to the page, the saved state and
 * the watch. A partial wake lock keeps the CPU (and the uptime clock the
 * handler uses) running while cues are pending.
 */
public class CoachService extends Service {
    private static final String ACTION_START = "io.github.willenjs.pulserun.coach.START";
    private static final String ACTION_STOP = "io.github.willenjs.pulserun.coach.STOP";
    private static final String ACTION_COMMAND = "io.github.willenjs.pulserun.coach.COMMAND";
    private static final String EXTRA_PAYLOAD = "payload";
    private static final String CHANNEL_ID = "workout";
    private static final int NOTIFICATION_ID = 1;
    private static final String PREFS = "coach";
    private static final String PREF_STATE = "state";
    private static final String PREF_REVISION = "revision";
    // Keeps the service up after the finish, so the fanfare and finish line play out.
    private static final long FINISH_GRACE_MS = 15_000;
    // RESUME_MAX_AGE_MS in src/core/timer.js: a paused run older than this is abandoned.
    private static final long RESUME_MAX_AGE_MS = 2 * 60 * 60 * 1000L;

    /** Called on the coach thread with each new state; set by CoachPlugin. */
    interface StateListener {
        void onState(JSONObject state);
    }

    static volatile StateListener listener;

    private final Object eventsToken = new Object();
    private HandlerThread thread;
    private Handler handler;
    private CuePlayer player;
    private PowerManager.WakeLock wakeLock;
    private RunModel run;

    static void start(Context context, String payload) {
        Intent intent = new Intent(context, CoachService.class).setAction(ACTION_START).putExtra(EXTRA_PAYLOAD, payload);
        ContextCompat.startForegroundService(context, intent);
    }

    /**
     * Delivered through onStartCommand, in order with starts: stopService could
     * destroy a just-requested foreground start before it calls startForeground,
     * which crashes the app.
     */
    static void stop(Context context) {
        context.startService(new Intent(context, CoachService.class).setAction(ACTION_STOP));
    }

    /** A watch command. Only reaches a running service (it is in the foreground, so this is allowed). */
    static void command(Context context, String json) {
        context.startService(new Intent(context, CoachService.class).setAction(ACTION_COMMAND).putExtra(EXTRA_PAYLOAD, json));
    }

    /** The last state saved by the service, or null. */
    static JSONObject savedState(Context context) {
        String saved = context.getSharedPreferences(PREFS, MODE_PRIVATE).getString(PREF_STATE, null);
        if (saved == null) return null;
        try {
            return new JSONObject(saved);
        } catch (JSONException e) {
            return null;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        thread = new HandlerThread("coach");
        thread.start();
        handler = new Handler(thread.getLooper());
        PowerManager power = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PulseRun:workout");
        wakeLock.setReferenceCounted(false);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        JSONObject data = parse(intent);
        if (ACTION_START.equals(action)) {
            // Must reach the foreground promptly after startForegroundService, even on bad input.
            startInForeground(data == null ? null : data.optJSONObject("notification"), false);
            if (data == null) {
                stopSelfResult(startId);
                return START_NOT_STICKY;
            }
            handler.post(() -> onPayload(data, startId));
        } else if (ACTION_STOP.equals(action)) {
            handler.post(() -> onStop(startId));
        } else if (ACTION_COMMAND.equals(action)) {
            handler.post(() -> onCommand(data, startId));
        } else {
            stopSelfResult(startId);
        }
        return START_NOT_STICKY;
    }

    private static JSONObject parse(Intent intent) {
        try {
            return intent == null ? null : new JSONObject(intent.getStringExtra(EXTRA_PAYLOAD));
        } catch (JSONException | NullPointerException e) {
            return null;
        }
    }

    // ---- Changes (all on the coach thread) ----

    private void onPayload(JSONObject payload, int startId) {
        try {
            run = RunModel.fromPayload(payload, nextRevision());
        } catch (JSONException e) {
            if (run == null) stopSelfResult(startId);
            return;
        }
        broadcast();
        reschedule(payload.optJSONObject("announce"), startId);
    }

    private void onStop(int startId) {
        if (run != null && run.ended() == null) {
            run.end("stopped", nextRevision());
            broadcast();
        }
        clearEvents();
        // Only stops if no newer start has been requested since.
        if (stopSelfResult(startId) && wakeLock.isHeld()) wakeLock.release();
    }

    private void onCommand(JSONObject command, int startId) {
        if (run == null) {
            stopSelfResult(startId);
            return;
        }
        long revision = run.revision();
        if (run.applyCommand(command, System.currentTimeMillis(), revision + 1)) {
            saveRevision(run.revision());
            broadcast();
            reschedule(null, startId);
        } else {
            // Still answer, so the watch knows the phone heard it and shows the current state.
            WatchLink.publish(this, run.toState());
            if (run.ended() != null) stopLater(startId, 0);
        }
    }

    private void onFinish(int startId) {
        if (run == null || run.ended() != null) return;
        run.end("finished", nextRevision());
        broadcast();
        // The fanfare and the finish line are still playing: do not clear events here.
        stopLater(startId, FINISH_GRACE_MS);
    }

    /** Saves the state and tells the page, the watch and the notification. */
    private void broadcast() {
        JSONObject state = run.toState();
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(PREF_STATE, state.toString()).apply();
        StateListener current = listener;
        if (current != null) current.onState(state);
        WatchLink.publish(this, state);
        if (run.ended() == null) startInForeground(run.payload().optJSONObject("notification"), run.session().paused());
    }

    // ---- Scheduling ----

    private void clearEvents() {
        handler.removeCallbacksAndMessages(eventsToken);
        if (player != null) player.stopAll();
    }

    /** Replaces whatever was scheduled with the part of the schedule still ahead. */
    private void reschedule(JSONObject announce, int startId) {
        clearEvents();
        if (run.ended() != null) {
            stopLater(startId, 0);
            return;
        }
        ensurePlayer();
        long now = System.currentTimeMillis();
        long uptime = SystemClock.uptimeMillis();
        if (run.session().paused()) {
            if (wakeLock.isHeld()) wakeLock.release();
            long abandonIn = Math.max(0, run.session().startedAt + RESUME_MAX_AGE_MS - now);
            handler.postAtTime(() -> stopSelfResult(startId), eventsToken, uptime + abandonIn);
            return;
        }
        long elapsed = run.elapsedMs(now);
        // Uptime at which the workout (elapsed 0) started.
        long base = uptime - elapsed;
        List<Schedule.Event> events = Schedule.ahead(run.schedule(), elapsed);

        // Speech waits for the tone at the same moment: tone first, then voice.
        Map<Long, Long> toneLength = new HashMap<>();
        for (Schedule.Event e : events) {
            if (!e.isTone() || !ToneBank.has(e.tone)) continue;
            toneLength.put(e.atMs, Math.max(lengthAt(toneLength, e.atMs), ToneBank.durationMs(e.tone)));
        }
        if (announce != null && !announce.optString("text").isEmpty()) {
            String text = announce.optString("text");
            int volume = announce.optInt("volume");
            handler.postAtTime(() -> player.speak(text, volume, () -> {}), eventsToken, uptime);
        }
        for (Schedule.Event e : events) {
            if (e.isTone()) {
                if (!ToneBank.has(e.tone)) continue;
                handler.postAtTime(() -> player.playTone(e.tone, e.volume), eventsToken, base + e.atMs);
            } else {
                long speakAt = e.atMs + lengthAt(toneLength, e.atMs);
                handler.postAtTime(() -> player.speak(e.text, e.volume, () -> {}), eventsToken, base + speakAt);
            }
        }
        handler.postAtTime(() -> onFinish(startId), eventsToken, base + run.totalMs());
        wakeLock.acquire(Math.max(0, run.totalMs() - elapsed + FINISH_GRACE_MS));
    }

    private void ensurePlayer() {
        java.util.List<String> locales = CuePlayer.strings(run.payload().optJSONArray("locales"));
        if (player == null) player = new CuePlayer(this, handler, locales);
        else player.setLocales(locales);
    }

    private void stopLater(int startId, long delayMs) {
        handler.postAtTime(() -> {
            if (stopSelfResult(startId) && wakeLock.isHeld()) wakeLock.release();
        }, eventsToken, SystemClock.uptimeMillis() + delayMs);
    }

    private static long lengthAt(Map<Long, Long> toneLength, long atMs) {
        Long length = toneLength.get(atMs);
        return length == null ? 0 : length;
    }

    // ---- Revision ----

    private long nextRevision() {
        long next = getSharedPreferences(PREFS, MODE_PRIVATE).getLong(PREF_REVISION, 0) + 1;
        saveRevision(next);
        return next;
    }

    private void saveRevision(long revision) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putLong(PREF_REVISION, revision).apply();
    }

    // ---- Notification ----

    private void startInForeground(JSONObject notification, boolean paused) {
        JSONObject text = notification == null ? new JSONObject() : notification;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(new NotificationChannel(
                CHANNEL_ID, text.optString("channel", "PulseRun"), NotificationManager.IMPORTANCE_LOW));
        }
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent content = open == null ? null : PendingIntent.getActivity(
            this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification built = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(text.optString("title", "PulseRun"))
            .setContentText(paused ? text.optString("pausedText", "") : text.optString("text", ""))
            .setContentIntent(content)
            .setOngoing(true)
            .setSilent(true)
            .build();
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, built, type);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        handler.post(() -> {
            if (player != null) player.shutdown();
            player = null;
        });
        thread.quitSafely();
        if (wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
```

Notes for the implementer:
- `onCommand` saves `revision + 1` itself (via `saveRevision`) because `applyCommand` takes the new revision as an argument; `nextRevision()` is used everywhere else.
- `startInForeground` is called from the coach thread in `broadcast()`; `startForeground` may be called from any thread.
- If `JSONObject` methods here need `JSONException` handling, catch and ignore (payloads come from our own JS).

- [ ] **Step 3: Plugin — `stop` reason, `current`, `stateChanged`**

In `CoachPlugin.java` add imports `org.json.JSONException` if needed, and:

```java
    @Override
    public void load() {
        // The service reports every change it makes (watch commands, the finish) to the page.
        CoachService.listener = state -> {
            try {
                notifyListeners("stateChanged", JSObject.fromJSONObject(state));
            } catch (JSONException ignored) {
                // Our own JSON; cannot happen.
            }
        };
    }

    /** The last state the service saved, so the page can catch up after sleeping. */
    @PluginMethod
    public void current(PluginCall call) {
        JSONObject saved = CoachService.savedState(getContext());
        JSObject result = new JSObject();
        try {
            result.put("state", saved == null ? JSONObject.NULL : JSObject.fromJSONObject(saved));
        } catch (JSONException e) {
            result.put("state", JSONObject.NULL);
        }
        call.resolve(result);
    }
```

In `handleOnDestroy()` add `CoachService.listener = null;` before `super.handleOnDestroy()`. `stop()` keeps calling `CoachService.stop(getContext())` (the `reason` from JS is always "stopped" and not needed). Update the `start` Javadoc to "Starts or updates the run in the foreground service."

- [ ] **Step 4: Forward watch commands**

In `CommandListenerService.onMessageReceived`, add after the ping branch:

```java
        } else if (COMMAND_PATH.equals(event.getPath())) {
            try {
                CoachService.command(this, new String(event.getData(), java.nio.charset.StandardCharsets.UTF_8));
            } catch (RuntimeException ignored) {
                // No run in progress, so the service is not in the foreground and cannot be started
                // from here. The watch shows "Phone not reachable" when no state comes back.
            }
        }
```

(turn the existing `if` into an `if … else if` chain).

- [ ] **Step 5: Build and run all tests**

Run: `npm test`, `npm run build`, `npm run android:test`, `npm run android:build`
Expected: all pass; APK built.

- [ ] **Step 6: Commit**

```bash
git add android/app
git commit -m "feat: let the coach service own the run and follow watch commands"
```

- [ ] **Step 7: Phone gate (controller + user)**

Install the APK (`npm run android:install`). With no watch app involved, re-run README "Manual phone test (Android app)" steps 1–4, plus: pause keeps the notification (text "Treino pausado" / "Workout paused") and no cue plays while paused; resume continues; finish plays fanfare and "Workout complete!" in full; after a stop the notification disappears.

---

### Task 7: Watch run state, clock and haptic plan (pure Kotlin)

**Files:**
- Create: `android/wear/src/main/java/io/github/willenjs/pulserun/wear/RunState.kt`, `Haptics.kt`
- Create: `android/wear/src/test/java/io/github/willenjs/pulserun/wear/RunStateTest.kt`, `HapticsTest.kt`

**Interfaces:**
- Produces (`RunState.kt`):
  ```kotlin
  data class Phase(val type: String, val startMs: Long, val endMs: Long)
  data class Session(val workoutId: String, val startedAt: Long, val pausedAt: Long?, val pausedTotalMs: Long, val skippedMs: Long)
  data class RunState(val runId: Long, val revision: Long, val ended: String?, val session: Session,
                      val phases: List<Phase>, val title: String, val labels: Map<String, String>) {
      val totalMs: Long
      fun label(name: String): String            // "" when missing
      fun elapsedMs(now: Long): Long
      fun view(now: Long): RunView
      companion object { fun parse(json: String): RunState? }
  }
  data class RunView(val phaseIndex: Int, val phase: Phase, val next: Phase?, val elapsedMs: Long,
                     val phaseRemainingMs: Long, val phaseProgress: Float, val totalRemainingMs: Long,
                     val paused: Boolean, val finished: Boolean)
  fun formatClock(ms: Long): String
  fun fillNext(template: String, phase: String, time: String): String
  ```
- Produces (`Haptics.kt`):
  ```kotlin
  enum class HapticKind { WALK, JOG, RUN, FINISH }
  data class Haptic(val key: String, val atMs: Long, val kind: HapticKind) // key = "runId:index", atMs epoch
  const val HAPTIC_GRACE_MS = 2_000L
  fun hapticPlan(state: RunState, now: Long): List<Haptic>
  fun kindOf(type: String): HapticKind
  ```

- [ ] **Step 1: Write the failing tests**

Create `android/wear/src/test/java/io/github/willenjs/pulserun/wear/RunStateTest.kt`:

```kotlin
package io.github.willenjs.pulserun.wear

import java.io.File
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RunStateTest {
    // Unit tests run with the module directory (android/wear) as working directory.
    private val fixtures = JSONObject(File("../../tests/fixtures/session-math.json").readText())
    private val phasesJson: JSONArray = fixtures.getJSONArray("phases")

    private fun stateJson(session: JSONObject, ended: Any = JSONObject.NULL) = JSONObject()
        .put("runId", session.getLong("startedAt"))
        .put("revision", 3)
        .put("ended", ended)
        .put("session", JSONObject(session.toString()).put("workoutId", "w1d1"))
        .put("phases", phasesJson)
        .put("watch", JSONObject().put("title", "Week 1 • Day 1").put("labels", JSONObject().put("walk", "Walk")))
        .toString()

    @Test
    fun elapsedMatchesFixtures() {
        val cases = fixtures.getJSONArray("elapsed")
        for (i in 0 until cases.length()) {
            val c = cases.getJSONObject(i)
            val state = RunState.parse(stateJson(c.getJSONObject("session")))!!
            assertEquals(c.getString("name"), c.getLong("elapsedMs"), state.elapsedMs(c.getLong("now")))
        }
    }

    @Test
    fun clockMatchesFixtures() {
        val cases = fixtures.getJSONArray("clock")
        for (i in 0 until cases.length()) {
            val c = cases.getJSONObject(i)
            assertEquals(c.getString("text"), formatClock(c.getLong("ms")))
        }
    }

    @Test
    fun parsesTheState() {
        val session = fixtures.getJSONArray("elapsed").getJSONObject(0).getJSONObject("session")
        val state = RunState.parse(stateJson(session))!!
        assertEquals(1_000_000L, state.runId)
        assertEquals(3L, state.revision)
        assertNull(state.ended)
        assertEquals(5, state.phases.size)
        assertEquals(1_260_000L, state.totalMs)
        assertEquals("Week 1 • Day 1", state.title)
        assertEquals("Walk", state.label("walk"))
        assertEquals("", state.label("missing"))
        assertEquals("finished", RunState.parse(stateJson(session, "finished"))!!.ended)
    }

    @Test
    fun rejectsBadJson() {
        assertNull(RunState.parse("nope"))
        assertNull(RunState.parse("{}"))
        assertNull(RunState.parse(JSONObject().put("runId", 1).put("revision", 1).put("session", JSONObject()).put("phases", JSONArray()).toString()))
    }

    @Test
    fun viewsMidPhase() {
        val session = fixtures.getJSONArray("elapsed").getJSONObject(1).getJSONObject("session") // running
        val view = RunState.parse(stateJson(session))!!.view(1_000_000L + 400_000L)
        assertEquals(1, view.phaseIndex)
        assertEquals("jog", view.phase.type)
        assertEquals("walk", view.next!!.type)
        assertEquals(80_000L, view.phaseRemainingMs)
        assertEquals(1f / 3f, view.phaseProgress, 0.001f)
        assertEquals(860_000L, view.totalRemainingMs)
        assertFalse(view.paused)
        assertFalse(view.finished)
    }

    @Test
    fun viewsTheEnd() {
        val session = fixtures.getJSONArray("elapsed").getJSONObject(1).getJSONObject("session")
        val view = RunState.parse(stateJson(session))!!.view(1_000_000L + 2_000_000L)
        assertTrue(view.finished)
        assertEquals(4, view.phaseIndex)
        assertNull(view.next)
        assertEquals(0L, view.phaseRemainingMs)
    }

    @Test
    fun fillsTheNextTemplate() {
        assertEquals("Next: Walk 01:30", fillNext("Next: {phase} {time}", "Walk", "01:30"))
    }
}
```

Create `HapticsTest.kt`:

```kotlin
package io.github.willenjs.pulserun.wear

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HapticsTest {
    private val phases = listOf(
        Phase("walk", 0, 360_000), Phase("jog", 360_000, 480_000), Phase("run", 480_000, 540_000),
    )
    private fun state(pausedAt: Long? = null, skippedMs: Long = 0, ended: String? = null) =
        RunState(1_000_000, 1, ended, Session("w1d1", 1_000_000, pausedAt, 0, skippedMs), phases, "W1D1", emptyMap())

    @Test
    fun plansEveryPhaseStartAheadAndTheFinish() {
        val plan = hapticPlan(state(), 1_000_000L + 100_000L)
        assertEquals(listOf(HapticKind.JOG, HapticKind.RUN, HapticKind.FINISH), plan.map { it.kind })
        assertEquals(listOf(1_360_000L, 1_480_000L, 1_540_000L), plan.map { it.atMs })
        assertEquals(listOf("1000000:1", "1000000:2", "1000000:3"), plan.map { it.key })
    }

    @Test
    fun includesAPhaseThatStartedWithinTheGrace() {
        // Received 1.5 s after a start or a skip: that phase still buzzes (now).
        val plan = hapticPlan(state(), 1_000_000L + 1_500L)
        assertEquals("1000000:0", plan.first().key)
        assertEquals(HapticKind.WALK, plan.first().kind)
    }

    @Test
    fun skipsPhasesStartedLongAgo() {
        val plan = hapticPlan(state(), 1_000_000L + 5_000L)
        assertEquals("1000000:1", plan.first().key)
    }

    @Test
    fun plansNothingWhilePausedOrEnded() {
        assertTrue(hapticPlan(state(pausedAt = 1_010_000), 1_020_000).isEmpty())
        assertTrue(hapticPlan(state(ended = "stopped"), 1_020_000).isEmpty())
        assertTrue(hapticPlan(state(ended = "finished"), 1_020_000).isEmpty())
    }

    @Test
    fun mapsPhaseTypes() {
        assertEquals(HapticKind.WALK, kindOf("walk"))
        assertEquals(HapticKind.JOG, kindOf("jog"))
        assertEquals(HapticKind.RUN, kindOf("run"))
    }
}
```

- [ ] **Step 2: Run to see them fail**

Run: `npm run android:test`
Expected: FAIL — unresolved references (`RunState`, `hapticPlan`, …).

- [ ] **Step 3: Implement `RunState.kt`**

```kotlin
package io.github.willenjs.pulserun.wear

import org.json.JSONObject
import kotlin.math.ceil

data class Phase(val type: String, val startMs: Long, val endMs: Long)

data class Session(
    val workoutId: String,
    val startedAt: Long,
    val pausedAt: Long?,
    val pausedTotalMs: Long,
    val skippedMs: Long,
)

data class RunView(
    val phaseIndex: Int,
    val phase: Phase,
    val next: Phase?,
    val elapsedMs: Long,
    val phaseRemainingMs: Long,
    val phaseProgress: Float,
    val totalRemainingMs: Long,
    val paused: Boolean,
    val finished: Boolean,
)

/**
 * A run as the phone reports it (DataItem /pulserun/run). Everything shown is
 * derived from the session timestamps and this watch's clock, as in
 * src/core/timer.js; tests/fixtures/session-math.json pins the arithmetic.
 */
data class RunState(
    val runId: Long,
    val revision: Long,
    val ended: String?,
    val session: Session,
    val phases: List<Phase>,
    val title: String,
    val labels: Map<String, String>,
) {
    val totalMs: Long get() = phases.last().endMs

    fun label(name: String): String = labels[name] ?: ""

    fun elapsedMs(now: Long): Long {
        val at = session.pausedAt ?: now
        val raw = at - session.startedAt - session.pausedTotalMs + session.skippedMs
        return raw.coerceIn(0, totalMs)
    }

    fun view(now: Long): RunView {
        val elapsed = elapsedMs(now)
        val finished = elapsed >= totalMs
        val index = if (finished) phases.lastIndex else phases.indexOfFirst { elapsed < it.endMs }
        val phase = phases[index]
        val length = (phase.endMs - phase.startMs).coerceAtLeast(1)
        return RunView(
            phaseIndex = index,
            phase = phase,
            next = phases.getOrNull(index + 1),
            elapsedMs = elapsed,
            phaseRemainingMs = if (finished) 0 else phase.endMs - elapsed,
            phaseProgress = ((elapsed - phase.startMs).toFloat() / length).coerceIn(0f, 1f),
            totalRemainingMs = totalMs - elapsed,
            paused = session.pausedAt != null,
            finished = finished,
        )
    }

    companion object {
        fun parse(json: String): RunState? = try {
            val o = JSONObject(json)
            val s = o.getJSONObject("session")
            val phasesJson = o.getJSONArray("phases")
            val phases = (0 until phasesJson.length()).map { i ->
                val p = phasesJson.getJSONObject(i)
                Phase(p.getString("type"), p.getLong("startMs"), p.getLong("endMs"))
            }
            if (phases.isEmpty()) {
                null
            } else {
                val watch = o.optJSONObject("watch") ?: JSONObject()
                val labelsJson = watch.optJSONObject("labels") ?: JSONObject()
                RunState(
                    runId = o.getLong("runId"),
                    revision = o.getLong("revision"),
                    ended = if (o.isNull("ended")) null else o.optString("ended"),
                    session = Session(
                        workoutId = s.optString("workoutId"),
                        startedAt = s.getLong("startedAt"),
                        pausedAt = if (s.isNull("pausedAt")) null else s.getLong("pausedAt"),
                        pausedTotalMs = s.optLong("pausedTotalMs"),
                        skippedMs = s.optLong("skippedMs"),
                    ),
                    phases = phases,
                    title = watch.optString("title"),
                    labels = labelsJson.keys().asSequence().associateWith { labelsJson.getString(it) },
                )
            }
        } catch (e: Exception) {
            null
        }
    }
}

/** formatClock in src/core/timer.js: rounds up, so a phase shows "06:00" at its start. */
fun formatClock(ms: Long): String {
    val totalSec = ceil(ms.coerceAtLeast(0) / 1000.0).toLong()
    return "%02d:%02d".format(totalSec / 60, totalSec % 60)
}

/** Fills the phone's `run.next` text, e.g. "Next: {phase} {time}". */
fun fillNext(template: String, phase: String, time: String): String =
    template.replace("{phase}", phase).replace("{time}", time)
```

- [ ] **Step 4: Implement `Haptics.kt`** (pure part only; vibration is added in Task 8)

```kotlin
package io.github.willenjs.pulserun.wear

enum class HapticKind { WALK, JOG, RUN, FINISH }

/** A buzz due at [atMs] (epoch). [key] identifies it within the run, so it never buzzes twice. */
data class Haptic(val key: String, val atMs: Long, val kind: HapticKind)

/**
 * A phase that started at most this long ago still buzzes (now): states
 * reach the watch a moment after a start or a skip.
 */
const val HAPTIC_GRACE_MS = 2_000L

fun kindOf(type: String): HapticKind = when (type) {
    "walk" -> HapticKind.WALK
    "jog" -> HapticKind.JOG
    else -> HapticKind.RUN
}

/** Every phase start still ahead, then the finish. Nothing while paused or ended. */
fun hapticPlan(state: RunState, now: Long): List<Haptic> {
    if (state.ended != null || state.session.pausedAt != null) return emptyList()
    val elapsed = state.elapsedMs(now)
    val workoutStart = now - elapsed
    val plan = state.phases.mapIndexedNotNull { i, phase ->
        if (phase.startMs <= elapsed - HAPTIC_GRACE_MS) null
        else Haptic("${state.runId}:$i", workoutStart + phase.startMs, kindOf(phase.type))
    }
    val finish = Haptic("${state.runId}:${state.phases.size}", workoutStart + state.totalMs, HapticKind.FINISH)
    return if (elapsed >= state.totalMs) emptyList() else plan + finish
}
```

Check against the test `plansEveryPhaseStartAheadAndTheFinish`: elapsed 100 000 → phase 0 (start 0 ≤ 98 000) dropped; jog at 1 360 000, run at 1 480 000, finish at 1 540 000. ✓.

- [ ] **Step 5: Run the tests**

Run: `npm run android:test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add android/wear/src
git commit -m "feat: derive the watch's run view and haptic plan from the session"
```

---

### Task 8: Watch services: receive runs, buzz, Ongoing Activity, send commands

**Files:**
- Create: `android/wear/src/main/java/io/github/willenjs/pulserun/wear/RunRepository.kt`, `WorkoutService.kt`, `StartPrompt.kt`
- Modify: `Haptics.kt` (add `vibrate`), `RunListenerService.kt`, `MainActivity.kt`, `android/wear/src/main/AndroidManifest.xml`

**Interfaces:**
- Consumes: `RunState`, `hapticPlan`, `HapticKind` (Task 7); `PhoneLink` (Task 1).
- Produces:
  ```kotlin
  object RunRepository {
      val state: StateFlow<RunState?>
      val unreachable: StateFlow<Boolean>
      fun update(next: RunState)                 // from the Data Layer
      fun send(context: Context, action: String) // "pause" | "resume" | "skip" | "stop"
      fun load(context: Context)                 // seed from the last DataItem
  }
  class WorkoutService { companion object { fun ensureRunning(context: Context) } }
  fun vibrate(context: Context, kind: HapticKind)
  ```

- [ ] **Step 1: `RunRepository.kt`**

```kotlin
package io.github.willenjs.pulserun.wear

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.core.os.HandlerCompat
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONObject

/** The latest run from the phone, and whether the phone answers our commands. */
object RunRepository {
    const val RUN_PATH = "/pulserun/run"
    // A command counts as heard when any state arrives within this time.
    private const val ACK_TIMEOUT_MS = 3_000L
    private const val UNREACHABLE_SHOWN_MS = 4_000L

    private val main = Handler(Looper.getMainLooper())
    private val ackToken = Any()
    private val hideToken = Any()
    private val current = MutableStateFlow<RunState?>(null)
    private val notHeard = MutableStateFlow(false)

    val state: StateFlow<RunState?> = current
    val unreachable: StateFlow<Boolean> = notHeard

    @Synchronized
    fun update(next: RunState) {
        // Any state from the phone answers a pending command.
        main.removeCallbacksAndMessages(ackToken)
        notHeard.value = false
        val old = current.value
        if (old == null || next.runId > old.runId || (next.runId == old.runId && next.revision >= old.revision)) {
            current.value = next
        }
    }

    fun send(context: Context, action: String) {
        val s = current.value ?: return
        val command = JSONObject().put("runId", s.runId).put("action", action).put("basedOn", s.revision)
        PhoneLink.sendCommand(context, command.toString()) { ok -> if (!ok) main.post { showUnreachable() } }
        HandlerCompat.postDelayed(main, { showUnreachable() }, ackToken, ACK_TIMEOUT_MS)
    }

    /** The phone's last published run, for a fresh process (the Data Layer keeps it). */
    fun load(context: Context) {
        val uri = Uri.Builder().scheme("wear").path(RUN_PATH).build()
        Wearable.getDataClient(context.applicationContext).getDataItems(uri).addOnSuccessListener { items ->
            items.forEach { item ->
                DataMapItem.fromDataItem(item).dataMap.getString("state")?.let(RunState::parse)?.let(::update)
            }
            items.release()
        }
    }

    private fun showUnreachable() {
        main.removeCallbacksAndMessages(ackToken)
        notHeard.value = true
        main.removeCallbacksAndMessages(hideToken)
        HandlerCompat.postDelayed(main, { notHeard.value = false }, hideToken, UNREACHABLE_SHOWN_MS)
    }
}
```

Note: `update()` from `load()` must not clear a pending ack incorrectly; acceptable (load runs only at activity start).

- [ ] **Step 2: Vibration in `Haptics.kt`**

Append:

```kotlin
import android.content.Context
import android.os.VibrationEffect
import android.os.VibratorManager

/** Walk one long pulse, Jog two short, Run three short, finish long–short–long. */
fun vibrate(context: Context, kind: HapticKind) {
    val timings = when (kind) {
        HapticKind.WALK -> longArrayOf(0, 500)
        HapticKind.JOG -> longArrayOf(0, 150, 120, 150)
        HapticKind.RUN -> longArrayOf(0, 120, 100, 120, 100, 120)
        HapticKind.FINISH -> longArrayOf(0, 500, 150, 150, 150, 500)
    }
    val vibrator = context.getSystemService(VibratorManager::class.java)?.defaultVibrator ?: return
    vibrator.vibrate(VibrationEffect.createWaveform(timings, -1))
}
```

(move the imports to the top of the file.)

- [ ] **Step 3: `StartPrompt.kt`** (fallback when the system refuses a background foreground-service start)

```kotlin
package io.github.willenjs.pulserun.wear

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat

/** "Workout started — tap to open", with a buzz, when the watch cannot start its service on its own. */
object StartPrompt {
    private const val CHANNEL_ID = "start"
    private const val NOTIFICATION_ID = 2

    fun show(context: Context, title: String) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "PulseRun", NotificationManager.IMPORTANCE_HIGH))
        val open = PendingIntent.getActivity(
            context, 0, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("PulseRun")
            .setContentText(title)
            .setContentIntent(open)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .build()
        manager.notify(NOTIFICATION_ID, notification)
    }

    fun hide(context: Context) {
        context.getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
    }
}
```

- [ ] **Step 4: `WorkoutService.kt`**

```kotlin
package io.github.willenjs.pulserun.wear

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.os.HandlerCompat
import androidx.wear.ongoing.OngoingActivity
import androidx.wear.ongoing.Status
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Runs while a workout is active on the phone: keeps the Ongoing Activity on
 * the watch face and buzzes at every phase change, screen on or off.
 */
class WorkoutService : Service() {
    companion object {
        private const val CHANNEL_ID = "workout"
        private const val NOTIFICATION_ID = 1
        // How long the finish screen and chip stay after the run ends.
        private const val STOP_AFTER_END_MS = 10_000L

        fun ensureRunning(context: Context) {
            try {
                ContextCompat.startForegroundService(context, Intent(context, WorkoutService::class.java))
            } catch (e: IllegalStateException) {
                // Android 12+ may refuse a foreground start from the background: ask for a tap instead.
                Log.w("PulseRun", "Could not start the workout service", e)
                StartPrompt.show(context, RunRepository.state.value?.title ?: "")
            }
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val handler = Handler(Looper.getMainLooper())
    private val hapticsToken = Any()
    private val stopToken = Any()
    private val buzzed = mutableSetOf<String>()
    private var shownRunId = -1L
    private lateinit var wakeLock: PowerManager.WakeLock

    override fun onCreate() {
        super.onCreate()
        wakeLock = getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PulseRun:watch").apply { setReferenceCounted(false) }
        getSystemService(NotificationManager::class.java)
            .createNotificationChannel(NotificationChannel(CHANNEL_ID, "PulseRun", NotificationManager.IMPORTANCE_LOW))
        scope.launch { RunRepository.state.collect { state -> if (state != null) onState(state) } }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val state = RunRepository.state.value
        // Must reach the foreground promptly after startForegroundService.
        startForeground(NOTIFICATION_ID, notification(state).build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        StartPrompt.hide(this)
        if (state == null) stopSelf()
        return START_NOT_STICKY
    }

    private fun onState(state: RunState) {
        if (state.runId != shownRunId && state.ended == null) {
            shownRunId = state.runId
            bringToFront()
        }
        showOngoing(state)
        planHaptics(state)
        handler.removeCallbacksAndMessages(stopToken)
        if (state.ended != null) HandlerCompat.postDelayed(handler, { stopSelf() }, stopToken, STOP_AFTER_END_MS)
    }

    private fun planHaptics(state: RunState) {
        handler.removeCallbacksAndMessages(hapticsToken)
        if (state.ended == "finished") buzzOnce("${state.runId}:${state.phases.size}", HapticKind.FINISH)
        val now = System.currentTimeMillis()
        val plan = hapticPlan(state, now).filter { it.key !in buzzed }
        if (plan.isEmpty()) {
            if (wakeLock.isHeld) wakeLock.release()
            return
        }
        val uptime = SystemClock.uptimeMillis()
        plan.forEach { h ->
            handler.postAtTime({ buzzOnce(h.key, h.kind) }, hapticsToken, uptime + (h.atMs - now).coerceAtLeast(0))
        }
        wakeLock.acquire(plan.last().atMs - now + 5_000)
    }

    private fun buzzOnce(key: String, kind: HapticKind) {
        if (buzzed.add(key)) vibrate(this, kind)
    }

    private fun bringToFront() {
        try {
            startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: RuntimeException) {
            // Background activity starts may be blocked: the Ongoing Activity chip is the way in.
        }
    }

    private fun notification(state: RunState?): NotificationCompat.Builder {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(state?.title ?: "PulseRun")
            .setContentIntent(open)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setOngoing(true)
            .setSilent(true)
    }

    private fun showOngoing(state: RunState) {
        val builder = notification(state)
        val view = state.view(System.currentTimeMillis())
        val status = when {
            state.ended == "finished" -> Status.Builder().addTemplate(state.label("done")).build()
            state.ended != null -> Status.Builder().addTemplate(state.title).build()
            view.paused -> Status.Builder().addTemplate(state.label("paused")).build()
            else -> Status.Builder()
                .addTemplate("#type# #time#")
                .addPart("type", Status.TextPart(state.label(view.phase.type)))
                .addPart("time", Status.TimerPart(phaseEndTimeZero(view)))
                .build()
        }
        OngoingActivity.Builder(applicationContext, NOTIFICATION_ID, builder)
            .setStaticIcon(R.drawable.ic_notification)
            .setTouchIntent(PendingIntent.getActivity(
                this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            ))
            .setStatus(status)
            .build()
            .apply(applicationContext)
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, builder.build())
    }

    /**
     * The TimerPart counts down to this. VERIFY the time base before relying on
     * it: query Context7 (`/websites/developer_android`, "wear ongoing Status
     * TimerPart timeZeroMillis") — if it is SystemClock.elapsedRealtime(), keep
     * this; if it is wall-clock time, return System.currentTimeMillis() + remaining.
     */
    private fun phaseEndTimeZero(view: RunView): Long = SystemClock.elapsedRealtime() + view.phaseRemainingMs

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        scope.cancel()
        if (wakeLock.isHeld) wakeLock.release()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
```

- [ ] **Step 5: Manifest entry**

Add inside `<application>` of `android/wear/src/main/AndroidManifest.xml`:

```xml
        <service
            android:name=".WorkoutService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Mirrors a workout running on the paired phone: countdown and phase-change haptics." />
        </service>
```

- [ ] **Step 6: Listener and activity hookup**

`RunListenerService.kt` — add:

```kotlin
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem

    override fun onDataChanged(events: DataEventBuffer) {
        for (event in events) {
            if (event.type != DataEvent.TYPE_CHANGED || event.dataItem.uri.path != RunRepository.RUN_PATH) continue
            val json = DataMapItem.fromDataItem(event.dataItem).dataMap.getString("state") ?: continue
            val state = RunState.parse(json) ?: continue
            RunRepository.update(state)
            if (state.ended == null) WorkoutService.ensureRunning(this)
        }
    }
```

`MainActivity.kt` — keep the Task 1 screen but show the run as plain text so the service can be checked on the watch (Task 9 replaces the content). In `onCreate` before `setContent`:

```kotlin
        RunRepository.load(this)
        if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 0)
        }
```

In `onResume`, after `PhoneLink.ping(this)`:

```kotlin
        StartPrompt.hide(this)
        val state = RunRepository.state.value
        if (state != null && state.ended == null) WorkoutService.ensureRunning(this)
```

Replace the text in `setContent` with a temporary state line:

```kotlin
            val reachable by PhoneLink.phoneReachable.collectAsState()
            val current by RunRepository.state.collectAsState()
            var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
            LaunchedEffect(Unit) { while (true) { now = System.currentTimeMillis(); delay(250) } }
            val text = current?.let { s -> val v = s.view(now); "${s.label(v.phase.type)} ${formatClock(v.phaseRemainingMs)} r${s.revision} ${s.ended ?: ""}" }
                ?: if (reachable == true) "PulseRun ● phone" else "PulseRun ○"
            Box(Modifier.fillMaxSize().background(Color(0xFF0C0D12)), contentAlignment = Alignment.Center) {
                Text(text, color = Color(0xFF10F49C))
            }
```

(imports: `androidx.compose.runtime.*`, `kotlinx.coroutines.delay`.)

- [ ] **Step 7: Build and test**

Run: `npm run android:test` then `npm run wear:build`
Expected: PASS; watch APK built.

- [ ] **Step 8: Commit**

```bash
git add android/wear
git commit -m "feat: follow the phone's run on the watch with haptics and an ongoing activity"
```

- [ ] **Step 9: Device gate (controller + user)**

Install phone and watch APKs. Open the watch app once (grant notifications). Start Week 1 Day 1 on the phone. Expected: the watch app opens (or a "tap to open" prompt / chip appears — note which), the text shows `Caminhar 05:59 r…`, the chip shows on the watch face, the watch buzzes at the first phase change with the screen off (use "Pular fase" on the phone to get there fast: a skip buzzes the new phase within 2 s). Pause on the phone: the watch text stops. Record the TimerPart time base result from Step 4 if the chip countdown is wrong, and fix it.

---

### Task 9: Watch screens (Compose)

**Files:**
- Create: `android/wear/src/main/java/io/github/willenjs/pulserun/wear/ui/Theme.kt`, `ui/Rings.kt`, `ui/Screens.kt`
- Modify: `MainActivity.kt`

**Interfaces:**
- Consumes: `RunRepository.state`, `RunRepository.unreachable`, `RunRepository.send`, `PhoneLink.phoneReachable`, `RunState.view`, `formatClock`, `fillNext`.
- Produces: `@Composable fun PulseApp(ambient: Boolean, ambientTick: Long, onFinished: () -> Unit)`.

- [ ] **Step 1: `ui/Theme.kt`**

```kotlin
package io.github.willenjs.pulserun.wear.ui

import androidx.compose.ui.graphics.Color

/** Colours from src/app.css. */
object Pulse {
    val surface = Color(0xFF0C0D12)
    val surface2 = Color(0xFF1C1F2B)
    val track = Color(0xFF25293A)
    val muted = Color(0xFF8A91A8)
    val mint = Color(0xFF10F49C)
    val onMint = Color(0xFF002111)
    val walk = Color(0xFF00D2FF)
    val jog = Color(0xFFFFAB00)
    val run = Color(0xFFFF334B)

    fun pace(type: String): Color = when (type) {
        "walk" -> walk
        "jog" -> jog
        else -> run
    }
}
```

- [ ] **Step 2: `ui/Rings.kt`**

```kotlin
package io.github.willenjs.pulserun.wear.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import io.github.willenjs.pulserun.wear.Phase
import kotlin.math.cos
import kotlin.math.sin

private fun DrawScope.ring(color: Color, start: Float, sweep: Float, width: Float, cap: StrokeCap = StrokeCap.Butt) {
    val inset = width / 2 + 2.dp.toPx()
    drawArc(
        color = color, startAngle = start, sweepAngle = sweep, useCenter = false,
        topLeft = Offset(inset, inset), size = Size(size.width - 2 * inset, size.height - 2 * inset),
        style = Stroke(width, cap = cap),
    )
}

/** The current phase's progress, in its pace colour. */
@Composable
fun PhaseRing(progress: Float, color: Color, modifier: Modifier = Modifier) {
    Canvas(modifier.fillMaxSize()) {
        val width = 8.dp.toPx()
        ring(Pulse.track, -90f, 360f, width)
        if (progress > 0f) ring(color, -90f, 360f * progress, width, StrokeCap.Round)
    }
}

/** The whole workout as pace-coloured segments; finished ones dimmed; a dot where the runner is. */
@Composable
fun WorkoutRing(phases: List<Phase>, elapsedMs: Long, modifier: Modifier = Modifier) {
    Canvas(modifier.fillMaxSize()) {
        val width = 8.dp.toPx()
        val total = phases.last().endMs.toFloat()
        val gap = 1.5f
        ring(Pulse.track, -90f, 360f, width)
        phases.forEach { p ->
            val start = -90f + 360f * p.startMs / total
            val sweep = (360f * (p.endMs - p.startMs) / total - gap).coerceAtLeast(0.5f)
            val alpha = if (p.endMs <= elapsedMs) 0.3f else 1f
            ring(Pulse.pace(p.type).copy(alpha = alpha), start, sweep, width)
        }
        val inset = width / 2 + 2.dp.toPx()
        val radius = size.width / 2 - inset
        val angle = Math.toRadians((-90.0 + 360.0 * elapsedMs / total))
        drawCircle(
            Color.White, radius = 5.dp.toPx(),
            center = Offset(size.width / 2 + radius * cos(angle).toFloat(), size.height / 2 + radius * sin(angle).toFloat()),
        )
    }
}

/** Thin grey outline for the always-on display. */
@Composable
fun AmbientRing(progress: Float, modifier: Modifier = Modifier) {
    Canvas(modifier.fillMaxSize()) {
        ring(Color(0xFF555555), -90f, 360f * progress, 3.dp.toPx())
    }
}
```

- [ ] **Step 3: `ui/Screens.kt`**

```kotlin
package io.github.willenjs.pulserun.wear.ui

import android.content.Context
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.Text
import io.github.willenjs.pulserun.wear.PhoneLink
import io.github.willenjs.pulserun.wear.RunRepository
import io.github.willenjs.pulserun.wear.RunState
import io.github.willenjs.pulserun.wear.fillNext
import io.github.willenjs.pulserun.wear.formatClock
import kotlinx.coroutines.delay

private const val PREFS = "watch"
private const val PREF_OVERVIEW = "overview"
// How long the finish screen stays before the app closes itself.
private const val DONE_SHOWN_MS = 10_000L

@Composable
fun PulseApp(ambient: Boolean, ambientTick: Long, onFinished: () -> Unit) {
    val state by RunRepository.state.collectAsState()
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(ambient, ambientTick) {
        now = System.currentTimeMillis()
        // Interactive: refresh the countdown; ambient: the system wakes us (onUpdateAmbient → ambientTick).
        while (!ambient) {
            delay(250)
            now = System.currentTimeMillis()
        }
    }
    Box(Modifier.fillMaxSize().background(if (ambient) Color.Black else Pulse.surface)) {
        val s = state
        when {
            s == null || s.ended == "stopped" -> IdleScreen(s)
            s.ended == "finished" -> DoneScreen(s, onFinished)
            ambient -> AmbientScreen(s, now)
            else -> RunPager(s, now)
        }
    }
}

@Composable
private fun IdleScreen(state: RunState?) {
    val reachable by PhoneLink.phoneReachable.collectAsState()
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text("PulseRun", color = Pulse.mint, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Text(
            state?.label("idle")?.ifEmpty { null } ?: "Start a workout on your phone",
            color = Pulse.muted, fontSize = 12.sp, textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Box(Modifier.size(8.dp).clip(CircleShape).background(if (reachable == true) Pulse.mint else Pulse.track))
    }
}

@Composable
private fun DoneScreen(state: RunState, onFinished: () -> Unit) {
    LaunchedEffect(state.runId) {
        delay(DONE_SHOWN_MS)
        onFinished()
    }
    PhaseRing(1f, Pulse.mint)
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text("✓", color = Pulse.mint, fontSize = 28.sp)
        Text(state.label("done"), color = Pulse.mint, fontSize = 16.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        Text(state.title, color = Pulse.muted, fontSize = 11.sp)
    }
}

@Composable
private fun AmbientScreen(state: RunState, now: Long) {
    val view = state.view(now)
    AmbientRing(view.phaseProgress)
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            (if (view.paused) state.label("paused") else state.label(view.phase.type)).uppercase(),
            color = Color(0xFFBBBBBB), fontSize = 13.sp,
        )
        Text(formatClock(view.phaseRemainingMs), color = Color(0xFFBBBBBB), fontSize = 38.sp)
    }
}

@Composable
private fun RunPager(state: RunState, now: Long) {
    val context = LocalContext.current
    val pager = rememberPagerState { 2 }
    var confirmingStop by remember { mutableStateOf(false) }
    val unreachable by RunRepository.unreachable.collectAsState()
    if (confirmingStop) {
        StopConfirm(state, onKeep = { confirmingStop = false }, onStop = {
            confirmingStop = false
            RunRepository.send(context, "stop")
        })
        return
    }
    HorizontalPager(pager, Modifier.fillMaxSize()) { page ->
        if (page == 0) RunPage(state, now) else ControlsPage(state, onSkip = { RunRepository.send(context, "skip") }, onStop = { confirmingStop = true })
    }
    PageDots(pager.currentPage)
    if (unreachable) {
        Box(Modifier.fillMaxSize().padding(bottom = 26.dp), contentAlignment = Alignment.BottomCenter) {
            Text(state.label("unreachable"), color = Pulse.run, fontSize = 11.sp, textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun RunPage(state: RunState, now: Long) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences(PREFS, Context.MODE_PRIVATE) }
    var overviewChosen by remember { mutableStateOf(prefs.getBoolean(PREF_OVERVIEW, false)) }
    val view = state.view(now)
    val overview = view.paused || overviewChosen
    val pace = Pulse.pace(view.phase.type)
    Box(
        Modifier.fillMaxSize().pointerInput(Unit) {
            detectTapGestures(onDoubleTap = {
                overviewChosen = !overviewChosen
                prefs.edit().putBoolean(PREF_OVERVIEW, overviewChosen).apply()
            })
        },
    ) {
        if (overview) WorkoutRing(state.phases, view.elapsedMs) else PhaseRing(view.phaseProgress, pace)
        Column(Modifier.fillMaxSize().padding(top = 34.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                (if (view.paused) state.label("paused") else state.label(view.phase.type)).uppercase(),
                color = if (view.paused) Pulse.muted else pace, fontSize = 13.sp, fontWeight = FontWeight.Bold,
            )
            Text(
                formatClock(view.phaseRemainingMs),
                color = if (view.paused) Pulse.muted else Color.White, fontSize = 40.sp, fontWeight = FontWeight.Bold,
            )
            val subline = when {
                view.paused -> "${state.label(view.phase.type)} · ${state.label("remainingTotal")} ${formatClock(view.totalRemainingMs)}"
                overview -> "${state.label("remainingTotal")} ${formatClock(view.totalRemainingMs)}"
                view.next != null -> fillNext(state.label("next"), state.label(view.next.type), formatClock(view.next.endMs - view.next.startMs))
                else -> state.label("last")
            }
            Text(subline, color = Pulse.muted, fontSize = 11.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 20.dp))
            Spacer(Modifier.height(6.dp))
            RoundButton(Pulse.mint, onClick = { RunRepository.send(context, if (view.paused) "resume" else "pause") }) {
                if (view.paused) PlayIcon(Pulse.onMint) else PauseIcon(Pulse.onMint)
            }
        }
    }
}

@Composable
private fun ControlsPage(state: RunState, onSkip: () -> Unit, onStop: () -> Unit) {
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        LabeledButton(state.label("skip"), onSkip) { SkipIcon(Color.White) }
        Spacer(Modifier.height(12.dp))
        LabeledButton(state.label("stop"), onStop) { StopIcon(Color.White) }
    }
}

@Composable
private fun StopConfirm(state: RunState, onKeep: () -> Unit, onStop: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(22.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(state.label("stopTitle"), color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        Text(state.label("stopBody"), color = Pulse.muted, fontSize = 11.sp, textAlign = TextAlign.Center)
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            RoundButton(Pulse.surface2, onClick = onKeep) { Text("✕", color = Color.White, fontSize = 14.sp) }
            RoundButton(Pulse.run, onClick = onStop) { Text("✓", color = Color.White, fontSize = 14.sp) }
        }
    }
}

@Composable
private fun LabeledButton(label: String, onClick: () -> Unit, icon: @Composable () -> Unit) {
    Row(Modifier.clickable(onClick = onClick), verticalAlignment = Alignment.CenterVertically) {
        RoundButton(Pulse.surface2, onClick = onClick, content = icon)
        Spacer(Modifier.width(8.dp))
        Text(label, color = Color.White, fontSize = 13.sp)
    }
}

@Composable
private fun RoundButton(color: Color, onClick: () -> Unit, content: @Composable () -> Unit) {
    Box(Modifier.size(40.dp).clip(CircleShape).background(color).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        content()
    }
}

@Composable
private fun PageDots(current: Int) {
    Row(Modifier.fillMaxSize().padding(bottom = 10.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.Bottom) {
        repeat(2) { i ->
            Box(Modifier.padding(horizontal = 3.dp).size(5.dp).clip(CircleShape).background(if (i == current) Color.White else Pulse.muted))
        }
    }
}

@Composable
private fun PauseIcon(color: Color) = Canvas(Modifier.size(14.dp)) {
    val bar = size.width / 3
    drawRect(color, topLeft = Offset(0f, 0f), size = androidx.compose.ui.geometry.Size(bar, size.height))
    drawRect(color, topLeft = Offset(size.width - bar, 0f), size = androidx.compose.ui.geometry.Size(bar, size.height))
}

@Composable
private fun PlayIcon(color: Color) = Canvas(Modifier.size(14.dp)) {
    drawPath(Path().apply { moveTo(0f, 0f); lineTo(size.width, size.height / 2); lineTo(0f, size.height); close() }, color)
}

@Composable
private fun SkipIcon(color: Color) = Canvas(Modifier.size(14.dp)) {
    val bar = size.width / 5
    drawPath(Path().apply { moveTo(0f, 0f); lineTo(size.width - bar, size.height / 2); lineTo(0f, size.height); close() }, color)
    drawRect(color, topLeft = Offset(size.width - bar, 0f), size = androidx.compose.ui.geometry.Size(bar, size.height))
}

@Composable
private fun StopIcon(color: Color) = Canvas(Modifier.size(12.dp)) { drawRect(color) }
```

If a Wear Compose API differs in the resolved version (e.g. `androidx.wear.compose.material3.Text` parameters), adapt to the version's signature; the layout above is what matters.

- [ ] **Step 4: `MainActivity.kt` — ambient and the new UI**

Replace the `setContent { ... }` block and add ambient handling:

```kotlin
class MainActivity : ComponentActivity() {
    private val ambient = mutableStateOf(false)
    private val ambientTick = mutableLongStateOf(0L)

    private val ambientCallback = object : AmbientLifecycleObserver.AmbientLifecycleCallback {
        override fun onEnterAmbient(ambientDetails: AmbientLifecycleObserver.AmbientDetails) { ambient.value = true }
        override fun onExitAmbient() { ambient.value = false }
        override fun onUpdateAmbient() { ambientTick.longValue = System.currentTimeMillis() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycle.addObserver(AmbientLifecycleObserver(this, ambientCallback))
        RunRepository.load(this)
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 0)
        }
        setContent {
            PulseApp(ambient = ambient.value, ambientTick = ambientTick.longValue, onFinished = { finish() })
        }
    }

    override fun onResume() {
        super.onResume()
        PhoneLink.ping(this)
        StartPrompt.hide(this)
        val state = RunRepository.state.value
        if (state != null && state.ended == null) WorkoutService.ensureRunning(this)
    }
}
```

(imports: `android.Manifest`, `android.content.pm.PackageManager`, `androidx.compose.runtime.mutableLongStateOf`, `androidx.compose.runtime.mutableStateOf`, `androidx.wear.ambient.AmbientLifecycleObserver`, `io.github.willenjs.pulserun.wear.ui.PulseApp`.) Remove the temporary Task 8 text UI.

- [ ] **Step 5: Build and test**

Run: `npm run android:test` then `npm run wear:build`
Expected: PASS; APK built.

- [ ] **Step 6: Commit**

```bash
git add android/wear
git commit -m "feat: add the watch run, overview, controls, paused, finish, idle and ambient screens"
```

- [ ] **Step 7: Device gate (controller + user)**

Install the watch APK. Walk through the screens against the brainstorm mockups: running ring colour per pace, double-tap overview (remembered after reopening), swipe to Skip / Stop, stop confirm, paused overview with Resume, finish screen closing itself, idle, ambient (wrist down).

---

### Task 10: Docs, commands and the full device test

**Files:**
- Modify: `README.md`, `AGENTS.md`

- [ ] **Step 1: `AGENTS.md`**

Under `## Commands` add:

```markdown
- Phone + watch JVM unit tests: `npm run android:test`
- Watch APK: `npm run wear:build` (install over Wi-Fi: set `WEAR_SERIAL=<ip:port>`, then `npm run wear:install`)
```

Under `## Architecture rules` add:

```markdown
- `android/wear/` is the Wear OS companion, in Kotlin + Compose for Wear OS
  (Wear OS has no WebView). The phone app's native code stays Java.
- While a run is active in the Android app, `CoachService` owns the session:
  JS sends every session change (`engine.sync`), the service applies watch
  commands itself and reports states back (`stateChanged`, `current()`).
  `tests/fixtures/session-math.json` pins `timer.js`, `SessionMath.java` and
  the watch's `RunState.kt` to the same arithmetic; change all three together.
```

Change the "Before claiming a change is done" line to also require `npm run android:test` when `android/` changed.

- [ ] **Step 2: `README.md`**

In "Project layout" add `- \`android/wear/\` — Wear OS companion app (Kotlin, Compose for Wear OS).` After "Manual phone test (Android app)" add:

```markdown
### Manual watch test (Galaxy Watch8 + Android app)

Install both apps (`npm run android:install`, `npm run wear:install`) and
open PulseRun on the watch once (allow notifications).

1. Open the watch app: the dot under the text turns mint (phone reachable).
2. Start a workout on the phone: the watch app opens, or a PulseRun chip /
   "tap to open" prompt appears on the watch.
3. Lock the phone. From the watch: pause, resume, skip, stop (with confirm).
   The phone's cues follow each change within a couple of seconds.
4. Screen off on the watch: it buzzes at each phase change (Walk one long,
   Jog two short, Run three short, finish long–short–long).
5. Lower the wrist: the always-on screen shows the phase and countdown.
6. Walk out of Bluetooth range and back mid-run: the watch keeps counting,
   commands show "Phone not reachable" while away, and it catches up.
7. Kill the phone app mid-run: a watch command shows "Phone not reachable";
   reopening the phone app offers to resume.
```

- [ ] **Step 3: Full verification**

Run: `npm test`, `npm run build`, `npm run android:test`, `npm run android:build`, `npm run wear:build`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: document the Wear OS companion and its device test"
```

- [ ] **Step 5: Device gate (controller + user)**

Run the whole "Manual watch test" with the user, plus the phone test 5 (30+ minute locked run) while wearing the watch. Record results in `docs/android-phone-test.md` (append a "Watch" section).
