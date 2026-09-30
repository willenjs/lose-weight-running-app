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

    /** Starts (or replaces) the workout timeline in the foreground service. */
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
        CoachService.stop(getContext());
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
        main.removeCallbacksAndMessages(testToken);
        if (testPlayer != null) testPlayer.shutdown();
        super.handleOnDestroy();
    }
}
