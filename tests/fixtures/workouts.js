// Fixed workouts for the timer, cue and coach tests, so they do not change
// when the training plan does. SAMPLE matches tests/fixtures/session-math.json.
const phase = (type, minutes) => ({ type, seconds: minutes * 60 });

/** walk 6, jog 2, walk 6, jog 2, run 5 (min): 1260 s. */
export const SAMPLE = {
  id: 'w1d1', week: 1, day: 1,
  phases: [phase('walk', 6), phase('jog', 2), phase('walk', 6), phase('jog', 2), phase('run', 5)],
};

/** walk 5, jog 2, walk 5, jog 2, walk 5, jog 2, run 5 (min). */
export const SAMPLE_7 = {
  id: 'w4d2', week: 4, day: 2,
  phases: [
    phase('walk', 5), phase('jog', 2), phase('walk', 5), phase('jog', 2), phase('walk', 5), phase('jog', 2), phase('run', 5),
  ],
};
