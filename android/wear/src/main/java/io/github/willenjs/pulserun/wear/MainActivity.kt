package io.github.willenjs.pulserun.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.wear.compose.material3.Text

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val reachable by PhoneLink.phoneReachable.collectAsState()
            Box(Modifier.fillMaxSize().background(Color(0xFF0C0D12)), contentAlignment = Alignment.Center) {
                Text(
                    when (reachable) {
                        null -> "PulseRun…"
                        true -> "PulseRun ● phone"
                        false -> "PulseRun ○ no phone"
                    },
                    color = Color(0xFF10F49C),
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        PhoneLink.ping(this)
    }
}
