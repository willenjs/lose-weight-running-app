<script>
  import { findWorkout, totalSeconds } from '../core/plan.js';
  import { formatClock } from '../core/timer.js';
  import { app, t, formatDate, goToPlan, startWorkout, unmarkWorkout } from './controller.svelte.js';
  import PhaseIcon from './components/PhaseIcon.svelte';

  const workout = $derived(findWorkout(app.workoutId));
  const completedAt = $derived(app.progress.completed[app.workoutId]);
</script>

<div class="screen">
  <button class="back" onclick={goToPlan} aria-label={t('workout.back')}>‹</button>
  <h1 class="title">{t('workout.title', { week: workout.week, day: workout.day })}</h1>
  <h2 class="subtitle">{t('app.title')}</h2>
  <p class="total">⏳ {t('workout.total', { value: Math.round(totalSeconds(workout) / 60) })}</p>

  <ul class="phases">
    {#each workout.phases as phase, i (i)}
      <li>
        <PhaseIcon type={phase.type} />
        <span class="phase-name">{t(`phase.${phase.type}`)}</span>
        <span class="phase-time">⏱ {formatClock(phase.seconds * 1000)}</span>
      </li>
    {/each}
  </ul>

  {#if completedAt}
    <p class="done-note">
      {t('workout.done', { date: formatDate(completedAt) })}
      <button class="link" onclick={() => unmarkWorkout(workout.id)}>{t('workout.unmark')}</button>
    </p>
  {/if}

  <button class="primary bottom" onclick={startWorkout}>{t('workout.start')}</button>
</div>
