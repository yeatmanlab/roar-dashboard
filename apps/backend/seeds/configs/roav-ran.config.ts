/**
 * Seed config for ROAV RAN (Rapid Automatized Naming) and Symbol Search.
 *
 * Two tasks routed by `params.taskName`:
 * - RAN — rapid naming of letters, digits, objects, or colors
 * - Symbol Search — visual scanning and matching
 *
 * Metadata is sourced from the assessment-schema constants.
 */
import { roavRan } from '@roar-platform/assessment-schema';

import type { TaskSeedConfig } from '../task-seed-configs';

const { RAN_TASK_ID, SYMBOL_SEARCH_TASK_ID, RAN_TASK, SYMBOL_SEARCH_TASK } = roavRan;

const KNOWN_TASK_IDS = new Set<string>([RAN_TASK_ID, SYMBOL_SEARCH_TASK_ID]);

export const roavRanConfig: TaskSeedConfig = {
  tasks: {
    [RAN_TASK_ID]: {
      name: RAN_TASK.name,
      nameSimple: RAN_TASK.nameSimple,
      nameTechnical: RAN_TASK.nameTechnical,
    },
    [SYMBOL_SEARCH_TASK_ID]: {
      name: SYMBOL_SEARCH_TASK.name,
      nameSimple: SYMBOL_SEARCH_TASK.nameSimple,
      nameTechnical: SYMBOL_SEARCH_TASK.nameTechnical,
    },
  },
  validateVariant(loc, params) {
    if (!('taskName' in params) || typeof params.taskName !== 'string') {
      throw new Error(`${loc}: "taskName" is required in params`);
    }
    if (!KNOWN_TASK_IDS.has(params.taskName)) {
      throw new Error(`${loc}: unknown taskName "${params.taskName}". Known: ${[...KNOWN_TASK_IDS].join(', ')}`);
    }
  },
  /** Routes each variant to its task via `params.taskName` (1:1 mapping). */
  resolveTaskId(params) {
    return params.taskName as string;
  },
};
