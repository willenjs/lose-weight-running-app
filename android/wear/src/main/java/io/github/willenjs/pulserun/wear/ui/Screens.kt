package io.github.willenjs.pulserun.wear.ui

import android.content.Context
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.Text
import io.github.willenjs.pulserun.wear.PhoneLink
import io.github.willenjs.pulserun.wear.RunRepository
import io.github.willenjs.pulserun.wear.RunState
import io.github.willenjs.pulserun.wear.fillNext
import io.github.willenjs.pulserun.wear.formatClock
import io.github.willenjs.pulserun.wear.formatMinutes
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val PREFS = "watch"
private const val PREF_OVERVIEW = "overview"
// How long the finish screen stays before the app closes itself.
private const val DONE_SHOWN_MS = 10_000L

@Composable
fun PulseApp(ambient: Boolean, ambientTick: Long, onFinished: () -> Unit) {
    val state by RunRepository.state.collectAsState()
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(ambient, ambientTick) {
        now = System.currentTimeMillis()
        // Interactive: refresh the countdown; ambient: the system wakes us (onUpdateAmbient → ambientTick).
        while (!ambient) {
            delay(250)
            now = System.currentTimeMillis()
        }
    }
    Box(Modifier.fillMaxSize().background(if (ambient) Color.Black else Pulse.surface)) {
        val s = state
        when {
            // Stale: the phone is gone, or the run ended long ago (no finish screen for an old run).
            s == null || s.ended == "stopped" || s.isStale(now) -> IdleScreen(s)
            s.ended == "finished" -> DoneScreen(s, onFinished)
            ambient -> AmbientScreen(s, now)
            else -> RunPager(s, now)
        }
    }
}

@Composable
private fun IdleScreen(state: RunState?) {
    val reachable by PhoneLink.phoneReachable.collectAsState()
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text("PulseRun", color = Pulse.mint, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Text(
            state?.label("idle")?.ifEmpty { null } ?: "Start a workout on your phone",
            color = Pulse.muted, fontSize = 12.sp, textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Box(Modifier.size(8.dp).clip(CircleShape).background(if (reachable == true) Pulse.mint else Pulse.track))
    }
}

@Composable
private fun DoneScreen(state: RunState, onFinished: () -> Unit) {
    LaunchedEffect(state.runId) {
        delay(DONE_SHOWN_MS)
        onFinished()
    }
    PhaseRing(1f, Pulse.mint)
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text("✓", color = Pulse.mint, fontSize = 28.sp)
        Text(state.label("done"), color = Pulse.mint, fontSize = 16.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        Text(state.title, color = Pulse.muted, fontSize = 11.sp)
    }
}

@Composable
private fun AmbientScreen(state: RunState, now: Long) {
    val view = state.view(now)
    AmbientRing(view.phaseProgress)
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            (if (view.paused) state.label("paused") else state.label(view.phase.type)).uppercase(),
            color = Color(0xFFBBBBBB), fontSize = 13.sp,
        )
        // Whole minutes: the system redraws the ambient screen about once a minute.
        Text(formatMinutes(view.phaseRemainingMs), color = Color(0xFFBBBBBB), fontSize = 38.sp)
    }
}

@Composable
private fun RunPager(state: RunState, now: Long) {
    val context = LocalContext.current
    val pager = rememberPagerState { 2 }
    val scope = rememberCoroutineScope()
    var confirmingStop by remember { mutableStateOf(false) }
    val unreachable by RunRepository.unreachable.collectAsState()
    if (confirmingStop) {
        StopConfirm(state, onKeep = { confirmingStop = false }, onStop = {
            confirmingStop = false
            RunRepository.send(context, "stop")
        })
        return
    }
    HorizontalPager(pager, Modifier.fillMaxSize()) { page ->
        if (page == 0) RunPage(state, now) else ControlsPage(state, onSkip = {
            RunRepository.send(context, "skip")
            // Back to the countdown so the new phase shows at once.
            scope.launch { pager.animateScrollToPage(0) }
        }, onStop = { confirmingStop = true })
    }
    PageDots(pager.currentPage)
    if (unreachable) {
        Box(Modifier.fillMaxSize().padding(bottom = 26.dp), contentAlignment = Alignment.BottomCenter) {
            Text(state.label("unreachable"), color = Pulse.run, fontSize = 11.sp, textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun RunPage(state: RunState, now: Long) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences(PREFS, Context.MODE_PRIVATE) }
    var overviewChosen by remember { mutableStateOf(prefs.getBoolean(PREF_OVERVIEW, false)) }
    val view = state.view(now)
    val overview = view.paused || overviewChosen
    val pace = Pulse.pace(view.phase.type)
    Box(
        Modifier.fillMaxSize().pointerInput(Unit) {
            detectTapGestures(onDoubleTap = {
                overviewChosen = !overviewChosen
                prefs.edit().putBoolean(PREF_OVERVIEW, overviewChosen).apply()
            })
        },
    ) {
        if (overview) WorkoutRing(state.phases, view.elapsedMs) else PhaseRing(view.phaseProgress, pace)
        Column(Modifier.fillMaxSize().padding(top = 34.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                (if (view.paused) state.label("paused") else state.label(view.phase.type)).uppercase(),
                color = if (view.paused) Pulse.muted else pace, fontSize = 13.sp, fontWeight = FontWeight.Bold,
            )
            Text(
                formatClock(view.phaseRemainingMs),
                color = if (view.paused) Pulse.muted else Color.White, fontSize = 40.sp, fontWeight = FontWeight.Bold,
            )
            val subline = when {
                view.paused -> "${state.label(view.phase.type)} · ${state.label("remainingTotal")} ${formatClock(view.totalRemainingMs)}"
                overview -> "${state.label("remainingTotal")} ${formatClock(view.totalRemainingMs)}"
                view.next != null -> fillNext(state.label("next"), state.label(view.next.type), formatClock(view.next.endMs - view.next.startMs))
                else -> state.label("last")
            }
            Text(subline, color = Pulse.muted, fontSize = 11.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 20.dp))
            Spacer(Modifier.height(6.dp))
            RoundButton(Pulse.mint, onClick = { RunRepository.send(context, if (view.paused) "resume" else "pause") }) {
                if (view.paused) PlayIcon(Pulse.onMint) else PauseIcon(Pulse.onMint)
            }
        }
    }
}

@Composable
private fun ControlsPage(state: RunState, onSkip: () -> Unit, onStop: () -> Unit) {
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        LabeledButton(state.label("skip"), onSkip) { SkipIcon(Color.White) }
        Spacer(Modifier.height(12.dp))
        LabeledButton(state.label("stop"), onStop) { StopIcon(Color.White) }
    }
}

