<script>
  /** @type {{ checked: boolean, label: string, onchange: (next: boolean) => void }} */
  let { checked, label, onchange } = $props();
</script>

<button class="switch" class:on={checked} role="switch" aria-checked={checked} aria-label={label} onclick={() => onchange(!checked)}>
  <span class="knob"></span>
</button>

<style>
  .switch {
    flex: none;
    width: 56px;
    height: 32px;
    padding: 4px;
    display: flex;
    border-radius: 9999px;
    background: var(--surface-3);
    transition: background 0.15s;
  }
  .knob {
    width: 24px;
    height: 24px;
    border-radius: 9999px;
    background: var(--text-muted);
    transition: transform 0.15s, background 0.15s;
  }
  .switch.on { background: var(--mint); }
  .switch.on .knob { transform: translateX(24px); background: var(--on-mint); }
  @media (prefers-reduced-motion: reduce) {
    .switch, .knob { transition: none; }
  }
</style>
