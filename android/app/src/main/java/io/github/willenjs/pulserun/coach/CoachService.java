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
    // Start id of the last intent the coach thread has processed; state-driven stops use it, so a start still queued blocks them.
    private int lastHandledStartId;

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
        lastHandledStartId = startId;
        try {
            run = RunModel.fromPayload(payload, nextRevision());
        } catch (JSONException e) {
            if (run == null) stopSelfResult(startId);
            return;
        }
        broadcast();
        reschedule(payload.optJSONObject("announce"));
    }

    private void onStop(int startId) {
        lastHandledStartId = startId;
        if (run != null && run.ended() == null) {
            run.end("stopped", nextRevision());
            broadcast();
        } else if (run == null) {
            // The app was killed mid-run and the run discarded: tell the watch it is over.
            endSavedRun();
        }
        clearEvents();
        // Only stops if no newer start has been requested since.
        if (stopSelfResult(startId) && wakeLock.isHeld()) wakeLock.release();
    }

    private void onCommand(JSONObject command, int startId) {
        lastHandledStartId = startId;
        if (run == null) {
            stopSelfResult(startId);
            return;
        }
        if (command == null) {
            // Malformed message: answer with the current state, keep the run going.
            WatchLink.publish(this, run.toState());
            return;
        }
        long revision = run.revision();
        if (run.applyCommand(command, System.currentTimeMillis(), revision + 1)) {
            saveRevision(run.revision());
            broadcast();
            reschedule(null);
        } else {
            // Still answer, so the watch knows the phone heard it and shows the current state.
            WatchLink.publish(this, run.toState());
            stopIfStopped();
        }
    }

    private void onFinish() {
        if (run == null || run.ended() != null) return;
        run.end("finished", nextRevision());
        broadcast();
        // The fanfare and the finish line are still playing: do not clear events here.
        stopLater(FINISH_GRACE_MS);
    }

    /** A run paused for too long is over: end it everywhere, then stop. */
    private void abandon() {
        if (run != null && run.ended() == null) {
            run.end("stopped", nextRevision());
            broadcast();
        }
        stopNow();
    }

    /** Ends the saved run this service does not hold (its process died), so the page and the watch drop it. */
    private void endSavedRun() {
        JSONObject saved = savedState(this);
        if (!RunModel.isActive(saved)) return;
        JSONObject state = RunModel.ended(saved, "stopped", nextRevision());
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(PREF_STATE, state.toString()).apply();
        StateListener current = listener;
        if (current != null) current.onState(state);
        WatchLink.publish(this, state);
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
    private void reschedule(JSONObject announce) {
        clearEvents();
        if (run.ended() != null) {
            stopIfStopped();
            return;
        }
        ensurePlayer();
        long now = System.currentTimeMillis();
        long uptime = SystemClock.uptimeMillis();
        if (run.session().paused()) {
            if (wakeLock.isHeld()) wakeLock.release();
            long abandonIn = Math.max(0, run.session().startedAt + RESUME_MAX_AGE_MS - now);
            handler.postAtTime(this::abandon, eventsToken, uptime + abandonIn);
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
        handler.postAtTime(this::onFinish, eventsToken, base + run.totalMs());
        wakeLock.acquire(Math.max(0, run.totalMs() - elapsed + FINISH_GRACE_MS));
    }

    private void ensurePlayer() {
        List<String> locales = CuePlayer.strings(run.payload().optJSONArray("locales"));
        if (player == null) player = new CuePlayer(this, handler, locales);
        else player.setLocales(locales);
    }

    private void stopLater(long delayMs) {
        handler.postAtTime(this::stopNow, eventsToken, SystemClock.uptimeMillis() + delayMs);
    }

    /** A run that finished is stopped by its pending grace timer, so the fanfare plays out. */
    private void stopIfStopped() {
        if (run.ended() != null && !"finished".equals(run.ended())) stopLater(0);
    }

    private void stopNow() {
        if (stopSelfResult(lastHandledStartId) && wakeLock.isHeld()) wakeLock.release();
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
