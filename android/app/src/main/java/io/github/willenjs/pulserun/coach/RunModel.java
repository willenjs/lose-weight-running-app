package io.github.willenjs.pulserun.coach;

import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The run the service owns: the session from the page plus every change made
 * since (watch commands, the finish). Each change takes a new, higher
 * revision so the page and the watch can tell newer states from older ones.
 */
final class RunModel {
    private final JSONObject payload;
    private final JSONArray phases;
    private final long[] phaseEnds;
    private final List<Schedule.Event> schedule;
    private SessionMath.Session session;
    private long revision;
    private String ended;

    private RunModel(JSONObject payload, JSONArray phases, long[] phaseEnds, List<Schedule.Event> schedule,
                     SessionMath.Session session, long revision) {
        this.payload = payload;
        this.phases = phases;
        this.phaseEnds = phaseEnds;
        this.schedule = schedule;
        this.session = session;
        this.revision = revision;
    }

    static RunModel fromPayload(JSONObject payload, long revision) throws JSONException {
        JSONArray phases = payload.getJSONArray("phases");
        if (phases.length() == 0) throw new JSONException("No phases");
        long[] ends = new long[phases.length()];
        for (int i = 0; i < ends.length; i++) ends[i] = phases.getJSONObject(i).getLong("endMs");
        return new RunModel(payload, phases, ends, Schedule.parse(payload.optJSONArray("schedule")),
            SessionMath.Session.fromJson(payload.getJSONObject("session")), revision);
    }

    long runId() { return session.startedAt; }
    long revision() { return revision; }
    String ended() { return ended; }
    SessionMath.Session session() { return session; }
    long totalMs() { return phaseEnds[phaseEnds.length - 1]; }
    List<Schedule.Event> schedule() { return schedule; }
    JSONObject payload() { return payload; }

    long elapsedMs(long now) {
        return SessionMath.elapsedMs(session, totalMs(), now);
    }

    boolean finishedAt(long now) {
        return elapsedMs(now) >= totalMs();
    }

    /**
     * A watch command: { runId, action, basedOn }. Ignored unless it is for
     * this run, still running, and based on the current revision (so a
     * double-tapped skip only skips once).
     */
    boolean applyCommand(JSONObject command, long now, long newRevision) {
        if (command == null || ended != null) return false;
        if (command.optLong("runId", -1) != runId() || command.optLong("basedOn", -1) != revision) return false;
        String action = command.optString("action");
        switch (action) {
            case "pause": session = SessionMath.pause(session, now); break;
            case "resume": session = SessionMath.resume(session, now); break;
            case "skip": session = SessionMath.skip(session, phaseEnds, now); break;
            case "stop": ended = "stopped"; break;
            default: return false;
        }
        revision = newRevision;
        return true;
    }

    void end(String reason, long newRevision) {
        ended = reason;
        revision = newRevision;
    }

    /** What the page, the saved state and the watch get. */
    JSONObject toState() {
        JSONObject watch = payload.optJSONObject("watch");
        try {
            return new JSONObject()
                .put("runId", runId())
                .put("revision", revision)
                .put("ended", ended == null ? JSONObject.NULL : ended)
                .put("session", session.toJson())
                .put("phases", phases)
                .put("watch", watch == null ? new JSONObject() : watch);
        } catch (JSONException e) {
            throw new IllegalStateException(e); // our own values: cannot happen
        }
    }
}
