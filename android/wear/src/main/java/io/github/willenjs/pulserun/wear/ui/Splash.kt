package io.github.willenjs.pulserun.wear.ui

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.wear.compose.material3.Text
import io.github.willenjs.pulserun.wear.R
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// Matches the phone splash timing (src/platform/splash.js).
const val SPLASH_MS = 3000L
private const val PULSE_MS = 2400
private val pulseEasing = CubicBezierEasing(0.2f, 0.6f, 0.3f, 1f)

/**
 * The launch splash from the design canvas (384px round artboard): logo at the
 * dial's centre with two dim pulse rings, name centred in the space below it.
 * Sizes are fractions of the dial so it holds on every watch size.
 */
@Composable
fun SplashScreen(onDone: () -> Unit) {
    val context = LocalContext.current
    val motion = remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f
    }
    val logoIn = remember { Animatable(if (motion) 0f else 1f) }
    val nameIn = remember { Animatable(if (motion) 0f else 1f) }
    LaunchedEffect(Unit) {
        launch { logoIn.animateTo(1f, tween(500, easing = FastOutSlowInEasing)) }
        launch { nameIn.animateTo(1f, tween(600, delayMillis = 250, easing = FastOutSlowInEasing)) }
        delay(SPLASH_MS)
        onDone()
    }
    val pulse = rememberInfiniteTransition(label = "pulse")
    val t by pulse.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(PULSE_MS, easing = LinearEasing), RepeatMode.Restart),
        label = "pulse-t",
    )

    BoxWithConstraints(Modifier.fillMaxSize().background(Color.Black)) {
        val dial = maxWidth
        val ringArea = dial * 0.4375f
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            if (motion) {
                Canvas(Modifier.size(ringArea)) {
                    val base = size.minDimension / 2f
                    // Two rings half a cycle apart; each grows to 1.7x and fades out.
                    for (offset in floatArrayOf(0f, 0.5f)) {
                        val p = pulseEasing.transform((t + offset) % 1f)
                        drawCircle(
                            color = Pulse.mint,
                            radius = base * (1f + 0.7f * p),
                            alpha = 0.28f * (1f - p) * logoIn.value,
                            style = Stroke(width = 1.dp.toPx()),
                        )
                    }
                }
            }
            Image(
                painter = painterResource(R.drawable.logo),
                contentDescription = null,
                modifier = Modifier.width(dial * 0.323f).alpha(logoIn.value).scale(0.9f + 0.1f * logoIn.value),
            )
        }
        val nameSize = with(LocalDensity.current) { (dial * 0.068f).toSp() }
        Text(
            text = buildAnnotatedString {
                append("Pulse")
                withStyle(SpanStyle(color = Pulse.mint)) { append("Run") }
            },
            color = Color.White,
            fontSize = nameSize,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.03).em,
            textAlign = TextAlign.Center,
            maxLines = 1,
            modifier = Modifier
                .fillMaxWidth()
                .offset(y = maxHeight * 0.755f + 12.dp * (1f - nameIn.value))
                .alpha(nameIn.value),
        )
    }
}
