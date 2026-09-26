<script>
  import { findWorkout } from '../core/plan.js';
  import { getState, formatClock } from '../core/timer.js';
  import { app, t, pause, resume, skip, stop } from './controller.svelte.js';
  import PhaseIcon from './components/PhaseIcon.svelte';

  const workout = $derived(app.session ? findWorkout(app.session.workoutId) : null);
  const state = $derived(workout ? getState(app.session, workout, app.now) : null);
  const phase = $derived(state ? workout.phases[state.phaseIndex] : null);
  const nextPhase = $derived(state ? workout.phases[state.phaseIndex + 1] : null);
  const percent = $derived(state ? (state.elapsedMs / (state.elapsedMs + state.totalRemainingMs)) * 100 : 0);

  function confirmStop() {
    if (confirm(t('run.stopConfirm'))) stop();
  }
</script>

{#if state}
  <div class="run phase-{phase.type}">
    <p class="run-label">{t('workout.title', { week: workout.week, day: workout.day })}</p>

    <div class="current">
      <PhaseIcon type={phase.type} big />
      <h1 class="run-phase">{t(`phase.${phase.type}`)}</h1>
      <p class="countdown" class:paused={state.paused}>{formatClock(state.phaseRemainingMs)}</p>
      {#if state.paused}<p class="paused-label">{t('run.paused')}</p>{/if}
    </div>

    <p class="next">
      {nextPhase
        ? t('run.next', { phase: t(`phase.${nextPhase.type}`), time: formatClock(nextPhase.seconds * 1000) })
        : t('run.last')}
    </p>
    <div class="bar"><div class="bar-fill" style:width="{percent}%"></div></div>
    <p class="remaining">{t('run.remaining', { time: formatClock(state.totalRemainingMs) })}</p>

    {#if !app.audioAvailable}<p class="notice">{t('run.noAudio')}</p>{/if}

    <div class="controls">
      {#if state.paused}
        <button class="primary" onclick={resume}>{t('run.resume')}</button>
      {:else}
        <button class="primary" onclick={pause}>{t('run.pause')}</button>
      {/if}
      <button class="secondary" onclick={skip}>{t('run.skip')}</button>
      <button class="secondary danger" onclick={confirmStop}>{t('run.stop')}</button>
    </div>
  </div>
{/if}
