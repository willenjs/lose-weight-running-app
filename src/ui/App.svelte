<script>
  import { app } from './controller.svelte.js';
  import PlanScreen from './PlanScreen.svelte';
  import WorkoutScreen from './WorkoutScreen.svelte';
  import RunScreen from './RunScreen.svelte';
  import FinishedScreen from './FinishedScreen.svelte';
</script>

<main class="app">
  {#if app.screen === 'workout'}
    <WorkoutScreen />
  {:else if app.screen === 'run'}
    <RunScreen />
  {:else if app.screen === 'finished'}
    <FinishedScreen />
  {:else}
    <PlanScreen />
  {/if}
  {#if app.toast}<div class="toast" role="status">{app.toast}</div>{/if}
</main>
