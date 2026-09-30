<script>
  import { PLAN, groupByWeek } from '../core/plan.js';
  import { nextWorkout, programStats } from '../core/progress.js';
  import { app, t, openWorkout, workoutMinutes, exit, cancelExit } from './controller.svelte.js';
  import AppHeader from './components/AppHeader.svelte';
  import Icon from './components/Icon.svelte';
  import PhaseBar from './components/PhaseBar.svelte';
  import WeekAccordion from './components/WeekAccordion.svelte';
  import ResumeDialog from './components/ResumeDialog.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';

  const weeks = groupByWeek(PLAN);
  const next = $derived(nextWorkout(PLAN, app.progress));
  const stats = $derived(programStats(PLAN, app.progress));
</script>

<div class="screen">
  <AppHeader />

  {#if next}
    <section class="next" aria-labelledby="next-title">
      <h2 class="next-title" id="next-title">{t('common.weekDay', { week: next.week, day: next.day })}</h2>
      <p class="minutes num">{workoutMinutes(next)}<span> {t('unit.min')}</span></p>
      <PhaseBar workout={next} thin />
      <button class="btn btn-primary" onclick={() => openWorkout(next.id)}>
        <Icon name="play-resume" />{t('plan.start')}
      </button>
    </section>
  {:else}
    <section class="next all-done">
      <Icon name="trophy" size={32} />
      <h2 class="all-done-title">{t('plan.allDone')}</h2>
    </section>
  {/if}

  <section class="progress">
    <p class="progress-line">
      <span>{t('plan.progressLine', { done: stats.done, total: stats.total })}</span>
      <span>{t('plan.weekProgress', { week: stats.currentWeek, total: weeks.length })}</span>
    </p>
    <div
      class="bar"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax={stats.total}
      aria-valuenow={stats.done}
      aria-label={t('plan.progressLine', { done: stats.done, total: stats.total })}
    >
      <span style:width="{stats.percent}%"></span>
    </div>
  </section>

  <div class="weeks">
    {#each weeks as { week, workouts } (week)}
      <WeekAccordion {week} {workouts} nextId={next?.id ?? null} currentWeek={next ? stats.currentWeek : null} />
    {/each}
  </div>

  {#if app.pendingResume}<ResumeDialog />{/if}
  {#if app.confirmingExit}
    <ConfirmDialog
      title={t('exit.title')}
      body={t('exit.body')}
      confirmLabel={t('exit.leave')}
      cancelLabel={t('exit.stay')}
      onconfirm={exit}
      oncancel={cancelExit}
    />
  {/if}
</div>

<style>
  .screen { gap: 24px; }

  .next { display: flex; flex-direction: column; gap: 14px; margin-top: 8px; }
  .next-title {
    margin: 0;
    font-family: var(--display-font);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mint);
  }
  .minutes { margin: 0; font-size: 64px; font-weight: 700; line-height: 0.95; }
  .minutes span { font-size: 24px; color: var(--text-muted); }
  .next .btn { margin-top: 6px; }
  .all-done { align-items: center; text-align: center; color: var(--mint); }
  .all-done-title { margin: 0; font-family: var(--display-font); font-size: 24px; }

  .progress { display: flex; flex-direction: column; gap: 10px; }
  .progress-line { margin: 0; display: flex; justify-content: space-between; gap: 12px; font-size: 14px; color: var(--text-muted); }
  .bar { height: 4px; border-radius: 9999px; background: var(--surface-2); overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--mint); transition: width 0.4s; }

  .weeks { display: flex; flex-direction: column; }
</style>
