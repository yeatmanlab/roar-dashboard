import { writeTrial } from '@roar-platform/assessment-sdk/compat/firekit';

/**
 * Maps readaloud's legacy stage labels to the four assessment stages the SDK accepts
 * (`practice`, `practice_response`, `test`, `test_response`). Real trials map to
 * practice/test; calibration and device-setup events (`eyeCalibration`, `headCalibration`,
 * crowding, …) route to `practice_response` so they stay queryable without polluting the
 * primary practice/test rows.
 *
 * @param {string} stage - The legacy stage label from a view's results object
 * @returns {string} A stage value the SDK's writeTrial accepts
 */
export function normalizeAssessmentStage(stage) {
  const normalized = String(stage ?? '').toLowerCase();
  if (normalized === 'practice') return 'practice';
  if (normalized === 'test') return 'test';
  return 'practice_response';
}

/**
 * Writes a readaloud trial via the SDK compat, normalizing the stage and preserving the
 * original label under `stageLabel` for traceability.
 *
 * The view call sites are fire-and-forget (event handlers), so failures here would
 * otherwise be silent unhandled rejections — surface them instead so a failed write is
 * visible (with the offending trial) rather than a mysteriously empty `run_trials`.
 *
 * @param {object} results - The trial results object (must include `assessment_stage`)
 * @returns {Promise<void>}
 */
export async function writeReadaloudTrial(results) {
  try {
    await writeTrial({
      ...results,
      assessment_stage: normalizeAssessmentStage(results.assessment_stage),
      stageLabel: results.assessment_stage,
    });
  } catch (err) {
    console.error(
      '[roar-readaloud] writeTrial failed:',
      err,
      '\n  stage:',
      results?.assessment_stage,
      '\n  trial:',
      results,
    );
  }
}

export const shuffle = (array) => {
  const shuffledArray = [...array];
  for (let i = shuffledArray.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i

    // swap elements array[i] and array[j]
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }
  return shuffledArray;
};

export function stringToBoolean(str, defaultValue = false) {
  if (str === null || str === undefined) {
    return defaultValue;
  }
  return str.trim().toLowerCase() === 'true';
}
