<script>
  import { app } from './controller.svelte.js';
  import PlanScreen from './PlanScreen.svelte';
  import WorkoutScreen from './WorkoutScreen.svelte';
  import RunScreen from './RunScreen.svelte';
  import FinishedScreen from './FinishedScreen.svelte';
  import SettingsSheet from './components/SettingsSheet.svelte';
</script>

<main class="app">
  <!-- inert while the sheet is open: keeps Tab and screen readers inside it. -->
  <div class="screens" inert={app.audioSheetOpen}>
    {#if app.screen === 'workout'}
      <WorkoutScreen />
    {:else if app.screen === 'run'}
      <RunScreen />
    {:else if app.screen === 'finished'}
      <FinishedScreen />
    {:else}
      <PlanScreen />
    {/if}
  </div>
  {#if app.audioSheetOpen}<SettingsSheet />{/if}
  {#if app.toast}<div class="toast" role="status">{app.toast}</div>{/if}
</main>

<style>
  .screens { display: contents; }
</style>
