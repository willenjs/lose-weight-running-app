package io.github.willenjs.pulserun.coach;

import android.Manifest;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Bridge for src/platform/native/nativeCueEngine.js. */
@CapacitorPlugin(
    name = "Coach",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class CoachPlugin extends Plugin {
    // Silence between consecutive tones in the audio test (TEST_GAP_S in audio.js).
    private static final long TEST_GAP_MS = 250;
    private static final long TEST_LEAD_MS = 50;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final Object testToken = new Object();
    private CuePlayer testPlayer;
    private int testRun = 0;

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

    /** Starts or updates the run in the foreground service. */
    @PluginMethod
    public void start(PluginCall call) {
        try {
            CoachService.start(getContext(), call.getData().toString());
            call.resolve();
        } catch (RuntimeException e) {
            call.reject("Could not start the workout service", e);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            CoachService.stop(getContext());
        } catch (RuntimeException ignored) {
            // Service not running and cannot be started from the background: nothing to stop.
        }
        call.resolve();
    }

    /** Plays the sample line (if any), then the tones one after another; resolves when done. */
    @PluginMethod
    public void test(PluginCall call) {
        main.post(() -> runTest(call));
    }

    private void runTest(PluginCall call) {
        int run = ++testRun;
        main.removeCallbacksAndMessages(testToken);
        java.util.List<String> locales = CuePlayer.strings(call.getArray("locales"));
        if (testPlayer == null) {
            testPlayer = new CuePlayer(getContext(), main, locales);
        } else {
            testPlayer.stopAll();
            testPlayer.setLocales(locales);
        }
        JSONArray tones = call.getArray("tones");
        JSObject speech = call.getObject("speech");
        Runnable playTones = () -> {
            if (run != testRun) {
                call.resolve();
                return;
            }
            long at = android.os.SystemClock.uptimeMillis() + TEST_LEAD_MS;
            for (int i = 0; tones != null && i < tones.length(); i++) {
                JSONObject tone = tones.optJSONObject(i);
                if (tone == null || !ToneBank.has(tone.optString("tone"))) continue;
                String kind = tone.optString("tone");
                int volume = tone.optInt("volume");
                main.postAtTime(() -> testPlayer.playTone(kind, volume), testToken, at);
                at += ToneBank.durationMs(kind) + TEST_GAP_MS;
            }
            main.postAtTime(call::resolve, testToken, at);
        };
        if (speech != null) {
            testPlayer.speak(speech.optString("text"), speech.optInt("volume"), playTones);
        } else {
            playTones.run();
        }
    }

    @Override
    protected void handleOnDestroy() {
        CoachService.listener = null;
        main.removeCallbacksAndMessages(testToken);
        if (testPlayer != null) testPlayer.shutdown();
        super.handleOnDestroy();
    }
}
