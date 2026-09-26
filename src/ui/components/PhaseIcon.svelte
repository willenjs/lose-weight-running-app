<script>
  /** @type {{ type: 'walk' | 'jog' | 'run', big?: boolean }} */
  let { type, big = false } = $props();
  const ICONS = { walk: '🚶', jog: '🏃', run: '🔥' };
</script>

<span class="phase-icon" class:big aria-hidden="true">{ICONS[type]}</span>
