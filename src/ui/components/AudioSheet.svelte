<script>
  import {
    app, t, setAudio, previewAudio, testAudio, closeAudioSheet, volumeIcon, volumeLabel, voiceTag,
    VOLUME_PRESETS, VOICE_STYLES, MIN_BEEP_LEVEL,
  } from '../controller.svelte.js';
  import Icon from './Icon.svelte';
  import Switch from './Switch.svelte';

  const STYLE_ICONS = { intense: 'bolt', commands: 'bell' };

  const s = $derived(app.settings);
  /** @type {HTMLButtonElement | undefined} */
  let closeButton = $state();

  // Focus the sheet on open and give focus back to the opener on close.
  $effect(() => {
    const opener = /** @type {HTMLElement | null} */ (document.activeElement);
    closeButton?.focus();
    // Deferred: the opener sits under the inert screens until this update finishes.
    return () => queueMicrotask(() => opener?.focus?.());
  });

  function onKeydown(event) {
    if (event.key === 'Escape') closeAudioSheet();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="sheet-layer">
  <button class="backdrop" tabindex="-1" aria-label={t('audio.close')} onclick={closeAudioSheet}></button>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="audio-title">
    <div class="handle" aria-hidden="true"></div>

    <header class="head">
      <div class="head-text">
        <h2 id="audio-title"><span class="head-icon"><Icon name="tune" size={20} /></span>{t('audio.title')}</h2>
        <p>{t('audio.subtitle')}</p>
      </div>
      <button class="round" bind:this={closeButton} onclick={closeAudioSheet} aria-label={t('audio.close')}>
        <Icon name="close" />
      </button>
    </header>

    <section class="panel">
      <div class="master">
        <span class="tile tone-mint"><Icon name={volumeIcon()} /></span>
        <span class="master-text">
          <span class="label">{t('audio.master')}</span>
          <span class="level">{volumeLabel()}</span>
        </span>
        <span class="readout num">{s.volume}<small>%</small></span>
      </div>
      <input
        class="slider"
        type="range"
        min="0"
        max="100"
        step="1"
        value={s.volume}
        style="--fill: {s.volume}%"
        aria-label={t('audio.master')}
        oninput={(event) => previewAudio({ volume: Number(event.currentTarget.value) })}
        onchange={(event) => setAudio({ volume: Number(event.currentTarget.value) })}
      />
      <div class="beep-level">
        <span class="beep-text">
          <span class="label">{t('audio.beepLevel')}</span>
          <span class="hint">{t('audio.beepLevelHint')}</span>
        </span>
        <span class="beep-readout num">{s.beepLevel}%</span>
      </div>
      <input
        class="slider slider-small"
        type="range"
        min={MIN_BEEP_LEVEL}
        max="100"
        step="1"
        value={s.beepLevel}
        style="--fill: {((s.beepLevel - MIN_BEEP_LEVEL) / (100 - MIN_BEEP_LEVEL)) * 100}%"
        aria-label={t('audio.beepLevel')}
        oninput={(event) => previewAudio({ beepLevel: Number(event.currentTarget.value) })}
        onchange={(event) => setAudio({ beepLevel: Number(event.currentTarget.value) })}
      />
      <div class="presets">
        {#each VOLUME_PRESETS as preset (preset)}
          <button class="preset" class:active={s.volume === preset} aria-pressed={s.volume === preset} onclick={() => setAudio({ volume: preset })}>
            <span>{t(`audio.preset.${preset}`)}</span>
            <small class="num">{preset}%</small>
          </button>
        {/each}
      </div>
    </section>

    <p class="label section-label">{t('audio.section')}</p>

    <section class="row-card">
      <div class="row">
        <span class="tile tone-walk"><Icon name="timer" size={22} /></span>
        <span class="row-text">
          <strong>{t('audio.beeps')}</strong>
          <span>{t('audio.beepsHint')}</span>
        </span>
        <Switch checked={s.beeps} label={t('audio.beeps')} onchange={(beeps) => setAudio({ beeps })} />
      </div>
    </section>

    <section class="row-card">
      <div class="row">
        <span class="tile tone-mint"><Icon name="voice" size={22} /></span>
        <span class="row-text">
          <strong>{t('audio.voice')} <span class="lang-tag">{voiceTag()}</span></strong>
          <span>{t('audio.voiceHint')}</span>
        </span>
        <Switch checked={s.voice} label={t('audio.voice')} onchange={(voice) => setAudio({ voice })} />
      </div>
      <div class="styles" role="group" aria-label={t('audio.styleLabel')}>
        {#each VOICE_STYLES as style (style)}
          <button
            class="style"
            class:active={s.voiceStyle === style}
            aria-pressed={s.voiceStyle === style}
            disabled={!s.voice}
            onclick={() => setAudio({ voiceStyle: style })}
          >
            <Icon name={STYLE_ICONS[style]} size={16} />{t(`audio.style.${style}`)}
          </button>
        {/each}
      </div>
    </section>

    <section class="row-card">
      <div class="row">
        <span class="tile tone-run"><Icon name="trophy" size={22} /></span>
        <span class="row-text">
          <strong>{t('audio.fanfare')}</strong>
          <span>{t('audio.fanfareHint')}</span>
        </span>
        <Switch checked={s.fanfare} label={t('audio.fanfare')} onchange={(fanfare) => setAudio({ fanfare })} />
      </div>
    </section>

    <button class="test" class:testing={app.audioTesting} onclick={testAudio}>
      <span class="play"><Icon name={app.audioTesting ? 'bolt' : 'play'} size={18} /></span>
      <span class="test-label">{t('audio.test')}</span>
      <span class="waves" aria-hidden="true">
        {#each [8, 16, 12, 20, 8] as height, i (i)}<span style="--h: {height}px; --i: {i}"></span>{/each}
      </span>
    </button>

    <button class="btn btn-primary" onclick={closeAudioSheet}>
      <Icon name="check-circle" />{t('audio.save')}
    </button>
  </div>
</div>

<style>
  .sheet-layer {
    position: fixed;
    inset: 0;
    z-index: 15;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgb(12 13 18 / 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  .sheet {
    position: relative;
    width: 100%;
    max-width: 560px;
    max-height: calc(100dvh - 24px);
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
    background: var(--surface-1);
    border: 1px solid var(--surface-2);
    border-bottom: none;
    border-radius: 24px 24px 0 0;
    animation: rise 0.2s ease-out;
  }
  @keyframes rise { from { transform: translateY(24px); opacity: 0.6; } }
  .handle { flex: none; align-self: center; width: 48px; height: 6px; border-radius: 9999px; background: var(--surface-3); }

  .head { display: flex; align-items: flex-start; gap: 12px; }
  .head-text { flex: 1; min-width: 0; }
  .head h2 { margin: 0; display: flex; align-items: center; gap: 6px; font-family: var(--display-font); font-size: 22px; }
  .head-icon { display: grid; color: var(--mint); }
  .head p { margin: 2px 0 0; font-size: 13px; color: var(--text-muted); }
  .round {
    flex: none;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 9999px;
    background: var(--surface-2);
  }
  .round:active { background: var(--surface-3); }

  .panel, .row-card {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: var(--radius);
    background: var(--surface-2);
  }
  .tile {
    flex: none;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 12px;
  }
  .tone-mint { background: var(--mint-soft); color: var(--mint); }
  .tone-walk { background: rgb(0 210 255 / 0.15); color: var(--walk); }
  .tone-run { background: rgb(255 51 75 / 0.15); color: var(--run); }

  .master { display: flex; align-items: center; gap: 10px; }
  .master-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .level { font-size: 13px; font-weight: 600; color: var(--mint); }
  .readout { font-size: 32px; font-weight: 700; color: var(--mint); }
  .readout small { font-size: 14px; margin-left: 2px; }

  .slider { width: 100%; height: 44px; margin: 0; appearance: none; -webkit-appearance: none; background: transparent; }
  .slider::-webkit-slider-runnable-track {
    height: 12px;
    border-radius: 9999px;
    background: linear-gradient(to right, var(--mint) var(--fill), var(--surface-3) var(--fill));
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 28px;
    height: 28px;
    margin-top: -8px;
    border-radius: 9999px;
    background: var(--mint);
    box-shadow: 0 0 0 6px var(--mint-soft);
  }
  .slider::-moz-range-track { height: 12px; border-radius: 9999px; background: var(--surface-3); }
  .slider::-moz-range-progress { height: 12px; border-radius: 9999px; background: var(--mint); }
  .slider::-moz-range-thumb { width: 28px; height: 28px; border: none; border-radius: 9999px; background: var(--mint); }
  .slider:focus-visible { outline: 2px solid var(--mint); outline-offset: 4px; border-radius: 8px; }

  .beep-level { display: flex; align-items: center; gap: 10px; }
  .beep-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .hint { font-size: 12px; color: var(--text-muted); }
  .beep-readout { font-size: 18px; font-weight: 700; color: var(--walk); }
  .slider-small { height: 36px; }
  .slider-small::-webkit-slider-runnable-track {
    height: 8px;
    background: linear-gradient(to right, var(--walk) var(--fill), var(--surface-3) var(--fill));
  }
  .slider-small::-webkit-slider-thumb { width: 24px; height: 24px; margin-top: -8px; background: var(--walk); box-shadow: 0 0 0 6px rgb(0 210 255 / 0.15); }
  .slider-small::-moz-range-track { height: 8px; }
  .slider-small::-moz-range-progress { height: 8px; background: var(--walk); }
  .slider-small::-moz-range-thumb { width: 24px; height: 24px; background: var(--walk); }

  .presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .preset {
    min-height: 52px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: var(--surface-1);
    font-family: var(--display-font);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .preset small { font-size: 11px; color: var(--text-muted); }
  .preset.active { background: var(--mint-soft); color: var(--mint); box-shadow: inset 0 0 0 1px var(--mint); }
  .preset.active small { color: var(--mint); }

  .section-label { padding: 4px 4px 0; }

  .row { display: flex; align-items: center; gap: 12px; }
  .row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .row-text strong { font-size: 17px; line-height: 1.25; }
  .row-text > span { font-size: 13px; color: var(--text-muted); }
  .lang-tag {
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

  .styles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .style {
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 8px;
    border-radius: 12px;
    background: var(--surface-1);
    color: var(--text-muted);
    font-family: var(--display-font);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .style.active { background: var(--mint-soft); color: var(--mint); box-shadow: inset 0 0 0 1px var(--mint); }
  .style:disabled { opacity: 0.4; cursor: default; }

  .test {
    flex: none;
    min-height: 60px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 16px;
    border-radius: var(--radius);
    background: var(--surface-2);
    text-align: left;
  }
  .test:active { background: var(--surface-3); }
  .play { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 9999px; background: var(--mint); color: var(--on-mint); }
  .test-label { flex: 1; min-width: 0; font-family: var(--display-font); font-size: 15px; font-weight: 700; }
  .waves { flex: none; display: flex; align-items: center; gap: 4px; height: 24px; }
  .waves span { width: 4px; height: var(--h); border-radius: 9999px; background: var(--text-muted); }
  .testing .waves span {
    background: var(--mint);
    animation: wave 0.48s ease-in-out infinite alternate;
    animation-delay: calc(var(--i) * -0.12s);
  }
  @keyframes wave { from { height: 6px; } to { height: 22px; } }

  .btn { flex: none; }

  @media (prefers-reduced-motion: reduce) {
    .sheet { animation: none; }
    .testing .waves span { animation: none; }
  }
</style>
