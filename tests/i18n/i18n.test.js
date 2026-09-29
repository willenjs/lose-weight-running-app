import { describe, it, expect } from 'vitest';
import pt from '../../src/i18n/pt.js';
import en from '../../src/i18n/en.js';
import es from '../../src/i18n/es.js';
import { VOICE_STYLES } from '../../src/core/audioSettings.js';
import { translate, formatDuration, LANGS, DEFAULT_LANG, LOCALES, VOICE_LOCALES } from '../../src/i18n/index.js';

describe('resources', () => {
  it('have the same keys in every language', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pt).sort());
    expect(Object.keys(es).sort()).toEqual(Object.keys(pt).sort());
  });

  it('declare a locale for every language', () => {
    expect(LANGS).toEqual(['pt', 'en', 'es']);
    expect(DEFAULT_LANG).toBe('pt');
    for (const lang of LANGS) expect(LOCALES[lang]).toBeTruthy();
  });

  it('prefers a voice for the display locale first, then close variants', () => {
    for (const lang of LANGS) expect(VOICE_LOCALES[lang][0]).toBe(LOCALES[lang]);
    expect(LOCALES.es).toBe('es-419');
    expect(VOICE_LOCALES.es).toEqual(['es-419', 'es-MX', 'es-US']);
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

describe('Spanish', () => {
  it('translates screens and spoken cues', () => {
    expect(translate('es', 'common.weekDay', { week: 2, day: 3 })).toBe('Semana 2 • Día 3');
    expect(translate('es', 'cue.phase', { phase: translate('es', 'phase.walk'), duration: formatDuration(300, 'es') }))
      .toBe('Caminar por 5 minutos');
    expect(translate('es', 'phaseLabel.run')).toBe('RUN RUN RUN!');
  });

  it('formats durations', () => {
    expect(formatDuration(90, 'es')).toBe('1 minuto y 30 segundos');
    expect(formatDuration(1, 'es')).toBe('1 segundo');
  });
});

describe('audio sheet and coach texts', () => {
  const keys = [
    'header.audio', 'audio.title', 'audio.subtitle', 'audio.close',
    'audio.beeps', 'audio.beepsHint', 'audio.voice', 'audio.voiceHint',
    'audio.styleLabel', 'audio.fanfare', 'audio.fanfareHint', 'audio.test', 'audio.save',
    'run.cue.beeps', 'run.cue.voice', 'run.cue.fanfare',
    ...VOICE_STYLES.map((style) => `audio.style.${style}`),
    ...['walk', 'jog', 'run', 'halfway', 'last'].map((line) => `coach.${line}`),
  ];

  it('exist in the default language', () => {
    for (const key of keys) expect(pt[key], key).toBeTruthy();
  });

  it('drop the master volume texts', () => {
    for (const key of ['audio.master', 'audio.section', 'audio.beepLevel', 'audio.level.off']) expect(pt[key], key).toBeUndefined();
  });

  it('end coach lines with punctuation so they can be joined into one utterance', () => {
    for (const lang of LANGS) {
      for (const line of ['walk', 'jog', 'run', 'halfway', 'last']) {
        expect(translate(lang, `coach.${line}`)).toMatch(/[.!]$/);
      }
    }
  });
});
