package io.github.willenjs.pulserun.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        RunRepository.load(this)
        if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 0)
        }
        setContent {
            val reachable by PhoneLink.phoneReachable.collectAsState()
            val current by RunRepository.state.collectAsState()
            var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
            LaunchedEffect(Unit) { while (true) { now = System.currentTimeMillis(); delay(250) } }
            val text = current?.let { s -> val v = s.view(now); "${s.label(v.phase.type)} ${formatClock(v.phaseRemainingMs)} r${s.revision} ${s.ended ?: ""}" }
                ?: if (reachable == true) "PulseRun ● phone" else "PulseRun ○"
            Box(Modifier.fillMaxSize().background(Color(0xFF0C0D12)), contentAlignment = Alignment.Center) {
                Text(text, color = Color(0xFF10F49C))
            }
        }
    }

    override fun onResume() {
        super.onResume()
        PhoneLink.ping(this)
        StartPrompt.hide(this)
        val state = RunRepository.state.value
        if (state != null && state.ended == null) WorkoutService.ensureRunning(this)
    }
}
