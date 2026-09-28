<script>
  import { LANGS } from '../../i18n/index.js';
  import { app, t, setLang, goHome, openAudioSheet, audioMuted, volumeIcon } from '../controller.svelte.js';
  import Icon from './Icon.svelte';

  /** @type {{ subtitle: string, onback?: () => void }} */
  let { subtitle, onback } = $props();
</script>

<header class="app-header">
  {#if onback}
    <button class="icon-btn" onclick={onback} aria-label={t('workout.back')}><Icon name="back" /></button>
  {/if}
  <button class="brand" onclick={goHome} aria-label="{t('header.home')}: {t('app.title')}, {subtitle}">
    {#if !onback}<span class="logo"><Icon name="run" size={28} /></span>{/if}
    <span class="brand-text">
      <strong>{t('app.title')}</strong>
      <span>{subtitle}</span>
    </span>
  </button>
  <div class="lang" role="group" aria-label={t('lang.label')}>
    {#each LANGS as lang (lang)}
      <button class:active={app.lang === lang} aria-pressed={app.lang === lang} onclick={() => setLang(lang)}>
        {lang.toUpperCase()}
      </button>
    {/each}
  </div>
  <button
    class="icon-btn"
    class:muted={audioMuted()}
    onclick={openAudioSheet}
    aria-haspopup="dialog"
    aria-label={t('header.audio')}
  >
    <Icon name={volumeIcon()} />
  </button>
</header>

<style>
  .app-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: calc(12px + env(safe-area-inset-top)) 0 4px;
  }
  .icon-btn {
    flex: none;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 9999px;
    background: var(--surface-1);
    border: 1px solid var(--surface-2);
    color: var(--mint);
  }
  .icon-btn:first-child { color: var(--text); }
  .icon-btn.muted { color: var(--text-muted); }
  .logo { flex: none; display: grid; color: var(--mint); }
  .brand {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 6px;
    text-align: left;
    border-radius: 12px;
  }
  .brand:active { background: var(--surface-1); }
  .brand-text { min-width: 0; display: flex; flex-direction: column; }
  .brand-text strong, .brand-text span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .brand-text strong { font-family: var(--display-font); font-size: 20px; line-height: 1.15; }
  .brand-text span { font-size: 12px; color: var(--text-muted); }
  .lang {
    flex: none;
    display: flex;
    padding: 3px;
    border-radius: 9999px;
    background: var(--surface-1);
    border: 1px solid var(--surface-2);
  }
  .lang button {
    min-width: 32px;
    height: 36px;
    border-radius: 9999px;
    font-family: var(--display-font);
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
  }
  .lang button.active { background: var(--mint-soft); color: var(--mint); }
</style>
