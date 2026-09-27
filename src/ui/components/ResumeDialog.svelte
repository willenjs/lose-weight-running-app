<script>
  import { findWorkout } from '../../core/plan.js';
  import { app, t, acceptResume, discardResume } from '../controller.svelte.js';
  import ConfirmDialog from './ConfirmDialog.svelte';

  const workout = $derived(findWorkout(app.pendingResume.workoutId));
</script>

<ConfirmDialog
  title={t('resume.title')}
  body={t('resume.text', { week: workout.week, day: workout.day })}
  confirmLabel={t('resume.resume')}
  cancelLabel={t('resume.discard')}
  onconfirm={acceptResume}
  oncancel={discardResume}
/>
