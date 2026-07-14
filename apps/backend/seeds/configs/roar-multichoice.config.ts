/**
 * Seed config for ROAR Multichoice (Morphology + Written Vocabulary).
 *
 * The multichoice assessment contains two distinct tasks routed by `params.task`:
 * - `"morphology"` — morphological awareness (prefix/suffix knowledge)
 * - `"cva"` — written vocabulary (Comprehension of Vocabulary and Affixes)
 *
 * Both tasks share the same scoring version pool.
 */
import { multichoice } from '@roar-platform/assessment-schema';

import type { TaskSeedConfig } from '../task-seed-configs';

const { MORPHOLOGY_TASK_ID, CVA_TASK_ID, MULTICHOICE_SCORING_VERSION } = multichoice;

const VALID_SCORING_VERSIONS = new Set(Object.values(MULTICHOICE_SCORING_VERSION));

export const multichoiceConfig: TaskSeedConfig = {
  tasks: {
    [MORPHOLOGY_TASK_ID]: {
      name: 'Morphology',
      nameSimple: 'Morphology',
      nameTechnical: 'Rapid Online Assessment of Reading — Morphology',
    },
    [CVA_TASK_ID]: {
      name: 'Written Vocabulary',
      nameSimple: 'CVA',
      nameTechnical: 'Rapid Online Assessment of Reading — Written Vocabulary',
    },
  },
  validateVariant(loc, params) {
    const scoringVersion = params.scoringVersion as number | null | undefined;
    if (scoringVersion !== undefined && scoringVersion !== null) {
      if (!VALID_SCORING_VERSIONS.has(scoringVersion)) {
        throw new Error(
          `${loc}: invalid scoringVersion ${scoringVersion}. Valid: ${[...VALID_SCORING_VERSIONS].join(', ')}`,
        );
      }
    }
  },
  /** Routes each variant to morphology or CVA based on `params.task`. */
  resolveTaskId(params) {
    const task = params.task as string | undefined;
    if (task === MORPHOLOGY_TASK_ID) return MORPHOLOGY_TASK_ID;
    if (task === CVA_TASK_ID) return CVA_TASK_ID;
    throw new Error(`Unknown multichoice task "${task}". Expected "${MORPHOLOGY_TASK_ID}" or "${CVA_TASK_ID}"`);
  },
};
