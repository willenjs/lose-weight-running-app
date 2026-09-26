<script>
  import { PLAN, groupByWeek, totalSeconds } from '../core/plan.js';
  import { isDone, nextWorkout } from '../core/progress.js';
  import { app, t, openWorkout, setLang } from './controller.svelte.js';

  const weeks = groupByWeek(PLAN);
  const next = $derived(nextWorkout(PLAN, app.progress));
  const otherLang = $derived(app.lang === 'pt' ? 'en' : 'pt');
</script>

<div class="screen">
  <header class="plan-header">
    <h1>{t('app.title')}</h1>
    <button class="lang" onclick={() => setLang(otherLang)}>{t('lang.switch')}</button>
  </header>

  {#if next}
    <button class="primary" onclick={() => openWorkout(next.id)}>
      {t('plan.continue', { week: next.week, day: next.day })}
    </button>
  {:else}
    <p class="all-done">{t('plan.allDone')}</p>
  {/if}

  {#each weeks as { week, workouts } (week)}
    <section class="week">
      <h2>{t('plan.week', { week })}</h2>
      <div class="days">
        {#each workouts as workout (workout.id)}
          {@const done = isDone(app.progress, workout.id)}
          <button
            class="day"
            class:done
            class:next={next?.id === workout.id}
            onclick={() => openWorkout(workout.id)}
          >
            <span class="day-label">{t('plan.day', { day: workout.day })}</span>
            <span class="day-total">{t('workout.total', { value: Math.round(totalSeconds(workout) / 60) })}</span>
            {#if done}<span class="check" title={t('plan.done')}>✓</span>{/if}
          </button>
        {/each}
      </div>
    </section>
  {/each}
</div>
