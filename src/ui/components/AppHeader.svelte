<script>
  import { t, goHome, openAudioSheet, audioMuted } from '../controller.svelte.js';
  import Icon from './Icon.svelte';
  import logoUrl from '../logo.svg';

  /** @type {{ title?: string, subtitle?: string, onback?: () => void }} */
  let { title, subtitle, onback } = $props();

  // A screen may name itself (e.g. "Week 2 • Day 3") in place of the app name.
  const heading = $derived(title ?? t('app.title'));
</script>

<header class="app-header">
  {#if onback}
    <button class="icon-btn" onclick={onback} aria-label={t('workout.back')}><Icon name="back" /></button>
  {/if}
  <button
    class="brand"
    onclick={goHome}
    aria-label="{t('header.home')}: {heading}{subtitle ? `, ${subtitle}` : ''}"
  >
    {#if !onback}<img class="logo" src={logoUrl} alt="" width="49" height="24" />{/if}
    <span class="brand-text">
      <strong>{heading}</strong>
      {#if subtitle}<span>{subtitle}</span>{/if}
    </span>
  </button>
  <button
    class="icon-btn settings"
    onclick={openAudioSheet}
    aria-haspopup="dialog"
    aria-label={audioMuted() ? t('header.settingsMuted') : t('header.settings')}
  >
    <Icon name="ajustes" />
    <!-- Stands in for the old speaker icon: shows that every sound is off. -->
    {#if audioMuted()}<span class="muted-dot" aria-hidden="true"></span>{/if}
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
  .settings { position: relative; background: none; border-color: transparent; color: var(--text-muted); }
  .muted-dot {
    position: absolute;
    top: 9px;
    right: 9px;
    width: 8px;
    height: 8px;
    border-radius: 9999px;
    background: var(--run);
  }
  .logo { flex: none; display: block; width: 49px; height: 24px; }
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
</style>
