package io.github.willenjs.pulserun.wear

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.core.os.HandlerCompat
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONObject

/** The latest run from the phone, and whether the phone answers our commands. */
object RunRepository {
    const val RUN_PATH = "/pulserun/run"
    // A command counts as heard when any state arrives within this time.
    private const val ACK_TIMEOUT_MS = 3_000L
    private const val UNREACHABLE_SHOWN_MS = 4_000L

    private val main = Handler(Looper.getMainLooper())
    private val ackToken = Any()
    private val hideToken = Any()
    private val current = MutableStateFlow<RunState?>(null)
    private val notHeard = MutableStateFlow(false)

    val state: StateFlow<RunState?> = current
    val unreachable: StateFlow<Boolean> = notHeard

    @Synchronized
    fun update(next: RunState) {
        // Any state from the phone answers a pending command.
        main.removeCallbacksAndMessages(ackToken)
        notHeard.value = false
        val old = current.value
        if (old == null || next.runId > old.runId || (next.runId == old.runId && next.revision >= old.revision)) {
            current.value = next
        }
    }

    fun send(context: Context, action: String) {
        val s = current.value ?: return
        val command = JSONObject().put("runId", s.runId).put("action", action).put("basedOn", s.revision)
        PhoneLink.sendCommand(context, command.toString()) { ok -> if (!ok) main.post { showUnreachable() } }
        HandlerCompat.postDelayed(main, { showUnreachable() }, ackToken, ACK_TIMEOUT_MS)
    }

    /** The phone's last published run, for a fresh process (the Data Layer keeps it). */
    fun load(context: Context) {
        val uri = Uri.Builder().scheme("wear").path(RUN_PATH).build()
        Wearable.getDataClient(context.applicationContext).getDataItems(uri).addOnSuccessListener { items ->
            try {
                items.forEach { item ->
                    runCatching {
                        DataMapItem.fromDataItem(item).dataMap.getString("state")?.let(RunState::parse)?.let(::update)
                    }
                }
            } finally {
                items.release()
            }
        }
    }

    private fun showUnreachable() {
        main.removeCallbacksAndMessages(ackToken)
        notHeard.value = true
        main.removeCallbacksAndMessages(hideToken)
        HandlerCompat.postDelayed(main, { notHeard.value = false }, hideToken, UNREACHABLE_SHOWN_MS)
    }
}
