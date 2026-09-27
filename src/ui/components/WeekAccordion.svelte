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
  const doneCount = $derived(workouts.filter((w) => isDone(app.progress, w.id)).length);
  const allDone = $derived(doneCount === workouts.length);
  const isCurrent = $derived(week === currentWeek);
  const locked = $derived(currentWeek !== null && week > currentWeek);
</script>

<section class="week" class:current={isCurrent}>
  <button class="week-head" aria-expanded={open} onclick={() => (open = !open)}>
    <span class="badge num" class:done={allDone} class:current={isCurrent && !allDone}>
      {#if allDone}<Icon name="check" size={20} />{:else if locked}<Icon name="lock" size={18} />{:else}{week}{/if}
    </span>
    <span class="week-text">
      <span class="week-title">{t('plan.week', { week })}: {t(`week.${week}.title`)}</span>
      <span class="week-sub" class:live={isCurrent}>
        {isCurrent ? t('plan.inProgress') : t(`week.${week}.subtitle`)}
      </span>
    </span>
    <span class="count num">{doneCount}/{workouts.length}</span>
    <span class="chevron" class:open><Icon name="chevron" size={20} /></span>
  </button>

  {#if open}
    <ul class="days">
      {#each workouts as workout (workout.id)}
        {@const done = isDone(app.progress, workout.id)}
        {@const isNext = workout.id === nextId}
        <li>
          <button class="day" class:next={isNext} onclick={() => openWorkout(workout.id)}>
            <span class="status" class:done class:next={isNext}>
              <Icon name={done ? 'check' : isNext ? 'play' : 'circle'} size={18} />
            </span>
            <span class="day-text">
              <span class="day-title">{t('plan.day', { day: workout.day })}</span>
              <span class="day-meta num">{t('workout.total', { value: workoutMinutes(workout) })} • {phaseShorthand(workout)}</span>
            </span>
            <span class="day-state" class:done class:next={isNext}>
              {done ? t('plan.done') : isNext ? t('plan.current') : t('plan.waiting')}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .week { background: var(--surface-1); border: 1px solid var(--surface-2); border-radius: var(--radius); overflow: hidden; }
  .week.current { border-color: var(--mint); box-shadow: 0 0 24px -4px var(--mint-glow); }
  .week-head { width: 100%; min-height: 72px; display: flex; align-items: center; gap: 12px; padding: 12px 16px; text-align: left; }
  .week-head:active { background: var(--surface-2); }
  .badge {
    flex: none;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 9999px;
    background: var(--surface-2);
    color: var(--text-muted);
    font-size: 18px;
    font-weight: 700;
  }
  .badge.done { background: var(--mint-soft); color: var(--mint); }
  .badge.current { background: var(--mint); color: var(--on-mint); }
  .week-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .week-title {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: normal;
    font-family: var(--display-font);
    font-size: 17px;
    font-weight: 700;
  }
  .week-sub { white-space: normal; font-size: 13px; color: var(--text-muted); }
  .week-sub.live { color: var(--mint); font-weight: 600; }
  .count { flex: none; font-size: 13px; color: var(--text-muted); }
  .chevron { flex: none; display: grid; color: var(--text-muted); transition: transform 0.2s; }
  .chevron.open { transform: rotate(180deg); }
  .days { list-style: none; margin: 0; padding: 0 12px 12px; display: grid; gap: 8px; }
  .day {
    width: 100%;
    min-height: 60px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--surface-2);
    text-align: left;
  }
  .day.next { box-shadow: inset 0 0 0 1px var(--mint); }
  .day:active { background: var(--surface-3); }
  .status { flex: none; display: grid; color: var(--text-muted); }
  .status.done, .status.next { color: var(--mint); }
  .day-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .day-title { font-weight: 600; }
  .day-meta { font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .day-state { flex: none; font-family: var(--display-font); font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); }
  .day-state.done, .day-state.next { color: var(--mint); }
</style>
