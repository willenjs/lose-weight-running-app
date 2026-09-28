<script>
  /** @type {{ name: string, size?: number }} */
  let { name, size = 24 } = $props();

  // Each file in ../icons is a 24×24 currentColor SVG; the file name is the icon name.
  const FILES = import.meta.glob('../icons/*.svg', { query: '?raw', import: 'default', eager: true });

  /** @type {Record<string, string>} inner markup (without the <svg> wrapper) by icon name */
  const ICONS = Object.fromEntries(
    Object.entries(FILES).map(([path, raw]) => [
      path.slice(path.lastIndexOf('/') + 1, -'.svg'.length),
      String(raw).replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, '').trim(),
    ]),
  );

  // Phase types from the plan map onto icon file names.
  /** @type {Record<string, string>} */
  const ALIASES = { run: 'run-sprint' };
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {@html ICONS[ALIASES[name] ?? name] ?? ''}
</svg>

<style>
  .icon { flex: none; display: block; }
</style>
