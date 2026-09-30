package io.github.willenjs.pulserun.coach;

import com.google.android.gms.wearable.MessageEvent;
import com.google.android.gms.wearable.Wearable;
import com.google.android.gms.wearable.WearableListenerService;

/** Messages from the PulseRun watch app. */
public class CommandListenerService extends WearableListenerService {
    static final String PING_PATH = "/pulserun/ping";
    static final String PONG_PATH = "/pulserun/pong";
    static final String COMMAND_PATH = "/pulserun/command";

    @Override
    public void onMessageReceived(MessageEvent event) {
        if (PING_PATH.equals(event.getPath())) {
            Wearable.getMessageClient(this).sendMessage(event.getSourceNodeId(), PONG_PATH, event.getData());
        }
    }
}
