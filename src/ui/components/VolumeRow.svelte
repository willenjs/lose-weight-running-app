<script>
  import { app, t, setAudio, previewAudio, testAudio } from '../controller.svelte.js';
  import Icon from './Icon.svelte';

  /**
   * @type {{
   *   field: 'voiceVolume' | 'beepVolume' | 'fanfareVolume',
   *   accent: string,
   *   title: string,
   * }}
   * accent: a CSS color (var) for the slider and the test button.
   */
  let { field, accent, title } = $props();

  const value = $derived(app.settings[field]);
  const testing = $derived(app.audioTesting === field);
  const id = $derived(`volume-${field}`);
</script>

<div class="volume-row" class:off={value === 0} style="--accent: {accent}">
  <label for={id}>{title}</label>
  <input
    {id}
    class="slider"
    type="range"
    min="0"
    max="100"
    step="1"
    {value}
    style="--fill: {value}%"
    aria-valuetext="{value}%"
    oninput={(event) => previewAudio({ [field]: Number(event.currentTarget.value) })}
    onchange={(event) => setAudio({ [field]: Number(event.currentTarget.value) })}
  />
  <button
    class="test"
    class:testing
    disabled={value === 0}
    onclick={() => testAudio(field)}
    aria-label={t('audio.testOne', { sound: title })}
  >
    <Icon name={testing ? 'waveform' : 'play-resume'} size={18} />
  </button>
</div>

<style>
  .volume-row {
    min-height: 48px;
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr) 44px;
    align-items: center;
    gap: 12px;
  }
  label { font-size: 15px; font-weight: 600; }
  .off label { color: var(--text-muted); }

  .test {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 9999px;
    background: var(--surface-2);
    color: var(--accent);
  }
  .test.testing { background: var(--accent); color: var(--surface-0); }
  .test:disabled { color: var(--text-muted); cursor: default; }

  .slider { width: 100%; height: 40px; margin: 0; appearance: none; -webkit-appearance: none; background: transparent; }
  .slider::-webkit-slider-runnable-track {
    height: 8px;
    border-radius: 9999px;
    background: linear-gradient(to right, var(--accent) var(--fill), var(--surface-3) var(--fill));
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 24px;
    height: 24px;
    margin-top: -8px;
    border-radius: 9999px;
    background: var(--accent);
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 15%, transparent);
  }
  .slider::-moz-range-track { height: 8px; border-radius: 9999px; background: var(--surface-3); }
  .slider::-moz-range-progress { height: 8px; border-radius: 9999px; background: var(--accent); }
  .slider::-moz-range-thumb { width: 24px; height: 24px; border: none; border-radius: 9999px; background: var(--accent); }
  .slider:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 8px; }
</style>
