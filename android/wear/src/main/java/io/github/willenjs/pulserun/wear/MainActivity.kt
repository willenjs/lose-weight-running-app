package io.github.willenjs.pulserun.wear

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.wear.ambient.AmbientLifecycleObserver
import io.github.willenjs.pulserun.wear.ui.PulseApp

class MainActivity : ComponentActivity() {
    private val ambient = mutableStateOf(false)
    private val ambientTick = mutableLongStateOf(0L)

    private val ambientCallback = object : AmbientLifecycleObserver.AmbientLifecycleCallback {
        override fun onEnterAmbient(ambientDetails: AmbientLifecycleObserver.AmbientDetails) { ambient.value = true }
        override fun onExitAmbient() { ambient.value = false }
        override fun onUpdateAmbient() { ambientTick.longValue = System.currentTimeMillis() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycle.addObserver(AmbientLifecycleObserver(this, ambientCallback))
        RunRepository.load(this)
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 0)
        }
        setContent {
            PulseApp(ambient = ambient.value, ambientTick = ambientTick.longValue, onFinished = { finish() })
        }
    }

    override fun onResume() {
        super.onResume()
        PhoneLink.ping(this)
        StartPrompt.hide(this)
        val state = RunRepository.state.value
        if (state != null && state.ended == null && !state.isStale(System.currentTimeMillis())) WorkoutService.ensureRunning(this)
    }
}
