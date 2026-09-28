<script>
  import { totalSeconds } from '../../core/plan.js';
  import { formatClock } from '../../core/timer.js';

  // Space between segments; the playhead position compensates for it.
  const GAP_PX = 4;

  /**
   * @type {{
   *   workout: import('../../core/plan.js').Workout,
   *   currentIndex?: number,
   *   elapsedMs?: number | null,
   *   times?: boolean,
   *   thin?: boolean,
   * }}
   * elapsedMs: when set, a playhead moves from the left edge (start) to the right edge (end).
   */
  let { workout, currentIndex = -1, elapsedMs = null, times = false, thin = false } = $props();
  const total = $derived(totalSeconds(workout));
  const fraction = $derived(elapsedMs === null ? 0 : Math.min(1, Math.max(0, elapsedMs / (total * 1000))));
  // Segments share (100% - gaps) in proportion to their seconds, so the time
  // fraction maps onto that width plus one gap per segment already passed.
  const playheadLeft = $derived(
    `calc(${fraction} * (100% - ${(workout.phases.length - 1) * GAP_PX}px) + ${Math.max(0, currentIndex) * GAP_PX}px)`,
  );
</script>

<div class="phase-bar" class:thin class:marked={elapsedMs !== null}>
  <div class="track">
    <div class="segments" style:gap="{GAP_PX}px">
      {#each workout.phases as phase, i (i)}
        <span
          class="segment phase-{phase.type}"
          class:done={i < currentIndex}
          class:current={i === currentIndex}
          style:flex-grow={phase.seconds}
        ></span>
      {/each}
    </div>
    {#if elapsedMs !== null}<span class="playhead" style:left={playheadLeft}></span>{/if}
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
  .track { position: relative; }
  .segments { display: flex; height: 12px; }
  .thin .segments { height: 6px; }
  .segment { flex-basis: 0; border-radius: var(--radius-sm); background: var(--phase); }
  .segment.done { opacity: 0.3; }
  .segment.current { box-shadow: 0 0 12px 0 var(--phase); }
  .playhead {
    position: absolute;
    top: -12px;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: var(--text);
    /* Matches the UI refresh rate so the arrow glides instead of jumping. */
    transition: left 250ms linear;
  }
  .times { display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: var(--text-muted); }
</style>
