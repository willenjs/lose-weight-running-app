package io.github.willenjs.pulserun.wear

import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

/** Data Layer events from the phone app. */
class RunListenerService : WearableListenerService() {
    override fun onMessageReceived(event: MessageEvent) {
        if (event.path == PhoneLink.PONG_PATH) PhoneLink.onPong()
    }
}
