/**
 * Speaks a cue when the page is visible. In the background, browsers may
 * hold speech back, so the pre-scheduled beeps are the reliable cue there.
 */
export function speak(text, locale) {
  const synth = globalThis.speechSynthesis;
  if (!synth || document.visibilityState !== 'visible') return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  synth.speak(utterance);
}
