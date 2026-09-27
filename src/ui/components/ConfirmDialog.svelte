<script>
  /**
   * @type {{
   *   title: string,
   *   body: string,
   *   confirmLabel: string,
   *   cancelLabel: string,
   *   onconfirm: () => void,
   *   oncancel: () => void,
   *   danger?: boolean,
   * }}
   */
  let { title, body, confirmLabel, cancelLabel, onconfirm, oncancel, danger = false } = $props();
</script>

<div class="overlay">
  <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body">
    <h2 id="confirm-title">{title}</h2>
    <p id="confirm-body">{body}</p>
    <button class="btn" class:btn-primary={!danger} class:btn-danger={danger} onclick={onconfirm}>{confirmLabel}</button>
    <button class="btn btn-secondary" onclick={oncancel}>{cancelLabel}</button>
  </div>
</div>

<style>
  .btn-danger { background: var(--run); color: var(--text); }
  .btn-danger:active { background: var(--surface-0); color: var(--run); box-shadow: inset 0 0 0 2px var(--run); }
</style>
