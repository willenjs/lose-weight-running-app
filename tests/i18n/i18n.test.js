import { describe, it, expect } from 'vitest';
import pt from '../../src/i18n/pt.js';
import en from '../../src/i18n/en.js';
import { translate, formatDuration, LANGS, DEFAULT_LANG, LOCALES } from '../../src/i18n/index.js';

describe('resources', () => {
  it('have the same keys in every language', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pt).sort());
  });

  it('declare a locale for every language', () => {
    expect(LANGS).toEqual(['pt', 'en']);
    expect(DEFAULT_LANG).toBe('pt');
    for (const lang of LANGS) expect(LOCALES[lang]).toBeTruthy();
  });
});

describe('translate', () => {
  it('interpolates params', () => {
    expect(translate('en', 'workout.title', { week: 2, day: 3 })).toBe('Week 2 - Day 3');
    expect(translate('pt', 'workout.title', { week: 2, day: 3 })).toBe('Semana 2 - Dia 3');
  });

  it('leaves placeholders without a param untouched', () => {
    expect(translate('en', 'workout.title', { week: 1 })).toBe('Week 1 - Day {day}');
  });

  it('falls back to the default language, then to the key', () => {
    expect(translate('xx', 'workout.start')).toBe(pt['workout.start']);
    expect(translate('en', 'no.such.key')).toBe('no.such.key');
  });
});

describe('formatDuration', () => {
  it('uses whole units when possible', () => {
    expect(formatDuration(300, 'en')).toBe('5 minutes');
    expect(formatDuration(60, 'en')).toBe('1 minute');
    expect(formatDuration(45, 'en')).toBe('45 seconds');
    expect(formatDuration(1, 'en')).toBe('1 second');
    expect(formatDuration(0, 'en')).toBe('0 seconds');
  });

  it('combines units', () => {
    expect(formatDuration(90, 'en')).toBe('1 minute and 30 seconds');
  });

  it('is translated', () => {
    expect(formatDuration(300, 'pt')).toBe('5 minutos');
    expect(formatDuration(90, 'pt')).toBe('1 minuto e 30 segundos');
  });
});

describe('phase labels', () => {
  it('shows RUN RUN RUN! on screen while the voice keeps the plain phase name', () => {
    for (const lang of LANGS) expect(translate(lang, 'phaseLabel.run')).toBe('RUN RUN RUN!');
    expect(translate('pt', 'phase.run')).toBe('Correr');
    expect(translate('en', 'phase.run')).toBe('Run');
  });

  it('keeps walk and jog labels equal to their phase names', () => {
    for (const lang of LANGS) {
      for (const type of ['walk', 'jog']) {
        expect(translate(lang, `phaseLabel.${type}`)).toBe(translate(lang, `phase.${type}`));
      }
    }
  });
});

describe('PulseRun copy', () => {
  it('names the app PulseRun', () => {
    for (const lang of LANGS) expect(translate(lang, 'app.title')).toBe('PulseRun');
  });

  it('has a theme and subtitle for each of the 5 weeks', () => {
    for (const lang of LANGS) {
      for (let week = 1; week <= 5; week += 1) {
        for (const part of ['title', 'subtitle']) {
          const key = `week.${week}.${part}`;
          expect(translate(lang, key), `${lang} ${key}`).not.toBe(key);
        }
      }
    }
  });

  it('has a label for every phase role, tip and pace', () => {
    const keys = [
      ...['warmup', 'build', 'recovery', 'finale'].flatMap((r) => [`role.${r}`, `tip.${r}`]),
      ...['walk', 'jog', 'run'].flatMap((p) => [`pace.${p}`, `short.${p}`]),
    ];
    for (const lang of LANGS) for (const key of keys) expect(translate(lang, key), `${lang} ${key}`).not.toBe(key);
  });
});
