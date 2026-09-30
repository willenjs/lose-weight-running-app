package io.github.willenjs.pulserun.coach;

import static org.junit.Assert.assertEquals;

import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

public class ScheduleTest {
    static JSONArray events() throws Exception {
        return new JSONArray()
            .put(new JSONObject().put("type", "tone").put("atMs", 0).put("tone", "walk").put("volume", 60))
            .put(new JSONObject().put("type", "speech").put("atMs", 0).put("text", "Walk").put("volume", 60))
            .put(new JSONObject().put("type", "tone").put("atMs", 360000).put("tone", "jog").put("volume", 60))
            .put(new JSONObject().put("type", "speech").put("atMs", 360000).put("text", "Jog").put("volume", 60))
            .put("not an event")
            .put(new JSONObject().put("type", "vibrate").put("atMs", 5));
    }

    @Test
    public void parsesToneAndSpeechEventsOnly() throws Exception {
        List<Schedule.Event> list = Schedule.parse(events());
        assertEquals(4, list.size());
        assertEquals("walk", list.get(0).tone);
        assertEquals("Jog", list.get(3).text);
        assertEquals(360000, list.get(3).atMs);
    }

    @Test
    public void keepsEventsWithinGrace() throws Exception {
        List<Schedule.Event> ahead = Schedule.ahead(Schedule.parse(events()), 360000 + 200);
        assertEquals(2, ahead.size());
        assertEquals("jog", ahead.get(0).tone);
    }

    @Test
    public void dropsEventsOlderThanGrace() throws Exception {
        assertEquals(0, Schedule.ahead(Schedule.parse(events()), 360000 + 300).size());
    }

    @Test
    public void parsesNullAsEmpty() {
        assertEquals(0, Schedule.parse(null).size());
    }
}
