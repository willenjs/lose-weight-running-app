<script>
  import { findWorkout } from '../core/plan.js';
  import { app, t, goToPlan } from './controller.svelte.js';

  const workout = $derived(findWorkout(app.workoutId));
</script>

<div class="screen finished">
  <div class="trophy" aria-hidden="true">🏁</div>
  <h1>{t('finished.title')}</h1>
  {#if workout}<p>{t('workout.title', { week: workout.week, day: workout.day })}</p>{/if}
  <button class="primary" onclick={goToPlan}>{t('finished.back')}</button>
</div>
