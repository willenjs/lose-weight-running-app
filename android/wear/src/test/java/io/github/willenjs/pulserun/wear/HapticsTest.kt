package io.github.willenjs.pulserun.wear

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HapticsTest {
    private val phases = listOf(
        Phase("walk", 0, 360_000), Phase("jog", 360_000, 480_000), Phase("run", 480_000, 540_000),
    )
    private fun state(pausedAt: Long? = null, skippedMs: Long = 0, ended: String? = null) =
        RunState(1_000_000, 1, ended, Session("w1d1", 1_000_000, pausedAt, 0, skippedMs), phases, "W1D1", emptyMap())

    @Test
    fun plansEveryPhaseStartAheadAndTheFinish() {
        val plan = hapticPlan(state(), 1_000_000L + 100_000L)
        assertEquals(listOf(HapticKind.JOG, HapticKind.RUN, HapticKind.FINISH), plan.map { it.kind })
        assertEquals(listOf(1_360_000L, 1_480_000L, 1_540_000L), plan.map { it.atMs })
        assertEquals(listOf("1000000:1", "1000000:2", "1000000:3"), plan.map { it.key })
    }

    @Test
    fun includesAPhaseThatStartedWithinTheGrace() {
        // Received 1.5 s after a start or a skip: that phase still buzzes (now).
        val plan = hapticPlan(state(), 1_000_000L + 1_500L)
        assertEquals("1000000:0", plan.first().key)
        assertEquals(HapticKind.WALK, plan.first().kind)
    }

    @Test
    fun skipsPhasesStartedLongAgo() {
        val plan = hapticPlan(state(), 1_000_000L + 5_000L)
        assertEquals("1000000:1", plan.first().key)
    }

    @Test
    fun graceBoundaryIsInclusive() {
        assertEquals("1000000:0", hapticPlan(state(), 1_000_000L + 2_000L).first().key)
        assertEquals("1000000:1", hapticPlan(state(), 1_000_000L + 2_001L).first().key)
    }

    @Test
    fun plansNothingWhilePausedOrEnded() {
        assertTrue(hapticPlan(state(pausedAt = 1_010_000), 1_020_000).isEmpty())
        assertTrue(hapticPlan(state(ended = "stopped"), 1_020_000).isEmpty())
        assertTrue(hapticPlan(state(ended = "finished"), 1_020_000).isEmpty())
    }

    @Test
    fun mapsPhaseTypes() {
        assertEquals(HapticKind.WALK, kindOf("walk"))
        assertEquals(HapticKind.JOG, kindOf("jog"))
        assertEquals(HapticKind.RUN, kindOf("run"))
    }
}
