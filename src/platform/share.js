/** Whether the Share button can do anything on this device. */
export function canShare() {
  const nav = globalThis.navigator;
  return Boolean(nav?.share || nav?.clipboard?.writeText);
}

/**
 * Opens the system share sheet, or copies the text when sharing is not possible.
 * Never rejects.
 * @param {{ title: string, text: string, url: string }} data
 * @returns {Promise<'shared' | 'copied' | 'unavailable'>}
 */
export async function share(data) {
  const nav = globalThis.navigator;
  if (nav?.share) {
    try {
      await nav.share(data);
      return 'shared';
    } catch (error) {
      // The user closed the sheet: nothing else to do.
      if (error?.name === 'AbortError') return 'shared';
    }
  }
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(`${data.text} ${data.url}`);
      return 'copied';
    } catch {
      // Clipboard blocked: fall through.
    }
  }
  return 'unavailable';
}
