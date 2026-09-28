<script>
  import { app, setAudio, previewAudio } from '../controller.svelte.js';
  import Icon from './Icon.svelte';

  /**
   * @type {{
   *   field: 'voiceVolume' | 'beepVolume' | 'fanfareVolume',
   *   icon: string,
   *   accent: string,
   *   title: string,
   *   hint: string,
   *   tag?: string,
   *   children?: import('svelte').Snippet,
   * }}
   * accent: a CSS color (var) for the icon tile, readout and slider.
   */
  let { field, icon, accent, title, hint, tag, children } = $props();

  const value = $derived(app.settings[field]);
</script>

<section class="volume-row" class:off={value === 0} style="--accent: {accent}">
  <div class="top">
    <span class="tile"><Icon name={value === 0 ? 'volume-off' : icon} size={22} /></span>
    <span class="text">
      <strong>{title}{#if tag} <span class="tag-lang">{tag}</span>{/if}</strong>
      <span>{hint}</span>
    </span>
    <span class="readout num">{value}<small>%</small></span>
  </div>
  <input
    class="slider"
    type="range"
    min="0"
    max="100"
    step="1"
    {value}
    style="--fill: {value}%"
    aria-label={title}
    aria-valuetext="{value}%"
    oninput={(event) => previewAudio({ [field]: Number(event.currentTarget.value) })}
    onchange={(event) => setAudio({ [field]: Number(event.currentTarget.value) })}
  />
  {@render children?.()}
</section>

<style>
  .volume-row {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border-radius: var(--radius);
    background: var(--surface-2);
  }
  .top { display: flex; align-items: center; gap: 12px; }
  .tile {
    flex: none;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
  }
  .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .text strong { font-size: 17px; line-height: 1.25; }
  .text > span { font-size: 13px; color: var(--text-muted); }
  .tag-lang {
    display: inline-block;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    background: var(--surface-3);
    color: var(--walk);
    font-family: var(--display-font);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    vertical-align: middle;
  }
  .readout { flex: none; font-size: 24px; font-weight: 700; color: var(--accent); }
  .readout small { font-size: 12px; margin-left: 1px; }
  .off .tile, .off .readout { color: var(--text-muted); }
  .off .tile { background: var(--surface-3); }

  .slider { width: 100%; height: 40px; margin: 0; appearance: none; -webkit-appearance: none; background: transparent; }
  .slider::-webkit-slider-runnable-track {
    height: 10px;
    border-radius: 9999px;
    background: linear-gradient(to right, var(--accent) var(--fill), var(--surface-3) var(--fill));
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 26px;
    height: 26px;
    margin-top: -8px;
    border-radius: 9999px;
    background: var(--accent);
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 15%, transparent);
  }
  .slider::-moz-range-track { height: 10px; border-radius: 9999px; background: var(--surface-3); }
  .slider::-moz-range-progress { height: 10px; border-radius: 9999px; background: var(--accent); }
  .slider::-moz-range-thumb { width: 26px; height: 26px; border: none; border-radius: 9999px; background: var(--accent); }
  .slider:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 8px; }
</style>
