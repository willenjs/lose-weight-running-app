package io.github.willenjs.pulserun.coach;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

public class RunModelTest {
    static final long T0 = 1_000_000;

    static JSONObject payload() throws Exception {
        JSONObject session = new JSONObject().put("workoutId", "w1d1").put("startedAt", T0)
            .put("pausedAt", JSONObject.NULL).put("pausedTotalMs", 0).put("skippedMs", 0);
        JSONArray phases = new JSONArray()
            .put(new JSONObject().put("type", "walk").put("startMs", 0).put("endMs", 360000))
            .put(new JSONObject().put("type", "jog").put("startMs", 360000).put("endMs", 480000));
        return new JSONObject().put("session", session).put("phases", phases).put("schedule", ScheduleTest.events())
            .put("announce", JSONObject.NULL).put("locales", new JSONArray().put("en-US"))
            .put("notification", new JSONObject().put("title", "W1D1"))
            .put("watch", new JSONObject().put("title", "Week 1 • Day 1"));
    }

    static JSONObject command(String action, long basedOn) throws Exception {
        return new JSONObject().put("runId", T0).put("action", action).put("basedOn", basedOn);
    }

    @Test
    public void readsThePayload() throws Exception {
        RunModel run = RunModel.fromPayload(payload(), 4);
        assertEquals(T0, run.runId());
        assertEquals(4, run.revision());
        assertNull(run.ended());
        assertEquals(480000, run.totalMs());
        assertEquals(4, run.schedule().size());
        assertEquals(100000, run.elapsedMs(T0 + 100000));
    }

    @Test
    public void appliesAPauseFromTheCurrentRevision() throws Exception {
        RunModel run = RunModel.fromPayload(payload(), 4);
        assertTrue(run.applyCommand(command("pause", 4), T0 + 10000, 5));
        assertEquals(5, run.revision());
        assertEquals(Long.valueOf(T0 + 10000), run.session().pausedAt);
    }

    @Test
    public void resumesAndSkips() throws Exception {
        RunModel run = RunModel.fromPayload(payload(), 1);
        run.applyCommand(command("pause", 1), T0 + 10000, 2);
        assertTrue(run.applyCommand(command("resume", 2), T0 + 25000, 3));
        assertEquals(15000, run.session().pausedTotalMs);
        assertTrue(run.applyCommand(command("skip", 3), T0 + 25000, 4));
        assertEquals(360000, run.elapsedMs(T0 + 25000));
    }

    @Test
    public void ignoresStaleBasedOn() throws Exception {
        RunModel run = RunModel.fromPayload(payload(), 1);
        assertTrue(run.applyCommand(command("skip", 1), T0 + 1000, 2));
        assertFalse(run.applyCommand(command("skip", 1), T0 + 1100, 3));
        assertEquals(2, run.revision());
        assertEquals(360000, run.elapsedMs(T0 + 1000));
    }

    @Test
    public void ignoresOtherRun() throws Exception {
        RunModel run = RunModel.fromPayload(payload(), 1);
        JSONObject other = command("pause", 1).put("runId", T0 + 1);
        assertFalse(run.applyCommand(other, T0 + 1000, 2));
        assertNull(run.session().pausedAt);
    }

    @Test
    public void ignoresUnknownActionsAndEndedRuns() throws Exception {
        RunModel run = RunModel.fromPayload(payload(), 1);
        assertFalse(run.applyCommand(command("dance", 1), T0, 2));
        assertTrue(run.applyCommand(command("stop", 1), T0, 2));
        assertEquals("stopped", run.ended());
        assertFalse(run.applyCommand(command("resume", 2), T0, 3));
    }

    @Test
    public void knowsWhenItIsFinished() throws Exception {
        RunModel run = RunModel.fromPayload(payload(), 1);
        assertFalse(run.finishedAt(T0 + 479999));
        assertTrue(run.finishedAt(T0 + 480000));
    }

    @Test
    public void reportsItsState() throws Exception {
        RunModel run = RunModel.fromPayload(payload(), 7);
        run.end("finished", 8);
        JSONObject state = run.toState();
        assertEquals(T0, state.getLong("runId"));
        assertEquals(8, state.getLong("revision"));
        assertEquals("finished", state.getString("ended"));
        assertEquals("w1d1", state.getJSONObject("session").getString("workoutId"));
        assertEquals(2, state.getJSONArray("phases").length());
        assertEquals("Week 1 • Day 1", state.getJSONObject("watch").getString("title"));
    }

    @Test(expected = org.json.JSONException.class)
    public void rejectsAPayloadWithoutPhases() throws Exception {
        JSONObject bad = payload();
        bad.remove("phases");
        RunModel.fromPayload(bad, 1);
    }

    @Test
    public void tellsActiveSavedStatesFromEndedOnes() throws Exception {
        JSONObject active = RunModel.fromPayload(payload(), 3).toState();
        assertTrue(RunModel.isActive(active));
        assertFalse(RunModel.isActive(null));
        assertFalse(RunModel.isActive(new JSONObject()));
        assertFalse(RunModel.isActive(RunModel.ended(active, "stopped", 4)));
    }

    @Test
    public void endsASavedStateWithANewRevision() throws Exception {
        JSONObject active = RunModel.fromPayload(payload(), 3).toState();
        JSONObject ended = RunModel.ended(active, "stopped", 4);
        assertEquals("stopped", ended.getString("ended"));
        assertEquals(4, ended.getLong("revision"));
        assertEquals(T0, ended.getLong("runId"));
        assertEquals(T0, ended.getJSONObject("session").getLong("startedAt"));
        assertTrue(active.isNull("ended"));
    }
}
