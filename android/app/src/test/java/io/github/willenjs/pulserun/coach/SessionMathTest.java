package io.github.willenjs.pulserun.coach;

import static org.junit.Assert.assertEquals;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Checks SessionMath against tests/fixtures/session-math.json, which vitest checks against timer.js. */
public class SessionMathTest {
    static JSONObject fixtures() throws Exception {
        // Unit tests run with the module directory (android/app) as working directory.
        return new JSONObject(new String(Files.readAllBytes(Paths.get("../../tests/fixtures/session-math.json")), StandardCharsets.UTF_8));
    }

    static long[] phaseEnds(JSONArray phases) throws Exception {
        long[] ends = new long[phases.length()];
        for (int i = 0; i < ends.length; i++) ends[i] = phases.getJSONObject(i).getLong("endMs");
        return ends;
    }

    static void assertSession(String name, JSONObject expected, SessionMath.Session actual) throws Exception {
        assertEquals(name + " startedAt", expected.getLong("startedAt"), actual.startedAt);
        assertEquals(name + " pausedAt", expected.isNull("pausedAt") ? null : expected.getLong("pausedAt"), actual.pausedAt);
        assertEquals(name + " pausedTotalMs", expected.getLong("pausedTotalMs"), actual.pausedTotalMs);
        assertEquals(name + " skippedMs", expected.getLong("skippedMs"), actual.skippedMs);
    }

    @Test
    public void elapsedMatchesFixtures() throws Exception {
        JSONObject f = fixtures();
        long[] ends = phaseEnds(f.getJSONArray("phases"));
        JSONArray cases = f.getJSONArray("elapsed");
        for (int i = 0; i < cases.length(); i++) {
            JSONObject c = cases.getJSONObject(i);
            SessionMath.Session s = SessionMath.Session.fromJson(c.getJSONObject("session"));
            assertEquals(c.getString("name"), c.getLong("elapsedMs"), SessionMath.elapsedMs(s, ends[ends.length - 1], c.getLong("now")));
        }
    }

    @Test
    public void actionsMatchFixtures() throws Exception {
        JSONObject f = fixtures();
        long[] ends = phaseEnds(f.getJSONArray("phases"));
        JSONArray cases = f.getJSONArray("actions");
        for (int i = 0; i < cases.length(); i++) {
            JSONObject c = cases.getJSONObject(i);
            SessionMath.Session s = SessionMath.Session.fromJson(c.getJSONObject("session"));
            long now = c.getLong("now");
            SessionMath.Session result;
            switch (c.getString("action")) {
                case "pause": result = SessionMath.pause(s, now); break;
                case "resume": result = SessionMath.resume(s, now); break;
                default: result = SessionMath.skip(s, ends, now); break;
            }
            assertSession(c.getString("name"), c.getJSONObject("expected"), result);
        }
    }

    @Test
    public void roundTripsJson() throws Exception {
        JSONObject json = new JSONObject().put("workoutId", "w1d1").put("startedAt", 5L)
            .put("pausedAt", JSONObject.NULL).put("pausedTotalMs", 1L).put("skippedMs", 2L);
        JSONObject back = SessionMath.Session.fromJson(json).toJson();
        assertEquals("w1d1", back.getString("workoutId"));
        assertEquals(true, back.isNull("pausedAt"));
        assertEquals(2L, back.getLong("skippedMs"));
    }
}
