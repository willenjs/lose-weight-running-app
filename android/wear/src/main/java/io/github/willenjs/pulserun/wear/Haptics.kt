package io.github.willenjs.pulserun.wear

import android.content.Context
import android.os.VibrationEffect
import android.os.VibratorManager

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
        if (phase.startMs < elapsed - HAPTIC_GRACE_MS) null
        else Haptic("${state.runId}:$i", workoutStart + phase.startMs, kindOf(phase.type))
    }
    val finish = Haptic("${state.runId}:${state.phases.size}", workoutStart + state.totalMs, HapticKind.FINISH)
    return if (elapsed >= state.totalMs) emptyList() else plan + finish
}

/** Walk one long pulse, Jog two short, Run three short, finish long-short-long. */
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
