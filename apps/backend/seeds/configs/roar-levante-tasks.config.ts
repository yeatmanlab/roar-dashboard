import { levante } from '@roar-platform/assessment-schema';

import type { TaskSeedConfig } from '../task-seed-configs';

const { LEVANTE_NORMED_TASK_IDS, LEVANTE_PROVISIONAL_TASK_IDS } = levante;

export const levanteConfig: TaskSeedConfig = {
  tasks: {
    [LEVANTE_NORMED_TASK_IDS.TROG]: {
      name: 'TROG',
      nameSimple: 'TROG',
      nameTechnical: 'Test for Reception of Grammar',
    },
    [LEVANTE_NORMED_TASK_IDS.ROAR_INFERENCE]: {
      name: 'Inference',
      nameSimple: 'Inference',
      nameTechnical: 'ROAR Inference',
    },
    [LEVANTE_PROVISIONAL_TASK_IDS.EGMA_MATH]: {
      name: 'EGMA Math',
      nameSimple: 'EGMA Math',
      nameTechnical: 'Early Grade Mathematics Assessment',
    },
    [LEVANTE_PROVISIONAL_TASK_IDS.MATRIX_REASONING]: {
      name: 'Matrix Reasoning',
      nameSimple: 'Matrix Reasoning',
      nameTechnical: 'Matrix Reasoning',
    },
    [LEVANTE_PROVISIONAL_TASK_IDS.MENTAL_ROTATION]: {
      name: 'Mental Rotation',
      nameSimple: 'Mental Rotation',
      nameTechnical: 'Mental Rotation',
    },
    [LEVANTE_PROVISIONAL_TASK_IDS.SAME_DIFFERENT_SELECTION]: {
      name: 'Same-Different Selection',
      nameSimple: 'Same-Different Selection',
      nameTechnical: 'Same-Different Selection',
    },
    [LEVANTE_PROVISIONAL_TASK_IDS.THEORY_OF_MIND]: {
      name: 'Theory of Mind',
      nameSimple: 'Theory of Mind',
      nameTechnical: 'Theory of Mind',
    },
  },
  resolveTaskId(params) {
    const taskName = params.taskName as string | undefined;
    if (!taskName) throw new Error('"taskName" is required in params for levante tasks');
    const allTaskIds = { ...LEVANTE_NORMED_TASK_IDS, ...LEVANTE_PROVISIONAL_TASK_IDS };
    const knownIds = new Set(Object.values(allTaskIds));
    if (!knownIds.has(taskName)) {
      throw new Error(`Unknown levante taskName "${taskName}". Known: ${[...knownIds].join(', ')}`);
    }
    return taskName;
  },
};
