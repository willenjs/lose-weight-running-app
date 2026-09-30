package io.github.willenjs.pulserun.coach;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** A workout's cue schedule in workout time (workoutSchedule in src/core/timeline.js). */
final class Schedule {
    /** DUE_GRACE_MS in src/core/cues.js. */
    static final long DUE_GRACE_MS = 250;

    private Schedule() {}

    static final class Event {
        final String type;
        final long atMs;
        final String tone;
        final String text;
        final int volume;

        Event(String type, long atMs, String tone, String text, int volume) {
            this.type = type;
            this.atMs = atMs;
            this.tone = tone;
            this.text = text;
            this.volume = volume;
        }

        boolean isTone() {
            return "tone".equals(type);
        }
    }

    /** Tone and speech events; anything else is skipped. */
    static List<Event> parse(JSONArray array) {
        if (array == null) return Collections.emptyList();
        List<Event> events = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) {
            JSONObject e = array.optJSONObject(i);
            if (e == null) continue;
            String type = e.optString("type");
            if (!"tone".equals(type) && !"speech".equals(type)) continue;
            events.add(new Event(type, e.optLong("atMs"), e.optString("tone"), e.optString("text"), e.optInt("volume")));
        }
        return events;
    }

    /** Events still due at elapsedMs, allowing DUE_GRACE_MS of lateness. */
    static List<Event> ahead(List<Event> events, long elapsedMs) {
        List<Event> result = new ArrayList<>();
        for (Event e : events) {
            if (e.atMs >= elapsedMs - DUE_GRACE_MS) result.add(e);
        }
        return result;
    }
}
