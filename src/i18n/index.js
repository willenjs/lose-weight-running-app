import pt from './pt.js';
import en from './en.js';

export const LANGS = ['pt', 'en'];
export const DEFAULT_LANG = 'pt';
export const LOCALES = { pt: 'pt-BR', en: 'en-US' };

const DICTIONARIES = { pt, en };

/**
 * @param {string} lang
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 */
export function translate(lang, key, params = {}) {
  const template = DICTIONARIES[lang]?.[key] ?? DICTIONARIES[DEFAULT_LANG][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (placeholder, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  );
}

/** Spoken/readable duration, e.g. "5 minutes" or "1 minute and 30 seconds". */
export function formatDuration(seconds, lang) {
  const whole = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const unit = (n, name) => translate(lang, `unit.${name}.${n === 1 ? 'one' : 'other'}`, { n });
  const parts = [];
  if (whole > 0) parts.push(unit(whole, 'minute'));
  if (rest > 0 || whole === 0) parts.push(unit(rest, 'second'));
  return parts.join(translate(lang, 'unit.and'));
}
