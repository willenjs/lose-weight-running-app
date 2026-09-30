package io.github.willenjs.pulserun.coach;

import java.util.HashMap;
import java.util.Map;

/** 16-bit mono PCM for each cue kind, with the same notes as src/platform/audio.js. */
final class ToneBank {
    static final int SAMPLE_RATE = 44100;
    // Peak level at 100% volume, like MAX_GAIN in audio.js.
    private static final double MAX_GAIN = 0.95;
    // Short ramps avoid clicks at note start and end.
    private static final double ATTACK_S = 0.01;
    private static final double RELEASE_S = 0.02;

    /** Notes as { frequency Hz, start s, duration s }. */
    private static final Map<String, double[][]> NOTES = new HashMap<>();
    private static final Map<String, short[]> PCM = new HashMap<>();

    static {
        NOTES.put("pip", new double[][] {{880, 0, 0.15}});
        NOTES.put("lastPip", new double[][] {{1320, 0, 0.5}});
        NOTES.put("walk", new double[][] {{440, 0, 0.35}, {440, 0.5, 0.35}});
        NOTES.put("jog", new double[][] {{660, 0, 0.2}, {660, 0.3, 0.2}, {660, 0.6, 0.2}});
        NOTES.put("run", new double[][] {{990, 0, 0.1}, {990, 0.16, 0.1}, {990, 0.32, 0.1}, {990, 0.48, 0.1}});
        double[][] first = fanfare(0);
        double[][] second = fanfare(1.3);
        double[][] finish = new double[first.length + second.length][];
        System.arraycopy(first, 0, finish, 0, first.length);
        System.arraycopy(second, 0, finish, first.length, second.length);
        NOTES.put("finish", finish);
    }

    private ToneBank() {}

    private static double[][] fanfare(double offset) {
        return new double[][] {
            {523, offset, 0.15}, {659, offset + 0.18, 0.15}, {784, offset + 0.36, 0.15}, {1047, offset + 0.54, 0.55},
        };
    }

    static boolean has(String kind) {
        return NOTES.containsKey(kind);
    }

    static long durationMs(String kind) {
        double end = 0;
        for (double[] note : NOTES.get(kind)) end = Math.max(end, note[1] + note[2]);
        return Math.round(end * 1000);
    }

    static synchronized short[] pcm(String kind) {
        short[] cached = PCM.get(kind);
        if (cached != null) return cached;
        int length = (int) Math.ceil(durationMs(kind) / 1000.0 * SAMPLE_RATE);
        double[] mix = new double[length];
        for (double[] note : NOTES.get(kind)) addNote(mix, note[0], note[1], note[2]);
        short[] out = new short[length];
        for (int i = 0; i < length; i++) {
            out[i] = (short) Math.round(Math.max(-1, Math.min(1, mix[i])) * Short.MAX_VALUE);
        }
        PCM.put(kind, out);
        return out;
    }

    /** Triangle wave: full-sounding near maximum volume without the harshness of square waves. */
    private static void addNote(double[] mix, double frequency, double at, double duration) {
        int start = (int) Math.round(at * SAMPLE_RATE);
        int count = (int) Math.round(duration * SAMPLE_RATE);
        for (int i = 0; i < count && start + i < mix.length; i++) {
            double t = (double) i / SAMPLE_RATE;
            double cycle = t * frequency;
            double triangle = 2 * Math.abs(2 * (cycle - Math.floor(cycle + 0.5))) - 1;
            double envelope = Math.max(0, Math.min(1, Math.min(t / ATTACK_S, (duration - t) / RELEASE_S)));
            mix[start + i] += MAX_GAIN * envelope * triangle;
        }
    }
}
