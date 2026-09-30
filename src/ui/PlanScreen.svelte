<script>
  import { PLAN, groupByWeek } from '../core/plan.js';
  import { nextWorkout, programStats } from '../core/progress.js';
  import { app, t, openWorkout, workoutMinutes, phaseShorthand, exit, cancelExit } from './controller.svelte.js';
  import AppHeader from './components/AppHeader.svelte';
  import Icon from './components/Icon.svelte';
  import PhaseBar from './components/PhaseBar.svelte';
  import WeekAccordion from './components/WeekAccordion.svelte';
  import ResumeDialog from './components/ResumeDialog.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';

  const RING_RADIUS = 34;
  const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

  const weeks = groupByWeek(PLAN);
  const next = $derived(nextWorkout(PLAN, app.progress));
  const stats = $derived(programStats(PLAN, app.progress));
</script>

<div class="screen">
  <AppHeader subtitle={t('app.subtitle')} />

  <section class="card progress">
    <div class="ring">
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle class="track" cx="40" cy="40" r={RING_RADIUS} />
        <circle
          class="fill"
          cx="40"
          cy="40"
          r={RING_RADIUS}
          stroke-dasharray={RING_LENGTH}
          stroke-dashoffset={RING_LENGTH * (1 - stats.percent / 100)}
        />
      </svg>
      <span class="ring-value num">{stats.percent}%</span>
    </div>
    <div class="progress-body">
      <p class="label">{t('plan.progressLabel')}</p>
      <p class="done num">{stats.done}<span> / {stats.total}</span></p>
      <p class="label">{t('plan.workoutsDone')}</p>
      <div class="pair">
        <div>
          <p class="label">{t('plan.totalTime')}</p>
          <p class="value num">{t('workout.total', { value: stats.doneMinutes })}</p>
        </div>
        <div>
          <p class="label">{t('plan.currentWeek')}</p>
          <p class="value num">{t('plan.weekOf', { week: stats.currentWeek, total: weeks.length })}</p>
        </div>
      </div>
    </div>
  </section>

  {#if next}
    <section class="card next">
      <div class="next-head">
        <span class="tag">{t('plan.next')}</span>
        <span class="chip"><Icon name="total-time" size={14} />{t('workout.total', { value: workoutMinutes(next) })}</span>
      </div>
      <h2 class="next-title">{t('common.weekDay', { week: next.week, day: next.day })}</h2>
      <p class="shorthand num">{phaseShorthand(next)}</p>
      <PhaseBar workout={next} thin />
      <button class="btn btn-primary" onclick={() => openWorkout(next.id)}>
        <Icon name="play-resume" />{t('plan.start', { week: next.week, day: next.day })}
      </button>
    </section>
  {:else}
    <section class="card next all-done">
      <Icon name="trophy" size={32} />
      <h2 class="next-title">{t('plan.allDone')}</h2>
    </section>
  {/if}

  <div class="section-head">
    <h2>{t('plan.cycle')}</h2>
    <span class="label">{t('plan.perWeek')}</span>
  </div>

  {#each weeks as { week, workouts } (week)}
    <WeekAccordion {week} {workouts} nextId={next?.id ?? null} currentWeek={next ? stats.currentWeek : null} />
  {/each}

  <section class="card goal">
    <span class="goal-icon"><Icon name="milestone" /></span>
    <div>
      <h3>{t('plan.goalTitle')}</h3>
      <p>{t('plan.goalText')}</p>
    </div>
  </section>

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
  .progress { display: flex; align-items: center; gap: 20px; }
  .ring { position: relative; flex: none; width: 96px; height: 96px; }
  .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .ring circle { fill: none; stroke-width: 8; }
  .track { stroke: var(--surface-3); }
  .fill { stroke: var(--mint); stroke-linecap: round; transition: stroke-dashoffset 0.4s; }
  .ring-value { position: absolute; inset: 0; display: grid; place-items: center; font-size: 22px; font-weight: 700; }
  .progress-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .done { margin: 0; font-size: 32px; font-weight: 700; line-height: 1; color: var(--mint); }
  .done span { font-size: 18px; color: var(--text-muted); }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
  .value { margin: 2px 0 0; font-size: 16px; font-weight: 700; }

  .next { display: flex; flex-direction: column; gap: 12px; border-color: var(--mint); box-shadow: 0 0 24px -4px var(--mint-glow); }
  .next-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .next-title { margin: 0; font-family: var(--display-font); font-size: 28px; font-weight: 700; line-height: 1.1; }
  .shorthand { margin: 0; font-size: 13px; color: var(--text-muted); }
  .all-done { align-items: center; text-align: center; color: var(--mint); }

  .section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-top: 8px; }
  .section-head h2 { margin: 0; font-family: var(--display-font); font-size: 20px; }

  .goal { display: flex; gap: 14px; align-items: flex-start; }
  .goal-icon { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: var(--mint-soft); color: var(--mint); }
  .goal h3 { margin: 0 0 4px; font-family: var(--display-font); font-size: 16px; }
  .goal p { margin: 0; font-size: 14px; line-height: 1.45; color: var(--text-muted); }
</style>
