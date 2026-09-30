<script>
  import { untrack } from 'svelte';
  import { isDone } from '../../core/progress.js';
  import { app, t, openWorkout, workoutMinutes, phaseShorthand } from '../controller.svelte.js';
  import Icon from './Icon.svelte';

  /**
   * @type {{
   *   week: number,
   *   workouts: import('../../core/plan.js').Workout[],
   *   nextId: string | null,
   *   currentWeek: number | null,
   * }}
   * currentWeek is null once the whole program is done.
   */
  let { week, workouts, nextId, currentWeek } = $props();

  // Only the initial state follows the current week; the user toggles after that.
  let open = $state(untrack(() => week === currentWeek));
  const isCurrent = $derived(week === currentWeek);
</script>

<section class="week">
  <button
    class="week-head"
    class:current={isCurrent}
    aria-expanded={open}
    aria-label="{t('plan.week', { week })}: {t(`week.${week}.title`)}"
    onclick={() => (open = !open)}
  >
    <span class="number num">{week}</span>
    <span class="name">{t(`week.${week}.title`)}</span>
    <span class="dots" aria-hidden="true">
      {#each workouts as workout (workout.id)}
        <span class="dot" class:done={isDone(app.progress, workout.id)} class:next={workout.id === nextId}></span>
      {/each}
    </span>
    <span class="chevron" class:open><Icon name="expand" size={18} /></span>
  </button>

  {#if open}
    <ul class="days">
      {#each workouts as workout (workout.id)}
        {@const done = isDone(app.progress, workout.id)}
        {@const isNext = workout.id === nextId}
        <li>
          <button class="day" class:done class:next={isNext} onclick={() => openWorkout(workout.id)}>
            <span class="status">
              <Icon name={done ? 'check' : isNext ? 'play-resume' : 'circle'} size={18} />
            </span>
            <span class="day-text">
              <span class="day-title">{t('plan.day', { day: workout.day })}</span>
              <span class="day-meta num">{t('workout.total', { value: workoutMinutes(workout) })} • {phaseShorthand(workout)}</span>
            </span>
            <span class="day-state">
              {done ? t('plan.done') : isNext ? t('plan.current') : t('plan.waiting')}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .week-head {
    width: 100%;
    min-height: 56px;
    display: flex;
    align-items: center;
    gap: 16px;
    border-top: 1px solid var(--surface-2);
    text-align: left;
    color: var(--text-muted);
  }
  .week-head.current { color: var(--text); }
  .week-head:active { background: var(--surface-1); }
  .number { flex: none; width: 20px; font-size: 15px; font-weight: 700; }
  .name { flex: 1; min-width: 0; font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dots { flex: none; display: flex; gap: 6px; }
  .dot { width: 10px; height: 10px; border-radius: 9999px; background: var(--surface-3); }
  .dot.done { background: var(--mint); }
  .dot.next { background: none; box-shadow: inset 0 0 0 2px var(--mint); }
  .chevron { flex: none; display: grid; color: var(--text-muted); transition: transform 0.2s; }
  .chevron.open { transform: rotate(180deg); }

  .days { list-style: none; margin: 0; padding: 0 0 12px; display: grid; gap: 8px; }
  .day {
    width: 100%;
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 12px;
    background: var(--surface-2);
    text-align: left;
  }
  .day.next { box-shadow: inset 0 0 0 1px var(--mint); }
  .day:active { background: var(--surface-3); }
  /* Completed days read as crossed off; tapping one still opens it (to unmark). */
  .day.done { opacity: 0.6; }
  .day.done .day-text { text-decoration: line-through; color: var(--text-muted); }
  .status { flex: none; display: grid; color: var(--text-muted); }
  .day.done .status, .day.next .status { color: var(--mint); }
  .day-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .day-title { font-weight: 600; }
  .day-meta { font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .day-state {
    flex: none;
    font-family: var(--display-font);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .day.done .day-state, .day.next .day-state { color: var(--mint); }
</style>
