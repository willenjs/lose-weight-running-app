<script>
  import { findWorkout, totalSeconds, phaseSeconds, phaseRole } from '../core/plan.js';
  import { formatClock } from '../core/timer.js';
  import {
    app, t, formatDate, goToPlan, startWorkout, unmarkWorkout, workoutMinutes, cuesSentence,
  } from './controller.svelte.js';
  import AppHeader from './components/AppHeader.svelte';
  import Icon from './components/Icon.svelte';
  import PhaseBar from './components/PhaseBar.svelte';
  import StatTile from './components/StatTile.svelte';

  /** @type {('walk' | 'jog' | 'run')[]} */
  const TYPES = ['walk', 'jog', 'run'];

  const workout = $derived(findWorkout(app.workoutId));
  const completedAt = $derived(app.progress.completed[app.workoutId]);
  const totals = $derived(phaseSeconds(workout));
  const audioNote = $derived(cuesSentence());
  const total = $derived(totalSeconds(workout));
  const weekDay = $derived(t('common.weekDay', { week: workout.week, day: workout.day }));
</script>

<div class="screen">
  <AppHeader subtitle={weekDay} onback={goToPlan} />

  <section class="card hero">
    <div class="hero-tags">
      <span class="tag">{weekDay}</span>
      <span class="chip"><Icon name="timer" size={14} />{t('workout.total', { value: workoutMinutes(workout) })}</span>
    </div>
    <h1>{t('workout.heading')}</h1>
    <p>{t(`week.${workout.week}.title`)} • {t(`week.${workout.week}.subtitle`)}</p>
  </section>

  <div class="totals">
    {#each TYPES as type (type)}
      <StatTile
        label={t(`phaseLabel.${type}`)}
        value={Math.round(totals[type] / 60)}
        unit={t('unit.min')}
        caption={t('workout.ofVolume', { percent: Math.round((totals[type] / total) * 100) })}
        tone={type}
      />
    {/each}
  </div>

  <section class="card timeline">
    <div class="row">
      <h2 class="section-title">{t('workout.timeline')}</h2>
      <span class="label">{t('workout.phaseCount', { count: workout.phases.length })}</span>
    </div>
    <PhaseBar {workout} times />
  </section>

  <h2 class="section-title">{t('workout.phasesTitle')}</h2>
  <ol class="phases">
    {#each workout.phases as phase, i (i)}
      {@const role = phaseRole(workout, i)}
      <li class="phase phase-{phase.type}">
        <span class="phase-badge"><Icon name={phase.type} size={26} /></span>
        <div class="phase-text">
          <p class="phase-label">{t('workout.phaseLabel', { n: i + 1, role: t(`role.${role}`) })}</p>
          <p class="phase-name">{t(`phaseLabel.${phase.type}`)}</p>
          <p class="phase-tip">{t(`tip.${role}`)}</p>
        </div>
        <div class="phase-side">
          <p class="phase-time num">{formatClock(phase.seconds * 1000)}</p>
          <span class="chip">{t(`pace.${phase.type}`)}</span>
        </div>
      </li>
    {/each}
  </ol>

  <section class="card note">
    <span class="note-icon"><Icon name="bolt" size={20} /></span>
    <div>
      <p class="label mint">{t('workout.tipTitle')}</p>
      <p>{t('workout.tipText')}</p>
    </div>
  </section>

  <section class="card note" class:off={!audioNote}>
    <span class="note-icon"><Icon name={audioNote ? 'speaker' : 'speaker-off'} size={20} /></span>
    <p>{audioNote ?? t('workout.voiceOff')}</p>
  </section>

  {#if completedAt}
    <p class="completed">
      <Icon name="check" size={16} />{t('workout.done', { date: formatDate(completedAt) })}
      <button class="btn-link" onclick={() => unmarkWorkout(workout.id)}>{t('workout.unmark')}</button>
    </p>
  {/if}

  <div class="sticky">
    <button class="btn btn-primary" onclick={startWorkout}><Icon name="play" />{t('workout.start')}</button>
  </div>
</div>

<style>
  .hero { display: flex; flex-direction: column; gap: 10px; background: linear-gradient(135deg, var(--surface-2), var(--surface-1)); }
  .hero-tags { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .hero h1 { margin: 0; font-family: var(--display-font); font-size: 30px; font-weight: 700; line-height: 1.1; }
  .hero p { margin: 0; font-size: 14px; color: var(--text-muted); }
  .totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .timeline { display: flex; flex-direction: column; gap: 14px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .section-title { margin: 0; font-family: var(--display-font); font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .phases { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .phase {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: var(--radius);
    background: var(--surface-1);
    border: 1px solid var(--surface-2);
    border-left: 4px solid var(--phase);
  }
  .phase-badge { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--surface-2); color: var(--phase); }
  .phase-text { flex: 1; min-width: 0; }
  .phase-text p { margin: 0; }
  .phase-label { font-family: var(--display-font); font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--phase); }
  .phase-name { font-family: var(--display-font); font-size: 22px; font-weight: 700; text-transform: uppercase; line-height: 1.15; }
  .phase-tip { font-size: 13px; color: var(--text-muted); }
  .phase-side { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  .phase-time { margin: 0; font-size: 24px; font-weight: 700; color: var(--phase); }
  .note { display: flex; gap: 12px; align-items: flex-start; }
  .note p { margin: 0; font-size: 14px; line-height: 1.45; }
  .note .label.mint { color: var(--mint); margin-bottom: 4px; }
  .note-icon { flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: var(--mint-soft); color: var(--mint); }
  .note.off .note-icon { background: var(--surface-2); color: var(--text-muted); }
  .completed { display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap; margin: 0; color: var(--mint); font-size: 14px; }
  .sticky {
    position: sticky;
    bottom: 0;
    margin-top: auto;
    padding: 12px 0 calc(8px + env(safe-area-inset-bottom));
    background: linear-gradient(to bottom, transparent, var(--surface-0) 35%);
  }
</style>
