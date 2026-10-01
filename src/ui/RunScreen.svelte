<script>
  import { findWorkout } from '../core/plan.js';
  import { getState, formatClock } from '../core/timer.js';
  import { app, t, pause, resume, skip, stop, requestStop, cancelStop } from './controller.svelte.js';
  import AppHeader from './components/AppHeader.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import Icon from './components/Icon.svelte';
  import PhaseBar from './components/PhaseBar.svelte';

  const workout = $derived(app.session ? findWorkout(app.session.workoutId) : null);
  const state = $derived(workout ? getState(app.session, workout, app.now) : null);
  const phase = $derived(state ? workout.phases[state.phaseIndex] : null);
  const nextPhase = $derived(state ? workout.phases[state.phaseIndex + 1] : null);
</script>

{#if state}
  <!-- The current phase's color washes the top of the screen, readable from the treadmill. -->
  <div class="screen run phase-{phase.type}">
    <AppHeader title={t('common.weekDay', { week: workout.week, day: workout.day })} onback={requestStop} />

    <section class="progress">
      <PhaseBar {workout} currentIndex={state.phaseIndex} elapsedMs={state.elapsedMs} />
      <p class="progress-line num">
        <span>{t('run.phaseOf', { n: state.phaseIndex + 1, total: workout.phases.length })}</span>
        <span>{t('run.left', { time: formatClock(state.totalRemainingMs) })}</span>
      </p>
    </section>

    <section class="main" class:paused={state.paused}>
      <h1 class="phase-title">{t(`phaseLabel.${phase.type}`)}</h1>
      <p class="countdown num">{formatClock(state.phaseRemainingMs)}</p>
      {#if state.paused}<p class="paused-label">{t('run.paused')}</p>{/if}
      <p class="next">
        {nextPhase
          ? t('run.next', { phase: t(`phaseLabel.${nextPhase.type}`), time: formatClock(nextPhase.seconds * 1000) })
          : t('run.last')}
      </p>
    </section>

    {#if !app.audioAvailable}<p class="notice">{t('run.noAudio')}</p>{/if}

    <div class="controls">
      <button class="ctl" onclick={skip}>
        <span class="round"><Icon name="skip-phase" /></span>{t('run.skip')}
      </button>
      {#if state.paused}
        <button class="ctl main-ctl" onclick={resume}>
          <span class="round"><Icon name="play-resume" size={36} /></span>{t('run.resume')}
        </button>
      {:else}
        <button class="ctl main-ctl" onclick={pause}>
          <span class="round"><Icon name="pause" size={36} /></span>{t('run.pause')}
        </button>
      {/if}
      <button class="ctl stop" onclick={requestStop}>
        <span class="round"><Icon name="stop" /></span>{t('run.stop')}
      </button>
    </div>

    {#if app.confirmingStop}
      <ConfirmDialog
        title={t('run.stopTitle')}
        body={t('run.stopBody')}
        confirmLabel={t('run.stop')}
        cancelLabel={t('run.stopKeep')}
        onconfirm={stop}
        oncancel={cancelStop}
        danger
      />
    {/if}
  </div>
{/if}

<style>
  .run {
    gap: 20px;
    background: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--phase) 22%, var(--surface-0)),
      color-mix(in srgb, var(--phase) 6%, var(--surface-0)) 60%,
      var(--surface-0)
    );
  }

  .progress { display: flex; flex-direction: column; gap: 10px; }
  .progress-line { margin: 0; display: flex; justify-content: space-between; gap: 12px; font-size: 14px; color: var(--text-muted); }

  .main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; }
  .phase-title {
    margin: 0;
    font-family: var(--display-font);
    font-size: clamp(36px, 14vw, 56px);
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1.05;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--phase);
  }
  /* "RUN RUN RUN!" is three times longer than the other names: keep it on one line. */
  .phase-run .phase-title { font-size: clamp(28px, 10vw, 44px); }
  .countdown { margin: 0; font-size: clamp(80px, 28vw, 140px); font-weight: 700; line-height: 1; letter-spacing: -0.04em; }
  .main.paused .countdown { opacity: 0.45; }
  .paused-label { margin: 0; font-family: var(--display-font); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--jog); }
  .next { margin: 8px 0 0; font-size: 18px; color: var(--text-muted); }

  .notice { margin: 0; padding: 10px 14px; border-radius: 12px; background: var(--surface-2); color: var(--jog); font-size: 14px; }

  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px calc(12px + env(safe-area-inset-bottom));
  }
  .ctl { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); }
  .round { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 9999px; background: var(--surface-2); color: var(--text); }
  .ctl:active .round { background: var(--text); color: var(--surface-0); }
  .stop .round { color: var(--run); }
  .main-ctl .round {
    width: 96px;
    height: 96px;
    background: var(--mint);
    color: var(--on-mint);
    box-shadow: 0 0 32px -6px var(--mint-glow);
  }
  .main-ctl:active .round { background: var(--surface-0); color: var(--mint); box-shadow: inset 0 0 0 2px var(--mint); }
</style>
