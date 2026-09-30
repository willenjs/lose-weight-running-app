package io.github.willenjs.pulserun.coach;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.SystemClock;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.json.JSONArray;

/**
 * Plays cue tones and spoken lines. While anything plays it holds transient
 * "may duck" audio focus, so other apps (e.g. YouTube) lower their volume
 * and come back afterwards. Every method must run on the handler's thread.
 */
final class CuePlayer {
    // Set to false if another app pauses instead of ducking: cues then play over it.
    static final boolean USE_AUDIO_FOCUS = true;
    // Matches SPEECH_RATE in src/platform/speech.js.
    private static final float SPEECH_RATE = 1.5f;
    // Extra time before a finished tone's track is released: output that wakes
    // from standby (screen off, Bluetooth) can start playback late.
    private static final long TONE_RELEASE_MARGIN_MS = 1000;

    private final Handler handler;
    private final AudioManager audioManager;
    private final AudioAttributes attributes = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build();
    private final Object focusRequest;
    private final Object releaseToken = new Object();
    private final List<AudioTrack> tracks = new ArrayList<>();
    private final Map<String, Runnable> speechDone = new HashMap<>();
    private final List<Runnable> pendingSpeech = new ArrayList<>();
    private List<String> locales;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private boolean ttsFailed = false;
    private int holds = 0;
    private int nextUtterance = 0;

    CuePlayer(Context context, Handler handler, List<String> locales) {
        this.handler = handler;
        this.locales = locales;
        audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        focusRequest = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attributes)
                .setOnAudioFocusChangeListener(change -> {})
                .build()
            : null;
        // Created up front so the engine is warm before the first cue.
        tts = new TextToSpeech(context.getApplicationContext(), status -> handler.post(() -> onTtsInit(status)));
    }

    static List<String> strings(JSONArray array) {
        List<String> out = new ArrayList<>();
        if (array == null) return out;
        for (int i = 0; i < array.length(); i++) {
            String value = array.optString(i, null);
            if (value != null) out.add(value);
        }
        return out;
    }

    void setLocales(List<String> locales) {
        this.locales = locales;
        if (ttsReady) applyLocale();
    }

    void playTone(String kind, int volume) {
        if (volume <= 0 || !ToneBank.has(kind)) return;
        short[] pcm = ToneBank.pcm(kind);
        AudioTrack track;
        try {
            track = new AudioTrack.Builder()
                .setAudioAttributes(attributes)
                .setAudioFormat(new AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(ToneBank.SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build())
                .setTransferMode(AudioTrack.MODE_STATIC)
                .setBufferSizeInBytes(pcm.length * 2)
                .build();
        } catch (RuntimeException e) {
            return;
        }
        hold();
        try {
            if (track.write(pcm, 0, pcm.length) != pcm.length) throw new IllegalStateException("short write");
            track.setVolume(volume / 100f);
            track.play();
        } catch (RuntimeException e) {
            // A failed tone must not take the workout down (e.g. audio server restart).
            track.release();
            release();
            return;
        }
        tracks.add(track);
        long releaseAt = SystemClock.uptimeMillis() + ToneBank.durationMs(kind) + TONE_RELEASE_MARGIN_MS;
        handler.postAtTime(() -> {
            if (tracks.remove(track)) {
                track.release();
                release();
            }
        }, releaseToken, releaseAt);
    }

    /** Speaks `text`, then runs `onDone` (also when speech is off or fails). */
    void speak(String text, int volume, Runnable onDone) {
        if (volume <= 0 || ttsFailed || tts == null) {
            onDone.run();
            return;
        }
        if (!ttsReady) {
            pendingSpeech.add(() -> speak(text, volume, onDone));
            return;
        }
        String id = "cue" + nextUtterance++;
        Bundle params = new Bundle();
        params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume / 100f);
        hold();
        speechDone.put(id, onDone);
        if (tts.speak(text, TextToSpeech.QUEUE_ADD, params, id) != TextToSpeech.SUCCESS) finishSpeech(id);
    }

    /** Silences everything now; pending onDone callbacks are dropped. */
    void stopAll() {
        handler.removeCallbacksAndMessages(releaseToken);
        pendingSpeech.clear();
        speechDone.clear();
        if (tts != null) tts.stop();
        for (AudioTrack track : tracks) {
            try {
                track.stop();
            } catch (IllegalStateException ignored) {
                // Already stopped.
            }
            track.release();
        }
        tracks.clear();
        holds = 0;
        abandonFocus();
    }

    void shutdown() {
        stopAll();
        if (tts != null) {
            tts.shutdown();
            tts = null;
        }
    }

    private void onTtsInit(int status) {
        if (tts == null) return;
        if (status != TextToSpeech.SUCCESS) {
            ttsFailed = true;
        } else {
            ttsReady = true;
            tts.setAudioAttributes(attributes);
            tts.setSpeechRate(SPEECH_RATE);
            applyLocale();
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) {}
                @Override public void onDone(String id) { handler.post(() -> finishSpeech(id)); }
                @Override public void onError(String id) { handler.post(() -> finishSpeech(id)); }
                @Override public void onStop(String id, boolean interrupted) { handler.post(() -> finishSpeech(id)); }
            });
        }
        List<Runnable> pending = new ArrayList<>(pendingSpeech);
        pendingSpeech.clear();
        for (Runnable speech : pending) speech.run();
    }

    /** First locale the engine supports (language match is enough); otherwise its default voice. */
    private void applyLocale() {
        for (String tag : locales) {
            Locale locale = Locale.forLanguageTag(tag);
            if (tts.isLanguageAvailable(locale) >= TextToSpeech.LANG_AVAILABLE) {
                tts.setLanguage(locale);
                return;
            }
        }
    }

    private void finishSpeech(String id) {
        Runnable done = speechDone.remove(id);
        if (done == null) return;
        release();
        done.run();
    }

    private void hold() {
        if (holds++ == 0) requestFocus();
    }

    private void release() {
        if (holds > 0 && --holds == 0) abandonFocus();
    }

    private void requestFocus() {
        if (USE_AUDIO_FOCUS && focusRequest != null) {
            audioManager.requestAudioFocus((AudioFocusRequest) focusRequest);
        }
    }

    private void abandonFocus() {
        if (USE_AUDIO_FOCUS && focusRequest != null) {
            audioManager.abandonAudioFocusRequest((AudioFocusRequest) focusRequest);
        }
    }
}
