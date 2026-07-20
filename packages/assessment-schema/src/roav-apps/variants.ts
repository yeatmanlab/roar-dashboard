import type { RoavAppsTaskId } from './config.js';
import { ROAV_MP_TASK_ID, ROAV_RVP_TASK_ID, ROAV_CR_TASK_ID } from './config.js';

/**
 * Task family strings for roav-apps. For these tasks the family string and the task ID
 * are identical (no separate slug), unlike some assessments where they diverge.
 */
export type RoavAppsTask = RoavAppsTaskId;

export const ROAV_APPS_TASKS = [
  ROAV_MP_TASK_ID,
  ROAV_RVP_TASK_ID,
  ROAV_CR_TASK_ID,
] as const satisfies readonly RoavAppsTask[];

type RoavAppsVariantEntry = {
  task: RoavAppsTask;
  taskId: RoavAppsTaskId;
};

/**
 * Canonical task entries for roav-apps. Each corresponds to one task + its default variant
 * in the backend seed.
 */
export const ROAV_APPS_VARIANTS = {
  [ROAV_MP_TASK_ID]: { task: ROAV_MP_TASK_ID, taskId: ROAV_MP_TASK_ID },
  [ROAV_RVP_TASK_ID]: { task: ROAV_RVP_TASK_ID, taskId: ROAV_RVP_TASK_ID },
  [ROAV_CR_TASK_ID]: { task: ROAV_CR_TASK_ID, taskId: ROAV_CR_TASK_ID },
} as const satisfies Record<RoavAppsTask, RoavAppsVariantEntry>;
