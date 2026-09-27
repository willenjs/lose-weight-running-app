<script>
  import Icon from './Icon.svelte';

  /**
   * @type {{
   *   label: string,
   *   value: string | number,
   *   unit?: string,
   *   caption?: string,
   *   icon?: string,
   *   tone?: 'walk' | 'jog' | 'run' | 'mint',
   * }}
   */
  let { label, value, unit = '', caption = '', icon = '', tone } = $props();
</script>

<div class="tile" style:--tone={tone ? `var(--${tone})` : 'var(--text)'}>
  <div class="head">
    <p class="label">{label}</p>
    {#if icon}<span class="icon"><Icon name={icon} size={20} /></span>{/if}
  </div>
  <p class="value num">{value}{#if unit}<span class="unit">{unit}</span>{/if}</p>
  {#if caption}<p class="caption">{caption}</p>{/if}
</div>

<style>
  .tile {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px;
    background: var(--surface-1);
    border: 1px solid var(--surface-2);
    border-radius: var(--radius);
  }
  /* Room for a two-line label keeps values aligned across a row of tiles. */
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; min-height: 28px; }
  .icon { display: grid; color: var(--tone); }
  .value { margin: 0; font-size: 28px; font-weight: 700; line-height: 1; color: var(--tone); }
  .unit { margin-left: 4px; font-size: 14px; font-weight: 500; color: var(--text-muted); }
  .caption { margin: 0; font-size: 12px; color: var(--text-muted); }
</style>
