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
