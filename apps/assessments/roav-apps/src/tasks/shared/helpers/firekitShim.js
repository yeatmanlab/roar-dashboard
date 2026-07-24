import {
  writeTrial,
  finishRun as sdkFinishRun,
  addInteraction,
  updateEngagementFlags,
} from '@roar-platform/assessment-sdk/compat/firekit';

/**
 * Builds an SDK-backed replacement for the legacy `config.firekit` object.
 *
 * The migration keeps every existing `config.firekit.<method>` call site unchanged
 * (writeTrial, finishRun, addInteraction, updateEngagementFlags, and the `run.started` /
 * `run.completed` reads) and only swaps what `config.firekit` *is* — from a roar-firekit
 * RoarAppkit instance to this shim delegating to the assessment SDK.
 *
 * `updateUser` and `updateTaskParams` are intentional no-ops:
 * - Assessments never write to the user record. An operator-entered participant ID flows
 *   through run metadata (via `startRun`), never onto the user, and never overwrites an
 *   existing PID.
 * - The SDK has no per-run task-param update; params are resolved from the seeded variant.
 *
 * Create one shim per run (in initConfig) so `finishRun` and the `run.completed` getter
 * share the same `runFinished` flag.
 *
 * @returns {object} A firekit-compatible shim backed by the assessment SDK.
 */
export const createFirekitShim = () => {
  let runFinished = false;

  return {
    run: {
      started: true,
      get completed() {
        return runFinished;
      },
    },
    writeTrial,
    finishRun: async (metadata) => {
      if (!runFinished) {
        runFinished = true;
        await sdkFinishRun(metadata);
      }
    },
    addInteraction,
    updateEngagementFlags,
    updateUser: async () => {},
    updateTaskParams: async () => {},
  };
};
