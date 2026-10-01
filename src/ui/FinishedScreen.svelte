<script>
  import { PLAN, findWorkout, phaseSeconds } from '../core/plan.js';
  import { isDone, programStats } from '../core/progress.js';
  import {
    app, t, goToPlan, openWorkout, unmarkWorkout, shareResult, workoutMinutes,
  } from './controller.svelte.js';
  import AppHeader from './components/AppHeader.svelte';
  import Icon from './components/Icon.svelte';

  const workout = $derived(findWorkout(app.workoutId));
  const stats = $derived(programStats(PLAN, app.progress));

  function unmarkThis() {
    unmarkWorkout(workout.id);
    openWorkout(workout.id);
  }
</script>

{#if workout}
  <div class="screen finished">
    <AppHeader title={t('common.weekDay', { week: workout.week, day: workout.day })} />

    <section class="moment">
      <span class="check"><Icon name="check" size={56} /></span>
      <h1>{t('finished.done')}</h1>
      <p class="summary num">
        {t('finished.summary', { total: workoutMinutes(workout), run: Math.round(phaseSeconds(workout).run / 60) })}
      </p>

      <div class="program">
        <!-- One dot per workout in the plan; the one just finished stands out. -->
        <ol class="dots" aria-hidden="true">
          {#each PLAN as w (w.id)}
            <li class="dot" class:done={isDone(app.progress, w.id)} class:this={w.id === workout.id}></li>
          {/each}
        </ol>
        <p class="progress-line">{t('plan.progressLine', { done: stats.done, total: stats.total })}</p>
        {#if stats.done === stats.total}<p class="all-done">{t('plan.allDone')}</p>{/if}
      </div>
    </section>

    <div class="actions">
      <button class="btn btn-primary" onclick={goToPlan}>{t('finished.doneButton')}</button>
      {#if app.canShare}
        <button class="btn btn-secondary" onclick={shareResult}><Icon name="share" size={20} />{t('finished.share')}</button>
      {/if}
      <button class="btn-link" onclick={unmarkThis}>{t('workout.unmarkDone')}</button>
    </div>
  </div>
{/if}

<style>
  .finished {
    gap: 24px;
    background: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--mint) 22%, var(--surface-0)),
      color-mix(in srgb, var(--mint) 6%, var(--surface-0)) 60%,
      var(--surface-0)
    );
  }

  .moment { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; }
  .check {
    display: grid;
    place-items: center;
    width: 112px;
    height: 112px;
    border-radius: 9999px;
    background: var(--mint);
    color: var(--on-mint);
    box-shadow: 0 0 48px -6px var(--mint-glow);
  }
  .check :global(.icon) { stroke-width: 2.4; }
  h1 {
    margin: 12px 0 0;
    font-family: var(--display-font);
    font-size: clamp(44px, 15vw, 56px);
    line-height: 1;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--mint);
  }
  .summary { margin: 0; font-size: 16px; color: var(--text-muted); }

  .program { margin-top: 28px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .dots { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .dot { width: 12px; height: 12px; border-radius: 9999px; background: var(--surface-3); }
  .dot.done { background: var(--mint); }
  .dot.this { background: var(--text); }
  .progress-line { margin: 0; font-size: 14px; color: var(--text-muted); }
  .all-done { margin: 0; font-weight: 600; color: var(--mint); }

  .actions { display: flex; flex-direction: column; gap: 10px; padding-bottom: calc(8px + env(safe-area-inset-bottom)); }
  .actions .btn-link { padding: 12px; }
</style>
