<script>
  import { findWorkout, totalSeconds } from '../core/plan.js';
  import { getState, formatClock } from '../core/timer.js';
  import { app, t, pause, resume, skip, stop, requestStop, cancelStop } from './controller.svelte.js';
  import AppHeader from './components/AppHeader.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import Icon from './components/Icon.svelte';
  import PhaseBar from './components/PhaseBar.svelte';
  import StatTile from './components/StatTile.svelte';

  const workout = $derived(app.session ? findWorkout(app.session.workoutId) : null);
  const state = $derived(workout ? getState(app.session, workout, app.now) : null);
  const phase = $derived(state ? workout.phases[state.phaseIndex] : null);
  const nextPhase = $derived(state ? workout.phases[state.phaseIndex + 1] : null);
</script>

{#if state}
  <div class="screen run phase-{phase.type}">
    <AppHeader subtitle={t('common.weekDay', { week: workout.week, day: workout.day })} onback={requestStop} />

    <div class="status">
      <span class="chip">{t('common.shortWeekDay', { week: workout.week, day: workout.day })}</span>
    </div>

    <section class="card timeline">
      <div class="row">
        <span class="label phase-of">{t('run.phaseOf', { n: state.phaseIndex + 1, total: workout.phases.length })}</span>
        <span class="num elapsed">{formatClock(state.elapsedMs)} / {formatClock(totalSeconds(workout) * 1000)}</span>
      </div>
      <PhaseBar {workout} currentIndex={state.phaseIndex} elapsedMs={state.elapsedMs} />
    </section>

    <section class="card main" class:paused={state.paused}>
      <div class="phase-head">
        <span class="phase-badge"><Icon name={phase.type} size={30} /></span>
        <h1 class="phase-title">{t(`phaseLabel.${phase.type}`)}</h1>
      </div>
      <p class="countdown num">{formatClock(state.phaseRemainingMs)}</p>
      {#if state.paused}<p class="paused-label">{t('run.paused')}</p>{/if}
      <p class="next">
        {nextPhase
          ? t('run.next', { phase: t(`phaseLabel.${nextPhase.type}`), time: formatClock(nextPhase.seconds * 1000) })
          : t('run.last')}
      </p>
    </section>

    <div class="tiles">
      <StatTile label={t('run.remainingTotal')} value={formatClock(state.totalRemainingMs)} icon="total-time" />
      <StatTile
        label={t('run.phasesDone')}
        value={state.phaseIndex}
        unit={t('common.of', { total: workout.phases.length })}
        icon="phases-done"
        tone="mint"
      />
    </div>

    {#if !app.audioAvailable}<p class="notice">{t('run.noAudio')}</p>{/if}

    <div class="controls">
      <button class="ctl" onclick={skip}><Icon name="skip-phase" /><span>{t('run.skip')}</span></button>
      {#if state.paused}
        <button class="btn btn-primary" onclick={resume}><Icon name="play-resume" />{t('run.resume')}</button>
      {:else}
        <button class="btn btn-primary" onclick={pause}><Icon name="pause" />{t('run.pause')}</button>
      {/if}
      <button class="ctl stop" onclick={requestStop}><Icon name="stop" /><span>{t('run.stop')}</span></button>
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
  .status { display: flex; flex-wrap: wrap; gap: 8px; }
  .timeline { display: flex; flex-direction: column; gap: 10px; padding: 16px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .phase-of { color: var(--phase); }
  .elapsed { font-size: 13px; color: var(--text-muted); }
  .main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
    border-color: var(--phase);
    box-shadow: 0 0 24px -4px color-mix(in srgb, var(--phase) 40%, transparent);
  }
  .phase-head { display: flex; align-items: center; gap: 12px; }
  .phase-badge { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 12px; background: color-mix(in srgb, var(--phase) 18%, transparent); color: var(--phase); }
  .phase-title { margin: 0; font-family: var(--display-font); font-size: clamp(26px, 8vw, 34px); white-space: nowrap; font-weight: 700; text-transform: uppercase; color: var(--phase); }
  .countdown { margin: 0; font-size: clamp(64px, 24vw, 96px); font-weight: 700; line-height: 1; letter-spacing: -0.03em; }
  .main.paused .countdown { opacity: 0.5; }
  .paused-label { margin: 0; font-family: var(--display-font); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--jog); }
  .next { margin: 4px 0 0; font-size: 16px; color: var(--text-muted); }
  .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .notice { margin: 0; padding: 10px 14px; border-radius: 12px; background: var(--surface-2); color: var(--jog); font-size: 14px; }
  .controls { margin-top: auto; display: grid; grid-template-columns: 1fr 2fr 1fr; gap: var(--gap); align-items: stretch; }
  .ctl {
    min-height: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border-radius: var(--radius);
    background: var(--surface-1);
    box-shadow: inset 0 0 0 1.5px var(--surface-3);
    font-family: var(--display-font);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .ctl:active { background: var(--text); color: var(--surface-0); }
  .ctl.stop { color: var(--run); }
</style>
