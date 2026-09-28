<script>
  /** @type {{ name: string, size?: number }} */
  let { name, size = 24 } = $props();

  // 24×24 stroke paths (2px, round joins). Circles are written as arcs.
  /** @type {Record<string, string[]>} */
  const PATHS = {
    back: ['M19 12H5', 'M12 19l-7-7 7-7'],
    play: ['M7 4.5v15l12.5-7.5z'],
    pause: ['M8 5v14', 'M16 5v14'],
    skip: ['M5 5l10 7-10 7z', 'M19 5v14'],
    stop: ['M6 6h12v12H6z'],
    check: ['M5 12.5l4.5 4.5L19 7.5'],
    circle: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'],
    lock: ['M6 11h12v10H6z', 'M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11'],
    chevron: ['M6 9l6 6 6-6'],
    speaker: ['M4 9h4l5-4v14l-5-4H4z', 'M16.5 9a4 4 0 0 1 0 6', 'M19 6.5a7.5 7.5 0 0 1 0 11'],
    'speaker-off': ['M4 9h4l5-4v14l-5-4H4z', 'M16.5 9.5l5 5', 'M21.5 9.5l-5 5'],
    tune: ['M4 7h9', 'M17 7h3', 'M15 5v4', 'M4 17h3', 'M11 17h9', 'M9 15v4'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    voice: ['M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M3 20a6 6 0 0 1 12 0', 'M17 6a4 4 0 0 1 0 6', 'M19.5 3.5a7.5 7.5 0 0 1 0 11'],
    'check-circle': ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', 'M8 12.5l3 3 5-6'],
    bell: ['M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z', 'M10 21h4'],
    timer: ['M20 14a8 8 0 1 1-16 0 8 8 0 0 1 16 0z', 'M12 10v4l2.5 2', 'M10 2.5h4'],
    flag: ['M5 21V4', 'M5 4h11l-2 4 2 4H5'],
    trophy: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8 21h8', 'M10 17h4v4h-4z'],
    share: [
      'M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
      'M21 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M8.6 13.5l6.8 4', 'M15.4 6.5l-6.8 4',
    ],
    bolt: ['M13 2L4 14h7l-1 8 9-12h-7z'],
    calendar: ['M4 6h16v15H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
    walk: ['M14.5 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z', 'M13 8l-1 6 3 3v4', 'M12 14l-2 7', 'M13 8l-3 3v3', 'M13 8l2.5 3H18'],
    jog: ['M16.5 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z', 'M14 8l-2.5 5 3.5 3-1 5', 'M11.5 13l-4.5 2', 'M14 8l3 3h3', 'M14 8l-4 1-2 3'],
    run: ['M19 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0z', 'M9 10l3.5-2.5 3.5 2 3-.5', 'M12.5 7.5L10 13l4.5 3-1.5 6', 'M10 13l-4 1.5-2.5 3.5', 'M6 5L3.5 8.5'],
  };
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#each PATHS[name] ?? [] as d, i (i)}<path {d} />{/each}
</svg>

<style>
  .icon { flex: none; display: block; }
</style>
