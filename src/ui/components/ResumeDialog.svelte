<script>
  import { findWorkout } from '../../core/plan.js';
  import { app, t, acceptResume, discardResume } from '../controller.svelte.js';

  const workout = $derived(findWorkout(app.pendingResume.workoutId));
</script>

<div class="overlay">
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="resume-title">
    <h2 id="resume-title">{t('resume.title')}</h2>
    <p>{t('resume.text', { week: workout.week, day: workout.day })}</p>
    <button class="primary" onclick={acceptResume}>{t('resume.resume')}</button>
    <button class="secondary" onclick={discardResume}>{t('resume.discard')}</button>
  </div>
</div>
