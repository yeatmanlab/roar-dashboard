import { multichoice } from '@roar-platform/assessment-schema';

import type { TaskSeedConfig } from '../task-seed-configs';

const { MORPHOLOGY_TASK_ID, CVA_TASK_ID } = multichoice;

export const multichoiceConfig: TaskSeedConfig = {
  tasks: {
    [MORPHOLOGY_TASK_ID]: {
      name: 'Morphology',
      nameSimple: 'Morphology',
      nameTechnical: 'Rapid Online Assessment of Reading — Morphology',
    },
    [CVA_TASK_ID]: {
      name: 'Comprehension of Vocabulary and Affixes',
      nameSimple: 'CVA',
      nameTechnical: 'Rapid Online Assessment of Reading — Comprehension of Vocabulary and Affixes',
    },
  },
  resolveTaskId(params) {
    const taskName = params.taskName as string | undefined;
    if (taskName === MORPHOLOGY_TASK_ID) return MORPHOLOGY_TASK_ID;
    if (taskName === CVA_TASK_ID) return CVA_TASK_ID;
    throw new Error(`Unknown multichoice taskName "${taskName}". Expected "${MORPHOLOGY_TASK_ID}" or "${CVA_TASK_ID}"`);
  },
};
