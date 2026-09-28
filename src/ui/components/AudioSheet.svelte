<script>
  import {
    app, t, setAudio, testAudio, closeAudioSheet, voiceTag, VOICE_STYLES,
  } from '../controller.svelte.js';
  import Icon from './Icon.svelte';
  import VolumeRow from './VolumeRow.svelte';

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

    <VolumeRow field="voiceVolume" icon="voice" accent="var(--mint)" title={t('audio.voice')} hint={t('audio.voiceHint')} tag={voiceTag()}>
      <div class="styles" role="group" aria-label={t('audio.styleLabel')}>
        {#each VOICE_STYLES as style (style)}
          <button
            class="style"
            class:active={s.voiceStyle === style}
            aria-pressed={s.voiceStyle === style}
            disabled={s.voiceVolume === 0}
            onclick={() => setAudio({ voiceStyle: style })}
          >
            <Icon name={STYLE_ICONS[style]} size={16} />{t(`audio.style.${style}`)}
          </button>
        {/each}
      </div>
    </VolumeRow>

    <VolumeRow field="beepVolume" icon="timer" accent="var(--walk)" title={t('audio.beeps')} hint={t('audio.beepsHint')} />

    <VolumeRow field="fanfareVolume" icon="trophy" accent="var(--run)" title={t('audio.fanfare')} hint={t('audio.fanfareHint')} />

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
