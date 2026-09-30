import { translate, formatDuration } from './index.js';

/**
 * "Walk for 5 minutes", followed by any coach lines (i18n keys).
 * @param {string} lang
 * @param {import('../core/plan.js').PhaseType} type
 * @param {number} seconds
 * @param {string[]} extraKeys
 */
export function phaseLine(lang, type, seconds, extraKeys) {
  const command = translate(lang, 'cue.phase', {
    phase: translate(lang, `phase.${type}`),
    duration: formatDuration(seconds, lang),
  });
  const extras = extraKeys.map((key) => translate(lang, key));
  return extras.length ? `${command}. ${extras.join(' ')}` : command;
}

/**
 * Text for a speech event from `buildTimeline`.
 * @param {Extract<import('../core/timeline.js').TimelineEvent, { kind: 'speech' }>} event
 * @param {string} lang
 */
export function speechText(event, lang) {
  if ('finish' in event) return translate(lang, 'cue.finish');
  return phaseLine(lang, event.phaseType, event.seconds, event.extraKeys);
}
