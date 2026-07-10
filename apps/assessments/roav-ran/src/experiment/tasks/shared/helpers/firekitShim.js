import {
  writeTrial as sdkWriteTrial,
  finishRun as sdkFinishRun,
  addInteraction,
  updateEngagementFlags,
  abortRun,
} from '@roar-platform/assessment-sdk/compat/firekit';

// The SDK's writeTrial strictly validates the assessment stage against exactly these four
// canonical values. roav-ran's legacy views send capitalized / task-specific labels
// (e.g. 'Practice', 'Test', 'eyeCalibration'), so map them here via a lowercased lookup.
const STAGE_MAP = {
  practice: 'practice',
  test: 'test',
  practice_response: 'practice_response',
  test_response: 'test_response',
  eyecalibration: 'practice_response',
  headcalibration: 'practice_response',
};

const normalizeStage = (rawStage) => STAGE_MAP[String(rawStage ?? '').toLowerCase()] ?? 'test';

// Warn once per no-op method (dev only) so a researcher's firekit muscle memory doesn't
// silently mislead them — the shape is preserved but the behavior is intentionally gone.
const warnedNoOps = new Set();
const warnNoOp = (method, guidance) => {
  const isProd = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
  if (isProd || warnedNoOps.has(method)) return;
  warnedNoOps.add(method);
  console.warn(`[roav-ran] config.firekit.${method}() is a no-op — ${guidance}`);
};

/**
 * Builds an SDK-backed replacement for the legacy `config.firekit` object.
 *
 * roav-ran was written against roar-firekit's `config.firekit`, both as a method surface
 * (writeTrial, finishRun, updateEngagementFlags, abortRun, addInteraction) and as property
 * bags (`.task.variantParams`, `.user.assessmentPid`). This shim reproduces that shape over
 * the assessment SDK so the migrated assessment code keeps working unchanged. It is NOT a
 * real firekit — see yeatmanlab/roar-project-management#1980 for the decision to revisit
 * whether the roav family should shed the shim for direct SDK usage.
 *
 * Intentional no-ops (warn once in dev):
 * - `updateUser` — assessments never write to the user record. Operator-entered PID flows
 *   through run metadata (startRun) and the recording path, never onto the user; calling it
 *   to persist a PID is the exact firekit footgun being removed.
 * - `updateTaskParams` — the SDK has no per-run task-param update; params come from the
 *   seeded variant.
 *
 * `writeTrial` normalizes roav-ran's legacy stage strings to the four canonical stages the
 * SDK validates and preserves the original as `stageLabel` for traceability.
 *
 * Create one shim per run (in initConfig) so `finishRun` and the `run.completed` getter
 * share the same `runFinished` flag.
 *
 * @param {object} [identity] - Variant params + participant identity for the property bags.
 * @param {object} [identity.variantParams] - Seeded variant params (from getVariantById).
 * @param {string} [identity.assessmentPid] - Operator/participant PID (never the user record).
 * @returns {object} A firekit-compatible shim backed by the assessment SDK.
 */
export const createFirekitShim = ({ variantParams = {}, assessmentPid = '' } = {}) => {
  let runFinished = false;

  return {
    run: {
      started: true,
      get completed() {
        return runFinished;
      },
    },
    task: { variantParams },
    user: { assessmentPid },
    writeTrial: (trialData = {}, ...rest) => {
      const { assessment_stage: rawStage, ...trialRest } = trialData;
      return sdkWriteTrial({ ...trialRest, assessment_stage: normalizeStage(rawStage), stageLabel: rawStage }, ...rest);
    },
    finishRun: async (metadata) => {
      if (!runFinished) {
        runFinished = true;
        await sdkFinishRun(metadata);
      }
    },
    addInteraction,
    updateEngagementFlags,
    abortRun,
    updateUser: async () => {
      warnNoOp('updateUser', 'assessments no longer write to the user record; PID flows to run metadata.');
    },
    updateTaskParams: async () => {
      warnNoOp('updateTaskParams', 'task params come from the seeded variant, not per-run updates.');
    },
  };
};
