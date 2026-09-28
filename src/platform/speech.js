// Relative to the voice's normal speed (1 = normal; browsers accept 0.1–10).
const SPEECH_RATE = 1.5;

/** Best installed voice for the preferred locales, or null to let the browser choose. */
function pickVoice(synth, locales) {
  const voices = synth.getVoices?.() ?? [];
  const langOf = (voice) => voice.lang.replace('_', '-').toLowerCase();
  for (const locale of locales) {
    const exact = voices.find((voice) => langOf(voice) === locale.toLowerCase());
    if (exact) return exact;
  }
  const language = locales[0].split('-')[0].toLowerCase();
  return voices.find((voice) => langOf(voice).split('-')[0] === language) ?? null;
}

/**
 * Speaks a cue when the page is visible. In the background, browsers may
 * hold speech back, so the pre-scheduled beeps are the reliable cue there.
 * @param {string} text
 * @param {string[]} locales preferred voice locales, best first
 * @param {{ volume?: number }} [options] volume 0–100
 */
export function speak(text, locales, { volume = 100 } = {}) {
  const synth = globalThis.speechSynthesis;
  if (!synth || document.visibilityState !== 'visible') return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(synth, locales);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? locales[0];
  utterance.rate = SPEECH_RATE;
  utterance.volume = Math.min(100, Math.max(0, volume)) / 100;
  synth.speak(utterance);
}

/** Stops any speech in progress (used when muting). */
export function cancelSpeech() {
  globalThis.speechSynthesis?.cancel();
}
