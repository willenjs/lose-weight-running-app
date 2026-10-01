<script>
  import { LANGS } from '../../i18n/index.js';
  import { app, t, setLang, setAudio, closeAudioSheet, VOICE_STYLES } from '../controller.svelte.js';
  import Icon from './Icon.svelte';
  import VolumeRow from './VolumeRow.svelte';

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

<!-- Every change is saved as it is made, so the sheet only needs a way to close. -->
<div class="sheet-layer">
  <button class="backdrop" tabindex="-1" aria-label={t('audio.close')} onclick={closeAudioSheet}></button>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <div class="handle" aria-hidden="true"></div>

    <header class="head">
      <h2 id="settings-title">{t('settings.title')}</h2>
      <button class="round" bind:this={closeButton} onclick={closeAudioSheet} aria-label={t('audio.close')}>
        <Icon name="close" />
      </button>
    </header>

    <section class="group">
      <h3 class="label" id="settings-lang">{t('lang.label')}</h3>
      <div class="segmented three" role="group" aria-labelledby="settings-lang">
        {#each LANGS as lang (lang)}
          <button class:active={app.lang === lang} aria-pressed={app.lang === lang} onclick={() => setLang(lang)}>
            {t(`lang.${lang}`)}
          </button>
        {/each}
      </div>
    </section>

    <section class="group volumes">
      <h3 class="label">{t('settings.volume')}</h3>
      <VolumeRow field="voiceVolume" accent="var(--mint)" title={t('audio.voice')} />
      <VolumeRow field="beepVolume" accent="var(--walk)" title={t('audio.beeps')} />
      <VolumeRow field="fanfareVolume" accent="var(--run)" title={t('audio.fanfare')} />
    </section>

    <section class="group">
      <h3 class="label" id="settings-style">{t('audio.styleLabel')}</h3>
      <div class="segmented" role="group" aria-labelledby="settings-style">
        {#each VOICE_STYLES as style (style)}
          <button
            class:active={app.settings.voiceStyle === style}
            aria-pressed={app.settings.voiceStyle === style}
            disabled={app.settings.voiceVolume === 0}
            onclick={() => setAudio({ voiceStyle: style })}
          >
            {t(`audio.style.${style}`)}
          </button>
        {/each}
      </div>
    </section>
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
    gap: 20px;
    padding: 12px 20px calc(28px + env(safe-area-inset-bottom));
    background: var(--surface-1);
    border: 1px solid var(--surface-2);
    border-bottom: none;
    border-radius: 24px 24px 0 0;
    animation: rise 0.2s ease-out;
  }
  @keyframes rise { from { transform: translateY(24px); opacity: 0.6; } }
  .handle { flex: none; align-self: center; width: 48px; height: 6px; border-radius: 9999px; background: var(--surface-3); }

  .head { display: flex; align-items: center; gap: 12px; margin-top: -8px; }
  .head h2 { flex: 1; margin: 0; font-family: var(--display-font); font-size: 22px; }
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

  .group { display: flex; flex-direction: column; gap: 10px; }
  .volumes { gap: 4px; }
  .volumes .label { margin-bottom: 6px; }

  .segmented {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
    padding: 4px;
    border-radius: 14px;
    background: var(--surface-2);
  }
  .segmented.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .segmented button {
    min-height: 44px;
    padding: 0 6px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .segmented button.active { background: var(--mint-soft); color: var(--mint); }
  .segmented button:disabled { opacity: 0.4; cursor: default; }

  @media (prefers-reduced-motion: reduce) {
    .sheet { animation: none; }
  }
</style>
