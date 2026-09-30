package io.github.willenjs.pulserun.wear

import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

/** Data Layer events from the phone app. */
class RunListenerService : WearableListenerService() {
    override fun onMessageReceived(event: MessageEvent) {
        if (event.path == PhoneLink.PONG_PATH) PhoneLink.onPong()
    }

    override fun onDataChanged(events: DataEventBuffer) {
        for (event in events) {
            if (event.type != DataEvent.TYPE_CHANGED || event.dataItem.uri.path != RunRepository.RUN_PATH) continue
            val state = runCatching {
                DataMapItem.fromDataItem(event.dataItem).dataMap.getString("state")?.let(RunState::parse)
            }.getOrNull() ?: continue
            RunRepository.update(state)
            if (state.ended == null) WorkoutService.ensureRunning(this)
        }
    }
}
