package io.github.willenjs.pulserun.coach;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
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
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Plays a workout's whole cue timeline in the foreground, so cues stay on
 * time with the screen locked or another app in front. A partial wake lock
 * keeps the CPU (and the uptime clock the handler uses) running until the
 * last cue has played.
 */
public class CoachService extends Service {
    private static final String ACTION_START = "io.github.willenjs.pulserun.coach.START";
    private static final String ACTION_STOP = "io.github.willenjs.pulserun.coach.STOP";
    private static final String EXTRA_PAYLOAD = "payload";
    private static final String CHANNEL_ID = "workout";
    private static final int NOTIFICATION_ID = 1;
    // Keeps the service up after the last cue starts, so the fanfare and finish line play out.
    private static final long FINISH_GRACE_MS = 15_000;
    // Upper bound for the JS-to-service delivery lag that is compensated.
    private static final long MAX_LAG_MS = 5_000;

    private final Object eventsToken = new Object();
    private HandlerThread thread;
    private Handler handler;
    private CuePlayer player;
    private PowerManager.WakeLock wakeLock;

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
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            handler.post(() -> {
                handler.removeCallbacksAndMessages(eventsToken);
                if (player != null) player.stopAll();
            });
            // Only stops if no newer start has been requested since.
            if (stopSelfResult(startId) && wakeLock.isHeld()) wakeLock.release();
            return START_NOT_STICKY;
        }
        JSONObject payload = null;
        try {
            if (intent != null && ACTION_START.equals(intent.getAction())) {
                payload = new JSONObject(intent.getStringExtra(EXTRA_PAYLOAD));
            }
        } catch (JSONException | NullPointerException ignored) {
            // Handled below.
        }
        // Must reach the foreground promptly after startForegroundService, even on bad input.
        startInForeground(payload == null ? new JSONObject() : payload.optJSONObject("notification"));
        if (payload == null) {
            stopSelfResult(startId);
            return START_NOT_STICKY;
        }
        JSONObject timeline = payload;
        // Time the payload spent getting here (bridge, service start).
        long lag = Math.max(0, Math.min(MAX_LAG_MS, System.currentTimeMillis() - payload.optLong("sentAt", System.currentTimeMillis())));
        long sentAtUptime = SystemClock.uptimeMillis() - lag;
        handler.post(() -> schedule(timeline, sentAtUptime, startId));
        return START_NOT_STICKY;
    }

    private void startInForeground(JSONObject notification) {
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
            .setContentText(text.optString("text", ""))
            .setContentIntent(content)
            .setOngoing(true)
            .setSilent(true)
            .build();
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, built, type);
    }

    /** Replaces whatever was scheduled with this timeline. Runs on the coach thread. */
    private void schedule(JSONObject payload, long base, int startId) {
        handler.removeCallbacksAndMessages(eventsToken);
        if (player == null) {
            player = new CuePlayer(this, handler, CuePlayer.strings(payload.optJSONArray("locales")));
        } else {
            player.stopAll();
            player.setLocales(CuePlayer.strings(payload.optJSONArray("locales")));
        }
        JSONArray events = payload.optJSONArray("events");
        if (events == null) events = new JSONArray();

        // Speech waits for the tone at the same moment: tone first, then voice.
        Map<Long, Long> toneLength = new HashMap<>();
        for (int i = 0; i < events.length(); i++) {
            JSONObject event = events.optJSONObject(i);
            if (event == null || !"tone".equals(event.optString("type"))) continue;
            String tone = event.optString("tone");
            if (!ToneBank.has(tone)) continue;
            long atMs = event.optLong("atMs");
            toneLength.put(atMs, Math.max(lengthAt(toneLength, atMs), ToneBank.durationMs(tone)));
        }

        long lastMs = 0;
        for (int i = 0; i < events.length(); i++) {
            JSONObject event = events.optJSONObject(i);
            if (event == null) continue;
            long atMs = event.optLong("atMs");
            int volume = event.optInt("volume");
            if ("tone".equals(event.optString("type"))) {
                String tone = event.optString("tone");
                if (!ToneBank.has(tone)) continue;
                handler.postAtTime(() -> player.playTone(tone, volume), eventsToken, base + atMs);
                lastMs = Math.max(lastMs, atMs + ToneBank.durationMs(tone));
            } else if ("speech".equals(event.optString("type"))) {
                String text = event.optString("text");
                long speakAt = atMs + lengthAt(toneLength, atMs);
                handler.postAtTime(() -> player.speak(text, volume, () -> {}), eventsToken, base + speakAt);
                lastMs = Math.max(lastMs, speakAt);
            }
        }

        long endMs = lastMs + FINISH_GRACE_MS;
        wakeLock.acquire(Math.max(0, base + endMs - SystemClock.uptimeMillis()));
        // A newer start keeps the service running.
        handler.postAtTime(() -> stopSelfResult(startId), eventsToken, base + endMs);
    }

    private static long lengthAt(Map<Long, Long> toneLength, long atMs) {
        Long length = toneLength.get(atMs);
        return length == null ? 0 : length;
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
