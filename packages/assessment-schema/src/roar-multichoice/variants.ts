import type { MultichoiceTaskId, MultichoiceScoringVersion } from './config.js';
import { MORPHOLOGY_TASK_ID, CVA_TASK_ID, MULTICHOICE_SCORING_VERSION } from './config.js';

export type MultichoiceTask = 'morphology' | 'cva';
export const MULTICHOICE_TASKS = ['morphology', 'cva'] as const satisfies readonly MultichoiceTask[];

type MultichoiceVariantEntry = {
  task: MultichoiceTask;
  taskId: MultichoiceTaskId;
  defaultScoringVersion: MultichoiceScoringVersion;
};

/**
 * Canonical task entries for multichoice. Each entry corresponds to one task +
 * one default variant in the backend seed.
 */
export const MULTICHOICE_VARIANTS = {
  morphology: {
    task: 'morphology',
    taskId: MORPHOLOGY_TASK_ID,
    defaultScoringVersion: MULTICHOICE_SCORING_VERSION.V1,
  },
  cva: {
    task: 'cva',
    taskId: CVA_TASK_ID,
    defaultScoringVersion: MULTICHOICE_SCORING_VERSION.V1,
  },
} as const satisfies Record<string, MultichoiceVariantEntry>;

/**
 * Resolves the task ID for a given task family string.
 * Provides a safe dispatch with fallback to 'morphology' for unrecognized values.
 *
 * @param task - 'morphology' or 'cva'
 * @returns The canonical task ID string
 */
export function getMultichoiceTaskId(task: MultichoiceTask): MultichoiceTaskId {
  const safeTask: MultichoiceTask = (MULTICHOICE_TASKS as readonly string[]).includes(task)
    ? task
    : 'morphology';
  return safeTask === 'cva' ? CVA_TASK_ID : MORPHOLOGY_TASK_ID;
}
