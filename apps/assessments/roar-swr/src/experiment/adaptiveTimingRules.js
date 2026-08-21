/**
 * Pure decision rules for the `adaptiveTimingMultiStage` user mode.
 *
 * These helpers are deliberately free of any jsPsych-runtime or session-store
 * dependency so they can be unit-tested directly (see
 * `src/tests/adaptiveTimingRules.test.js`) and so the timing-stage decision
 * logic lives in a single place. `src/experiment/trials/stimulus.js` imports
 * and uses them, which means the unit tests guard the shipped behavior.
 *
 * The `config` argument is `config.adaptiveTiming` (see
 * `src/experiment/config/config.js`): `{ transitionConsecutiveCorrect,
 * transitionThetaThres, earlyStopNumItems, earlyStopThetaThres }`.
 */

/**
 * Whether the untimed first stage should complete and transition to the timed
 * stage. True when there have been enough consecutive correct responses AND the
 * ability estimate is strictly above the transition threshold.
 *
 * @param {number} consecutiveCorrect Current run of consecutive correct responses.
 * @param {number} theta Current CAT ability estimate.
 * @param {object} config `config.adaptiveTiming`.
 * @returns {boolean}
 */
export const shouldCompleteFirstStage = (consecutiveCorrect, theta, config) =>
  consecutiveCorrect >= config.transitionConsecutiveCorrect && theta > config.transitionThetaThres;

/**
 * Whether the run should stop early. This is a strict, single checkpoint: it
 * only fires at exactly `earlyStopNumItems` trials — the `===` is intentional
 * and must NOT be relaxed to `>=`. A participant who only drops below the early
 * -stop theta threshold before or after that exact trial is not stopped.
 *
 * @param {number} trialNumTotal Current total test-trial number.
 * @param {number} theta Current CAT ability estimate.
 * @param {object} config `config.adaptiveTiming`.
 * @returns {boolean}
 */
export const shouldStopEarly = (trialNumTotal, theta, config) =>
  trialNumTotal === config.earlyStopNumItems && theta < config.earlyStopThetaThres;

/**
 * Running count of consecutive correct responses. Increments on a correct
 * response (`1`) and resets to `0` otherwise. Treats a missing previous value
 * as `0`.
 *
 * @param {number|null|undefined} previousConsecutiveCorrect Prior counter value.
 * @param {number} response `1` for correct, anything else for incorrect.
 * @returns {number}
 */
export const nextConsecutiveCorrect = (previousConsecutiveCorrect, response) =>
  response === 1 ? (previousConsecutiveCorrect || 0) + 1 : 0;
