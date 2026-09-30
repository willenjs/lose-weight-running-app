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
    private val refreshToken = Any()
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
        // startForeground posted a plain notification: put the Ongoing Activity back on it.
        if (state != null) showOngoing(state) else stopSelf()
        return START_NOT_STICKY
    }

    private fun onState(state: RunState) {
        if (state.runId != shownRunId && state.ended == null) {
            shownRunId = state.runId
            bringToFront()
        }
        showOngoing(state)
        planRefreshes(state)
        planHaptics(state)
        handler.removeCallbacksAndMessages(stopToken)
        if (state.ended != null) HandlerCompat.postDelayed(handler, { stopSelf() }, stopToken, STOP_AFTER_END_MS)
    }

    /** The phone publishes only on changes: redraw the chip at every phase boundary and at the finish. */
    private fun planRefreshes(state: RunState) {
        handler.removeCallbacksAndMessages(refreshToken)
        if (state.ended != null || state.session.pausedAt != null) return
        val now = System.currentTimeMillis()
        val elapsed = state.elapsedMs(now)
        val workoutStart = now - elapsed
        val uptime = SystemClock.uptimeMillis()
        state.phases.filter { it.endMs > elapsed }.forEach { phase ->
            val at = uptime + (workoutStart + phase.endMs - now).coerceAtLeast(0) + 50
            handler.postAtTime({ RunRepository.state.value?.let { showOngoing(it) } }, refreshToken, at)
        }
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
        wakeLock.acquire((plan.last().atMs - now).coerceAtLeast(0) + 5_000)
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
            state.ended == "finished" || view.finished -> Status.Builder().addTemplate(state.label("done")).build()
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
     * The TimerPart counts down to this. Time base: the androidx.wear:wear-ongoing
     * Status class Javadoc points to SystemClock.elapsedRealtime() for part
     * timestamps (the constructor docs only say "timestamp"); the library
     * itself just subtracts timeZeroMillis from the "now" the host supplies.
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
