<script>
  import { LANGS } from '../../i18n/index.js';
  import { app, t, setLang, toggleMute } from '../controller.svelte.js';
  import Icon from './Icon.svelte';

  /** @type {{ subtitle: string, onback?: () => void }} */
  let { subtitle, onback } = $props();
</script>

<header class="app-header">
  {#if onback}
    <button class="icon-btn" onclick={onback} aria-label={t('workout.back')}><Icon name="back" /></button>
  {:else}
    <span class="logo"><Icon name="run" size={28} /></span>
  {/if}
  <div class="brand">
    <strong>{t('app.title')}</strong>
    <span>{subtitle}</span>
  </div>
  <div class="lang" role="group" aria-label={t('lang.label')}>
    {#each LANGS as lang (lang)}
      <button class:active={app.lang === lang} aria-pressed={app.lang === lang} onclick={() => setLang(lang)}>
        {lang.toUpperCase()}
      </button>
    {/each}
  </div>
  <button
    class="icon-btn"
    class:muted={app.muted}
    onclick={toggleMute}
    aria-pressed={app.muted}
    aria-label={t(app.muted ? 'header.unmute' : 'header.mute')}
  >
    <Icon name={app.muted ? 'speaker-off' : 'speaker'} />
  </button>
</header>

<style>
  .app-header {
    display: flex;
    align-items: center;
    gap: 8px;
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
  .brand { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .brand strong, .brand span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .brand strong { font-family: var(--display-font); font-size: 20px; line-height: 1.15; }
  .brand span { font-size: 12px; color: var(--text-muted); }
  .lang {
    flex: none;
    display: flex;
    padding: 3px;
    border-radius: 9999px;
    background: var(--surface-1);
    border: 1px solid var(--surface-2);
  }
  .lang button {
    min-width: 36px;
    height: 36px;
    border-radius: 9999px;
    font-family: var(--display-font);
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
  }
  .lang button.active { background: var(--mint-soft); color: var(--mint); }
</style>
