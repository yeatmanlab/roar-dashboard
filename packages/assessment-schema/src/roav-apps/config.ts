/**
 * Canonical task IDs for the ROAV (Rapid Online Assessment of Vision) tasks.
 *
 * These tasks write raw, count-based scores only (numAttempted/numCorrect/numIncorrect);
 * theta is emitted null (no server-side IRT or normed scoring). See score-entries.ts for
 * how the scoring callback output is mapped to run_scores rows.
 */
export const ROAV_MP_TASK_ID = 'roav-mp' as const;
export type RoavMpTaskId = typeof ROAV_MP_TASK_ID;

export const ROAV_RVP_TASK_ID = 'roav-rvp' as const;
export type RoavRvpTaskId = typeof ROAV_RVP_TASK_ID;

export const ROAV_CR_TASK_ID = 'roav-cr' as const;
export type RoavCrTaskId = typeof ROAV_CR_TASK_ID;

export type RoavAppsTaskId = RoavMpTaskId | RoavRvpTaskId | RoavCrTaskId;

/**
 * All ROAV perception tasks share a single Google Cloud Storage bucket for stimuli and
 * media, hosted in the `gse-roar-assessment` Firebase project. roav-mp assets live at the
 * bucket root; roav-rvp assets under `z_RVP/`, roav-cr (crowding) under `z_CR/`.
 * Mirrors the `bucketURI` values in the assessment's src/tasks/taskConfig.js.
 */
export const ROAV_APPS_FIREBASE_PROJECT_ID = 'gse-roar-assessment' as const;
export const ROAV_APPS_BUCKET_NAME = 'roav-mp' as const;
export const ROAV_APPS_BUCKET_URL = `https://storage.googleapis.com/${ROAV_APPS_BUCKET_NAME}` as const;

/**
 * Per-task subfolders within the shared `roav-mp` bucket. roav-mp itself is served from the
 * bucket root (no entry here); roav-rvp reads from `z_RVP`, roav-cr (crowding) from `z_CR`.
 */
export const ROAV_APPS_BUCKET_FOLDERS: Partial<Record<RoavAppsTaskId, string>> = {
  [ROAV_RVP_TASK_ID]: 'z_RVP',
  [ROAV_CR_TASK_ID]: 'z_CR',
};

/**
 * Resolves the GCS base URI for a task's stimuli/media within the shared bucket.
 * roav-mp → bucket root; roav-rvp → bucket root + `/z_RVP`; roav-cr → bucket root + `/z_CR`.
 *
 * @param taskId - The ROAV task ID
 * @returns The base GCS URL the assessment reads corpora/media from
 */
export function roavAppsBucketUri(taskId: RoavAppsTaskId): string {
  const folder = ROAV_APPS_BUCKET_FOLDERS[taskId];
  return folder ? `${ROAV_APPS_BUCKET_URL}/${folder}` : ROAV_APPS_BUCKET_URL;
}
