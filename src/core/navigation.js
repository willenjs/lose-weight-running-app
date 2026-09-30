/**
 * @typedef {object} BackState
 * @property {'plan' | 'workout' | 'run' | 'finished'} screen
 * @property {boolean} audioSheetOpen
 * @property {boolean} confirmingStop
 * @property {boolean} confirmingExit
 * @property {boolean} resumePending
 */

/**
 * @typedef {'closeSheet' | 'cancelStop' | 'cancelExit' | 'none'
 *   | 'confirmStop' | 'toWorkout' | 'toPlan' | 'confirmExit'} BackAction
 */

/**
 * What the back button does: close the topmost overlay first, then walk the
 * page flow up one level. It never ends a run or leaves the app without asking.
 * @param {BackState} state
 * @returns {BackAction}
 */
export function backAction(state) {
  if (state.audioSheetOpen) return 'closeSheet';
  if (state.confirmingStop) return 'cancelStop';
  if (state.confirmingExit) return 'cancelExit';
  // Dismissing the resume dialog would decide the saved run's fate.
  if (state.resumePending) return 'none';
  switch (state.screen) {
    case 'run': return 'confirmStop';
    case 'finished': return 'toWorkout';
    case 'workout': return 'toPlan';
    default: return 'confirmExit';
  }
}
