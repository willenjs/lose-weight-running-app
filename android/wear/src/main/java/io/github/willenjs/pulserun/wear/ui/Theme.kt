package io.github.willenjs.pulserun.wear.ui

import androidx.compose.ui.graphics.Color

/** Colours from src/app.css. */
object Pulse {
    val surface = Color(0xFF0C0D12)
    val surface2 = Color(0xFF1C1F2B)
    val track = Color(0xFF25293A)
    val muted = Color(0xFF8A91A8)
    val mint = Color(0xFF10F49C)
    val onMint = Color(0xFF002111)
    val walk = Color(0xFF00D2FF)
    val jog = Color(0xFFFFAB00)
    val run = Color(0xFFFF334B)

    fun pace(type: String): Color = when (type) {
        "walk" -> walk
        "jog" -> jog
        else -> run
    }
}
