import {
  writeTrial,
  finishRun as sdkFinishRun,
  addInteraction,
  updateEngagementFlags,
  uploadFile,
  flushUploads,
} from '@roar-platform/assessment-sdk/compat/firekit';

/**
 * Builds an SDK-backed replacement for the legacy `config.firekit` object.
 *
 * The migration keeps every existing `config.firekit.<method>` call site unchanged
 * (writeTrial, finishRun, addInteraction, updateEngagementFlags, uploadFileOrBlobToStorage,
 * and the `run.started` / `run.completed` reads) and only swaps what `config.firekit` *is* —
 * from a roar-firekit RoarAppkit instance to this shim delegating to the assessment SDK.
 *
 * `updateUser` and `updateTaskParams` are intentional no-ops:
 * - Assessments never write to the user record. An operator-entered participant ID flows
 *   through run metadata (via `startRun`), never onto the user, and never overwrites an
 *   existing PID.
 * - The SDK has no per-run task-param update; params are resolved from the seeded variant.
 *
 * `uploadFileOrBlobToStorage` bridges the eyetracking pipeline's recording uploads (roav-cr /
 * src/tasks/et) to the SDK's `uploadFile` compat method. The run's taskId is captured from the
 * shim closure so the `state.firekit.uploadFileOrBlobToStorage(...)` call sites in src/tasks/et
 * stay unchanged. Only roav-cr records/uploads; roav-mp/roav-rvp create the shim without a
 * taskId and never call it.
 *
 * Create one shim per run (in initConfig) so `finishRun` and the `run.completed` getter
 * share the same `runFinished` flag.
 *
 * @param {{ taskId?: string }} [options] - taskId used for recording-upload storage paths.
 * @returns {object} A firekit-compatible shim backed by the assessment SDK.
 */
export const createFirekitShim = ({ taskId } = {}) => {
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
        // Let fire-and-forget recording uploads settle before the run's id is cleared —
        // resolves immediately when nothing is queued (roav-mp/roav-rvp).
        await flushUploads();
        await sdkFinishRun(metadata);
      }
    },
    addInteraction,
    updateEngagementFlags,
    uploadFileOrBlobToStorage: async ({ filename, fileOrBlob, assessmentPid, customMetadata }) =>
      uploadFile({
        filename,
        fileOrBlob,
        taskId,
        ...(assessmentPid != null ? { assessmentPid } : {}),
        ...(customMetadata != null ? { customMetadata } : {}),
      }),
    updateUser: async () => {},
    updateTaskParams: async () => {},
  };
};
