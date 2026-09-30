import { describe, it, expect } from 'vitest';
import { backAction } from '../../src/core/navigation.js';

const base = {
  screen: 'plan',
  audioSheetOpen: false,
  confirmingStop: false,
  confirmingExit: false,
  resumePending: false,
};

describe('backAction', () => {
  it('walks the page flow up one level', () => {
    expect(backAction({ ...base, screen: 'workout' })).toBe('toPlan');
    expect(backAction({ ...base, screen: 'finished' })).toBe('toWorkout');
  });

  it('asks before ending a run', () => {
    expect(backAction({ ...base, screen: 'run' })).toBe('confirmStop');
  });

  it('asks before leaving from the plan', () => {
    expect(backAction(base)).toBe('confirmExit');
  });

  it('closes the audio sheet before anything else', () => {
    expect(backAction({ ...base, screen: 'run', audioSheetOpen: true })).toBe('closeSheet');
  });

  it('cancels an open confirmation', () => {
    expect(backAction({ ...base, screen: 'run', confirmingStop: true })).toBe('cancelStop');
    expect(backAction({ ...base, confirmingExit: true })).toBe('cancelExit');
  });

  it('leaves the resume choice to the user', () => {
    expect(backAction({ ...base, resumePending: true })).toBe('none');
  });
});
