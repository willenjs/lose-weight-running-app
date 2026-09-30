<script>
  import { findWorkout, phaseSeconds, phaseRole } from '../core/plan.js';
  import {
    app, t, formatDate, goToPlan, startWorkout, unmarkWorkout, workoutMinutes,
  } from './controller.svelte.js';
  import AppHeader from './components/AppHeader.svelte';
  import Icon from './components/Icon.svelte';
  import PhaseBar from './components/PhaseBar.svelte';

  /** @type {('walk' | 'jog' | 'run')[]} */
  const TYPES = ['walk', 'jog', 'run'];

  const workout = $derived(findWorkout(app.workoutId));
  const completedAt = $derived(app.progress.completed[app.workoutId]);
  const totals = $derived(phaseSeconds(workout));
</script>

<div class="screen">
  <AppHeader title={t('common.weekDay', { week: workout.week, day: workout.day })} onback={goToPlan} />

  <section class="summary">
    <p class="label">{t(`week.${workout.week}.title`)}</p>
    <p class="minutes num">{workoutMinutes(workout)}<span> {t('unit.min')}</span></p>
    <PhaseBar {workout} thin />
    <ul class="totals">
      {#each TYPES as type (type)}
        <li class="phase-{type}">
          <span class="dot" aria-hidden="true"></span>{t(`phase.${type}`)}
          <span class="num">{Math.round(totals[type] / 60)}</span>
        </li>
      {/each}
    </ul>
  </section>

  <!-- A completed workout reads as crossed off, like the done days on the plan. -->
  <ol class="phases" class:done={completedAt}>
    {#each workout.phases as phase, i (i)}
      <li class="phase phase-{phase.type}">
        <span class="strip" aria-hidden="true"></span>
        <span class="phase-text">
          <span class="phase-name">{t(`phase.${phase.type}`)}</span>
          <span class="phase-tip">{t(`tip.${phaseRole(workout, i)}`)}</span>
        </span>
        <span class="phase-time num">{t('workout.total', { value: Math.round(phase.seconds / 60) })}</span>
      </li>
    {/each}
  </ol>

  <p class="speed-tip"><Icon name="bolt" size={16} />{t('workout.tipText')}</p>

  <div class="sticky">
    {#if completedAt}
      <p class="completed"><Icon name="check" size={16} />{t('workout.done', { date: formatDate(completedAt) })}</p>
      <button class="btn btn-secondary" onclick={startWorkout}><Icon name="play-resume" />{t('workout.runAgain')}</button>
      <button class="btn-link" onclick={() => unmarkWorkout(workout.id)}>{t('workout.unmarkDone')}</button>
    {:else}
      <button class="btn btn-primary" onclick={startWorkout}><Icon name="play-resume" />{t('plan.start')}</button>
    {/if}
  </div>
</div>

<style>
  .screen { gap: 24px; }

  .summary { display: flex; flex-direction: column; gap: 14px; margin-top: 8px; }
  .minutes { margin: 0; font-size: 64px; font-weight: 700; line-height: 0.95; }
  .minutes span { font-size: 24px; color: var(--text-muted); }
  .totals { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 14px; color: var(--text-muted); }
  .totals li { display: flex; align-items: center; gap: 6px; }
  .totals .num { font-weight: 700; color: var(--text); }
  .dot { width: 8px; height: 8px; border-radius: 9999px; background: var(--phase); }

  .phases { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .phase { min-height: 56px; display: flex; align-items: center; gap: 14px; border-top: 1px solid var(--surface-2); }
  .strip { flex: none; width: 4px; height: 32px; border-radius: var(--radius-sm); background: var(--phase); }
  .phase-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .phase-name { font-size: 16px; font-weight: 600; }
  .phase-tip { font-size: 13px; color: var(--text-muted); }
  .phase-time { flex: none; font-size: 18px; font-weight: 700; color: var(--phase); }
  .done .phase { opacity: 0.6; }
  .done .phase-text, .done .phase-time { text-decoration: line-through; }

  .speed-tip { margin: 0; display: flex; gap: 8px; font-size: 13px; line-height: 1.45; color: var(--text-muted); }
  .speed-tip :global(.icon) { flex: none; margin-top: 2px; }

  .sticky {
    position: sticky;
    bottom: 0;
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 0 calc(8px + env(safe-area-inset-bottom));
    background: linear-gradient(to bottom, transparent, var(--surface-0) 35%);
  }
  .completed { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 0 0 8px; color: var(--mint); font-size: 14px; }
</style>
