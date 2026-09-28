<script>
  import { PLAN, findWorkout, phaseSeconds } from '../core/plan.js';
  import { nextWorkout, programStats } from '../core/progress.js';
  import {
    app, t, goToPlan, openWorkout, unmarkWorkout, shareResult, workoutMinutes, phaseShorthand,
  } from './controller.svelte.js';
  import AppHeader from './components/AppHeader.svelte';
  import Icon from './components/Icon.svelte';
  import StatTile from './components/StatTile.svelte';

  const workout = $derived(findWorkout(app.workoutId));
  const stats = $derived(programStats(PLAN, app.progress));
  const next = $derived(nextWorkout(PLAN, app.progress));

  function unmarkThis() {
    unmarkWorkout(workout.id);
    openWorkout(workout.id);
  }
</script>

{#if workout}
  <div class="screen">
    <AppHeader subtitle={t('common.weekDay', { week: workout.week, day: workout.day })} />

    <section class="card hero">
      <div class="trophy">
        <Icon name="trophy" size={40} />
        <span class="badge"><Icon name="check" size={16} /></span>
      </div>
      <span class="tag">{t('finished.badge')}</span>
      <h1>{t('finished.title')}</h1>
      <p>{t('finished.subtitle', { week: workout.week, day: workout.day })}</p>
    </section>

    <div class="grid">
      <StatTile label={t('finished.totalTime')} value={workoutMinutes(workout)} unit={t('unit.min')} icon="total-time" tone="mint" />
      <StatTile
        label={t('finished.phases')}
        value={workout.phases.length}
        unit={t('common.of', { total: workout.phases.length })}
        icon="phases-done"
      />
      <StatTile
        label={t('finished.runTime')}
        value={Math.round(phaseSeconds(workout).run / 60)}
        unit={t('unit.min')}
        icon="run-sprint"
        tone="run"
      />
      <StatTile label={t('finished.overall')} value={stats.done} unit={t('common.of', { total: stats.total })} icon="milestone" />
    </div>

    <section class="card program">
      <div class="row">
        <span class="label">{t('finished.programProgress', { done: stats.done, total: stats.total })}</span>
        <span class="num pct">{stats.percent}%</span>
      </div>
      <div class="bar"><div class="bar-fill" style:width="{stats.percent}%"></div></div>
    </section>

    <section class="card next-step">
      <p class="label">{t('finished.nextStep')}</p>
      {#if next}
        <button class="next-card" onclick={() => openWorkout(next.id)}>
          <span class="next-icon"><Icon name="calendar" /></span>
          <span class="next-text">
            <strong>{t('common.weekDay', { week: next.week, day: next.day })}</strong>
            <span class="num">{t('workout.total', { value: workoutMinutes(next) })} • {phaseShorthand(next)}</span>
          </span>
          <span class="next-chevron"><Icon name="expand" size={20} /></span>
        </button>
      {:else}
        <p class="all-done">{t('plan.allDone')}</p>
      {/if}
    </section>

    <div class="actions">
      <button class="btn btn-primary" onclick={goToPlan}>{t('finished.back')}<Icon name="back" size={20} /></button>
      {#if app.canShare}
        <button class="btn btn-secondary" onclick={shareResult}><Icon name="share" size={20} />{t('finished.share')}</button>
      {/if}
      <button class="btn-link" onclick={unmarkThis}>{t('finished.unmark')}</button>
    </div>
  </div>
{/if}

<style>
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
    background: radial-gradient(circle at 50% 0%, rgb(16 244 156 / 0.14), var(--surface-1) 70%);
  }
  .trophy {
    position: relative;
    display: grid;
    place-items: center;
    width: 88px;
    height: 88px;
    border-radius: 9999px;
    background: var(--surface-2);
    color: var(--mint);
    box-shadow: 0 0 0 12px rgb(16 244 156 / 0.08);
  }
  .badge {
    position: absolute;
    right: -2px;
    bottom: -2px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 9999px;
    background: var(--mint);
    color: var(--on-mint);
  }
  .hero h1 { margin: 0; font-family: var(--display-font); font-size: 30px; font-weight: 700; line-height: 1.15; }
  .hero p { margin: 0; font-size: 14px; color: var(--text-muted); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .program { display: flex; flex-direction: column; gap: 10px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .pct { color: var(--mint); font-weight: 700; }
  .bar { height: 8px; border-radius: 9999px; background: var(--surface-3); overflow: hidden; }
  .bar-fill { height: 100%; background: var(--mint); border-radius: 9999px; }
  .next-step { display: flex; flex-direction: column; gap: 10px; }
  .next-card { display: flex; align-items: center; gap: 12px; min-height: 60px; text-align: left; }
  .next-card:active { background: var(--surface-2); }
  .next-chevron { flex: none; display: grid; transform: rotate(-90deg); }
  .next-icon { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--surface-2); color: var(--walk); }
  .next-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .next-text strong { font-family: var(--display-font); font-size: 18px; }
  .next-text span { font-size: 13px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .all-done { margin: 0; color: var(--mint); font-weight: 600; }
  .actions { display: flex; flex-direction: column; gap: 12px; margin-top: auto; }
  .actions .btn-primary :global(.icon) { transform: rotate(180deg); }
</style>
