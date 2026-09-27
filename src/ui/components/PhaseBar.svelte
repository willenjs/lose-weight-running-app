<script>
  import { totalSeconds } from '../../core/plan.js';
  import { formatClock } from '../../core/timer.js';

  /**
   * @type {{
   *   workout: import('../../core/plan.js').Workout,
   *   currentIndex?: number,
   *   times?: boolean,
   *   thin?: boolean,
   * }}
   */
  let { workout, currentIndex = -1, times = false, thin = false } = $props();
  const total = $derived(totalSeconds(workout));
</script>

<div class="phase-bar" class:thin class:marked={currentIndex >= 0}>
  <div class="segments">
    {#each workout.phases as phase, i (i)}
      <span
        class="segment phase-{phase.type}"
        class:done={i < currentIndex}
        class:current={i === currentIndex}
        style:flex-grow={phase.seconds}
      ></span>
    {/each}
  </div>
  {#if times}
    <div class="times num">
      <span>00:00</span>
      <span>{formatClock(total * 500)}</span>
      <span>{formatClock(total * 1000)}</span>
    </div>
  {/if}
</div>

<style>
  .phase-bar.marked { padding-top: 12px; }
  .segments { display: flex; gap: 4px; height: 12px; }
  .thin .segments { height: 6px; }
  .segment { position: relative; flex-basis: 0; border-radius: var(--radius-sm); background: var(--phase); }
  .segment.done { opacity: 0.3; }
  .segment.current { box-shadow: 0 0 12px 0 var(--phase); }
  .segment.current::before {
    content: '';
    position: absolute;
    left: 50%;
    top: -12px;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: var(--text);
  }
  .times { display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: var(--text-muted); }
</style>
