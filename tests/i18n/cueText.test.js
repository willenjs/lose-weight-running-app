import { describe, it, expect } from 'vitest';
import { phaseLine, speechText } from '../../src/i18n/cueText.js';
import { translate } from '../../src/i18n/index.js';

describe('phaseLine', () => {
  it('says the phase and its duration', () => {
    expect(phaseLine('en', 'walk', 300, [])).toBe('Walk for 5 minutes');
    expect(phaseLine('pt', 'run', 90, [])).toBe('Correr por 1 minuto e 30 segundos');
  });

  it('appends coach lines', () => {
    expect(phaseLine('en', 'walk', 300, ['coach.walk', 'coach.halfway']))
      .toBe('Walk for 5 minutes. Breathe and recover. Halfway there, keep it up!');
  });
});

describe('speechText', () => {
  it('speaks a phase event in the given language', () => {
    const event = { kind: 'speech', inMs: 0, phaseType: 'jog', seconds: 120, extraKeys: [] };
    expect(speechText(event, 'en')).toBe('Jog for 2 minutes');
    expect(speechText(event, 'pt')).toBe('Trotar por 2 minutos');
  });

  it('speaks the finish line', () => {
    const event = { kind: 'speech', inMs: 0, finish: true };
    expect(speechText(event, 'en')).toBe('Workout complete!');
    expect(speechText(event, 'pt')).toBe('Treino concluído!');
  });
});

describe('notification text', () => {
  it('exists in every language', () => {
    expect(translate('pt', 'notification.running')).toBe('Treino em andamento');
    expect(translate('en', 'notification.running')).toBe('Workout in progress');
    expect(translate('en', 'notification.channel')).toBe('Workout');
  });
});
