package io.github.willenjs.pulserun.wear.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import io.github.willenjs.pulserun.wear.Phase
import kotlin.math.cos
import kotlin.math.sin

private fun DrawScope.ring(color: Color, start: Float, sweep: Float, width: Float, cap: StrokeCap = StrokeCap.Butt) {
    val inset = width / 2 + 2.dp.toPx()
    drawArc(
        color = color, startAngle = start, sweepAngle = sweep, useCenter = false,
        topLeft = Offset(inset, inset), size = Size(size.width - 2 * inset, size.height - 2 * inset),
        style = Stroke(width, cap = cap),
    )
}

/** The current phase's progress, in its pace colour. */
@Composable
fun PhaseRing(progress: Float, color: Color, modifier: Modifier = Modifier) {
    Canvas(modifier.fillMaxSize()) {
        val width = 8.dp.toPx()
        ring(Pulse.track, -90f, 360f, width)
        if (progress > 0f) ring(color, -90f, 360f * progress, width, StrokeCap.Round)
    }
}

/** The whole workout as pace-coloured segments; finished ones dimmed; a dot where the runner is. */
@Composable
fun WorkoutRing(phases: List<Phase>, elapsedMs: Long, modifier: Modifier = Modifier) {
    Canvas(modifier.fillMaxSize()) {
        val width = 8.dp.toPx()
        val total = phases.last().endMs.toFloat()
        val gap = 1.5f
        ring(Pulse.track, -90f, 360f, width)
        phases.forEach { p ->
            val start = -90f + 360f * p.startMs / total
            val sweep = (360f * (p.endMs - p.startMs) / total - gap).coerceAtLeast(0.5f)
            val alpha = if (p.endMs <= elapsedMs) 0.3f else 1f
            ring(Pulse.pace(p.type).copy(alpha = alpha), start, sweep, width)
        }
        val inset = width / 2 + 2.dp.toPx()
        val radius = size.width / 2 - inset
        val angle = Math.toRadians((-90.0 + 360.0 * elapsedMs / total))
        drawCircle(
            Color.White, radius = 5.dp.toPx(),
            center = Offset(size.width / 2 + radius * cos(angle).toFloat(), size.height / 2 + radius * sin(angle).toFloat()),
        )
    }
}

/** Thin grey outline for the always-on display, the phase's progress a lighter grey over it. */
@Composable
fun AmbientRing(progress: Float, modifier: Modifier = Modifier) {
    Canvas(modifier.fillMaxSize()) {
        val width = 2.dp.toPx()
        ring(Color(0xFF444444), -90f, 360f, width)
        if (progress > 0f) ring(Color(0xFF888888), -90f, 360f * progress, width)
    }
}
