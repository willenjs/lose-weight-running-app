// Relative to the voice's normal speed (1 = normal; browsers accept 0.1–10).
const SPEECH_RATE = 1.5;

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
  utterance.rate = SPEECH_RATE;
  synth.speak(utterance);
}

/** Stops any speech in progress (used when muting). */
export function cancelSpeech() {
  globalThis.speechSynthesis?.cancel();
}
