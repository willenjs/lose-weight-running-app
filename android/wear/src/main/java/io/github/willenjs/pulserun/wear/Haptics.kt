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
        if (phase.startMs < elapsed - HAPTIC_GRACE_MS) null
        else Haptic("${state.runId}:$i", workoutStart + phase.startMs, kindOf(phase.type))
    }
    val finish = Haptic("${state.runId}:${state.phases.size}", workoutStart + state.totalMs, HapticKind.FINISH)
    return if (elapsed >= state.totalMs) emptyList() else plan + finish
}