@Composable
private fun StopConfirm(state: RunState, onKeep: () -> Unit, onStop: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(22.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(state.label("stopTitle"), color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        Text(state.label("stopBody"), color = Pulse.muted, fontSize = 11.sp, textAlign = TextAlign.Center)
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Top) {
            ChoiceButton(state.label("stopKeep"), Pulse.surface2, onKeep) { Text("✕", color = Color.White, fontSize = 14.sp) }
            ChoiceButton(state.label("stop"), Pulse.run, onStop) { Text("✓", color = Color.White, fontSize = 14.sp) }
        }
    }
}

/** A round button with its label underneath (the stop confirm's Keep going / Stop). */
@Composable
private fun ChoiceButton(label: String, color: Color, onClick: () -> Unit, icon: @Composable () -> Unit) {
    Column(Modifier.width(72.dp).clickable(onClick = onClick), horizontalAlignment = Alignment.CenterHorizontally) {
        RoundButton(color, onClick = onClick, content = icon)
        Spacer(Modifier.height(4.dp))
        Text(label, color = Color.White, fontSize = 10.sp, lineHeight = 12.sp, textAlign = TextAlign.Center, maxLines = 2)
    }
}

@Composable
private fun LabeledButton(label: String, onClick: () -> Unit, icon: @Composable () -> Unit) {
    Row(Modifier.clickable(onClick = onClick), verticalAlignment = Alignment.CenterVertically) {
        RoundButton(Pulse.surface2, onClick = onClick, content = icon)
        Spacer(Modifier.width(8.dp))
        Text(label, color = Color.White, fontSize = 13.sp)
    }
}

@Composable
private fun RoundButton(color: Color, onClick: () -> Unit, content: @Composable () -> Unit) {
    Box(Modifier.size(40.dp).clip(CircleShape).background(color).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        content()
    }
}

@Composable
private fun PageDots(current: Int) {
    Row(Modifier.fillMaxSize().padding(bottom = 10.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.Bottom) {
        repeat(2) { i ->
            Box(Modifier.padding(horizontal = 3.dp).size(5.dp).clip(CircleShape).background(if (i == current) Color.White else Pulse.muted))
        }
    }
}

@Composable
private fun PauseIcon(color: Color) = Canvas(Modifier.size(14.dp)) {
    val bar = size.width / 3
    drawRect(color, topLeft = Offset(0f, 0f), size = androidx.compose.ui.geometry.Size(bar, size.height))
    drawRect(color, topLeft = Offset(size.width - bar, 0f), size = androidx.compose.ui.geometry.Size(bar, size.height))
}

@Composable
private fun PlayIcon(color: Color) = Canvas(Modifier.size(14.dp)) {
    drawPath(Path().apply { moveTo(0f, 0f); lineTo(size.width, size.height / 2); lineTo(0f, size.height); close() }, color)
}

@Composable
private fun SkipIcon(color: Color) = Canvas(Modifier.size(14.dp)) {
    val bar = size.width / 5
    drawPath(Path().apply { moveTo(0f, 0f); lineTo(size.width - bar, size.height / 2); lineTo(0f, size.height); close() }, color)
    drawRect(color, topLeft = Offset(size.width - bar, 0f), size = androidx.compose.ui.geometry.Size(bar, size.height))
}

@Composable
private fun StopIcon(color: Color) = Canvas(Modifier.size(12.dp)) { drawRect(color) }
