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

    private val t0 = 1_000_000L
    private val total = 1_260_000L

    private fun staleState(pausedAt: Long? = null, pausedTotalMs: Long = 0, skippedMs: Long = 0, ended: Any = JSONObject.NULL) =
        RunState.parse(stateJson(
            JSONObject().put("startedAt", t0).put("pausedAt", pausedAt ?: JSONObject.NULL)
                .put("pausedTotalMs", pausedTotalMs).put("skippedMs", skippedMs),
            ended,
        ))!!

    @Test
    fun aRunningRunGoesStale30sAfterItsEnd() {
        val state = staleState(pausedTotalMs = 60_000, skippedMs = 10_000)
        val endsAt = t0 + 60_000 - 10_000 + total
        assertEquals(endsAt + OVER_STALE_MS, state.staleAt())
        assertFalse(state.isStale(t0 + 100_000))
        assertFalse(state.isStale(endsAt + OVER_STALE_MS - 1))
        assertTrue(state.isStale(endsAt + OVER_STALE_MS))
    }

    @Test
    fun aPausedRunGoesStaleWhenThePhoneWouldAbandonIt() {
        val state = staleState(pausedAt = t0 + 100_000)
        assertEquals(t0 + RESUME_MAX_AGE_MS, state.staleAt())
        assertFalse(state.isStale(t0 + total + OVER_STALE_MS + 1))
        assertFalse(state.isStale(t0 + RESUME_MAX_AGE_MS - 1))
        assertTrue(state.isStale(t0 + RESUME_MAX_AGE_MS))
    }

    @Test
    fun aRunPausedAtItsEndGoesStale30sAfterIt() {
        val state = staleState(pausedAt = t0 + total + 5_000)
        assertEquals(t0 + total + OVER_STALE_MS, state.staleAt())
    }

    @Test
    fun aFinishedRunGoesStaleAMinuteAfterItsEnd() {
        val state = staleState(skippedMs = 20_000, ended = "finished")
        val endsAt = t0 - 20_000 + total
        assertFalse(state.isStale(endsAt + FINISHED_STALE_MS - 1))
        assertTrue(state.isStale(endsAt + FINISHED_STALE_MS))
    }

    @Test
    fun aStoppedRunNeverGoesStale() {
        val state = staleState(ended = "stopped")
        assertNull(state.staleAt())
        assertFalse(state.isStale(t0 + 10 * RESUME_MAX_AGE_MS))
    }
}
