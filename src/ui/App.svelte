<script>
  import { app } from './controller.svelte.js';
  import PlanScreen from './PlanScreen.svelte';
  import WorkoutScreen from './WorkoutScreen.svelte';
</script>

<main class="app">
  {#if app.screen === 'workout'}
    <WorkoutScreen />
  {:else}
    <PlanScreen />
  {/if}
</main>
