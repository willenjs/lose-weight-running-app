package io.github.willenjs.pulserun.coach;

import android.content.Context;
import android.util.Log;
import com.google.android.gms.wearable.PutDataMapRequest;
import com.google.android.gms.wearable.Wearable;
import org.json.JSONObject;

/** Publishes the run state to the PulseRun watch app (DataItem /pulserun/run). */
final class WatchLink {
    static final String RUN_PATH = "/pulserun/run";

    private WatchLink() {}

    static void publish(Context context, JSONObject state) {
        try {
            PutDataMapRequest request = PutDataMapRequest.create(RUN_PATH);
            request.getDataMap().putString("state", state.toString());
            // Changes on every publish, so the watch hears even an unchanged state (its command acknowledgement).
            request.getDataMap().putLong("publishedAt", System.currentTimeMillis());
            Wearable.getDataClient(context).putDataItem(request.asPutDataRequest().setUrgent())
                .addOnFailureListener(e -> Log.w("PulseRun", "Watch publish failed", e));
        } catch (RuntimeException e) {
            // No Play services or no Wear API: the phone works without a watch.
            Log.w("PulseRun", "Watch publish failed", e);
        }
    }
}
