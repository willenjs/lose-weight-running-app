package io.github.willenjs.pulserun.coach;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * The session arithmetic of src/core/timer.js, for the service to apply
 * watch commands while the page's JavaScript sleeps. All times are epoch ms;
 * state is always derived from these four timestamps. Pinned to timer.js by
 * tests/fixtures/session-math.json.
 */
final class SessionMath {
    private SessionMath() {}

    static final class Session {
        final String workoutId;
        final long startedAt;
        final Long pausedAt;
        final long pausedTotalMs;
        final long skippedMs;

        Session(String workoutId, long startedAt, Long pausedAt, long pausedTotalMs, long skippedMs) {
            this.workoutId = workoutId;
            this.startedAt = startedAt;
            this.pausedAt = pausedAt;
            this.pausedTotalMs = pausedTotalMs;
            this.skippedMs = skippedMs;
        }

        boolean paused() {
            return pausedAt != null;
        }

        static Session fromJson(JSONObject json) throws JSONException {
            return new Session(
                json.optString("workoutId", ""),
                json.getLong("startedAt"),
                json.isNull("pausedAt") ? null : json.getLong("pausedAt"),
                json.optLong("pausedTotalMs"),
                json.optLong("skippedMs"));
        }

        JSONObject toJson() {
            try {
                return new JSONObject()
                    .put("workoutId", workoutId)
                    .put("startedAt", startedAt)
                    .put("pausedAt", pausedAt == null ? JSONObject.NULL : pausedAt)
                    .put("pausedTotalMs", pausedTotalMs)
                    .put("skippedMs", skippedMs);
            } catch (JSONException e) {
                throw new IllegalStateException(e); // plain numbers and strings: cannot happen
            }
        }
    }

    static long elapsedMs(Session s, long totalMs, long now) {
        long at = s.pausedAt != null ? s.pausedAt : now;
        long raw = at - s.startedAt - s.pausedTotalMs + s.skippedMs;
        return Math.min(totalMs, Math.max(0, raw));
    }

    static Session pause(Session s, long now) {
        if (s.paused()) return s;
        return new Session(s.workoutId, s.startedAt, now, s.pausedTotalMs, s.skippedMs);
    }

    static Session resume(Session s, long now) {
        if (!s.paused()) return s;
        return new Session(s.workoutId, s.startedAt, null, s.pausedTotalMs + Math.max(0, now - s.pausedAt), s.skippedMs);
    }

    /** Jumps to the start of the next phase (skipPhase in timer.js). */
    static Session skip(Session s, long[] phaseEnds, long now) {
        long total = phaseEnds[phaseEnds.length - 1];
        long elapsed = elapsedMs(s, total, now);
        if (elapsed >= total) return s;
        for (long end : phaseEnds) {
            if (elapsed < end) {
                return new Session(s.workoutId, s.startedAt, s.pausedAt, s.pausedTotalMs, s.skippedMs + end - elapsed);
            }
        }
        return s;
    }
}
