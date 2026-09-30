package io.github.willenjs.pulserun.wear

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.Node
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Messages to the phone app (the node advertising [CAPABILITY]). */
object PhoneLink {
    const val PING_PATH = "/pulserun/ping"
    const val PONG_PATH = "/pulserun/pong"
    const val COMMAND_PATH = "/pulserun/command"
    const val CAPABILITY = "pulserun_phone"
    private const val PING_TIMEOUT_MS = 3_000L

    private val main = Handler(Looper.getMainLooper())
    private val timeout = Runnable { reachable.value = false }
    private val reachable = MutableStateFlow<Boolean?>(null)

    /** null until the first ping settles. */
    val phoneReachable: StateFlow<Boolean?> = reachable

    fun ping(context: Context) {
        main.removeCallbacks(timeout)
        main.postDelayed(timeout, PING_TIMEOUT_MS)
        send(context, PING_PATH, ByteArray(0)) { ok -> if (!ok) reachable.value = false }
    }

    fun onPong() {
        main.removeCallbacks(timeout)
        reachable.value = true
    }

    fun sendCommand(context: Context, json: String, onResult: (Boolean) -> Unit) {
        send(context, COMMAND_PATH, json.toByteArray(Charsets.UTF_8), onResult)
    }

    private fun send(context: Context, path: String, data: ByteArray, onResult: (Boolean) -> Unit) {
        val app = context.applicationContext
        Wearable.getCapabilityClient(app)
            .getCapability(CAPABILITY, CapabilityClient.FILTER_REACHABLE)
            .addOnSuccessListener { info ->
                val node: Node? = info.nodes.firstOrNull { it.isNearby } ?: info.nodes.firstOrNull()
                if (node == null) {
                    onResult(false)
                    return@addOnSuccessListener
                }
                Wearable.getMessageClient(app).sendMessage(node.id, path, data)
                    .addOnSuccessListener { onResult(true) }
                    .addOnFailureListener { onResult(false) }
            }
            .addOnFailureListener { onResult(false) }
    }
}
