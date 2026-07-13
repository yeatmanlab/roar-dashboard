import { levante } from '@roar-platform/assessment-schema';

import type { TaskSeedConfig } from '../task-seed-configs';

const { LEVANTE_NORMED_TASK_IDS, LEVANTE_PROVISIONAL_TASK_IDS } = levante;

// Tasks that exist in the assessment but don't have constants in @roar-platform/assessment-schema
// (no normed or provisional scoring config). They still need to be seeded so variants can reference them.
const LEVANTE_ADDITIONAL_TASK_IDS = {
  ADULT_REASONING: 'adult-reasoning',
  VOCAB: 'vocab',
  HEARTS_AND_FLOWERS: 'hearts-and-flowers',
  MEMORY_GAME: 'memory-game',
  INTRO: 'intro',
} as const;

const ALL_LEVANTE_TASK_IDS = {
  ...LEVANTE_NORMED_TASK_IDS,
  ...LEVANTE_PROVISIONAL_TASK_IDS,
  ...LEVANTE_ADDITIONAL_TASK_IDS,
};

export const levanteConfig: TaskSeedConfig = {
  tasks: {
    [LEVANTE_NORMED_TASK_IDS.TROG]: {
      name: 'Words and Pictures Game',
      nameSimple: 'Syntax',
      nameTechnical: 'Syntax',
    },
    [LEVANTE_NORMED_TASK_IDS.ROAR_INFERENCE]: {
      name: 'ROAR - Inference',
      nameSimple: 'Inference',
      nameTechnical: 'Inference',
    },
    [LEVANTE_PROVISIONAL_TASK_IDS.EGMA_MATH]: {
      name: 'EGMA Math',
      nameSimple: 'Math',
      nameTechnical: 'Early Grade Mathematics Assessment',
    },
    [LEVANTE_PROVISIONAL_TASK_IDS.MATRIX_REASONING]: {
      name: 'Matrix Reasoning',
      nameSimple: 'Matrix Reasoning',
      nameTechnical: 'LEVANTE Matrix Reasoning',
    },
    [LEVANTE_PROVISIONAL_TASK_IDS.MENTAL_ROTATION]: {
      name: 'Mental Rotation',
      nameSimple: 'Mental Rotation',
      nameTechnical: 'LEVANTE Mental Rotation',
    },
    [LEVANTE_PROVISIONAL_TASK_IDS.SAME_DIFFERENT_SELECTION]: {
      name: 'Same-Different Selection',
      nameSimple: 'SDS',
      nameTechnical: 'LEVANTE Same-Different Selection',
    },
    [LEVANTE_PROVISIONAL_TASK_IDS.THEORY_OF_MIND]: {
      name: 'Theory of Mind',
      nameSimple: 'ToM',
      nameTechnical: 'LEVANTE Theory of Mind',
    },
    [LEVANTE_ADDITIONAL_TASK_IDS.ADULT_REASONING]: {
      name: 'Adult Reasoning',
      nameSimple: 'Adult Reasoning',
      nameTechnical: 'LEVANTE Adult Reasoning',
    },
    [LEVANTE_ADDITIONAL_TASK_IDS.VOCAB]: {
      name: 'Vocabulary',
      nameSimple: 'Vocab',
      nameTechnical: 'LEVANTE Vocabulary Assessment',
    },
    [LEVANTE_ADDITIONAL_TASK_IDS.HEARTS_AND_FLOWERS]: {
      name: 'Hearts & Flowers',
      nameSimple: 'H&F',
      nameTechnical: 'LEVANTE Hearts and Flowers',
    },
    [LEVANTE_ADDITIONAL_TASK_IDS.MEMORY_GAME]: {
      name: 'Memory Game',
      nameSimple: 'Memory',
      nameTechnical: 'LEVANTE Memory Game',
    },
    [LEVANTE_ADDITIONAL_TASK_IDS.INTRO]: {
      name: 'Intro',
      nameSimple: 'Intro',
      nameTechnical: 'LEVANTE Intro',
    },
  },
  resolveTaskId(params) {
    const taskName = params.taskName as string | undefined;
    if (!taskName) throw new Error('"taskName" is required in params for levante tasks');
    const knownIds = new Set(Object.values(ALL_LEVANTE_TASK_IDS));
    if (!knownIds.has(taskName)) {
      throw new Error(`Unknown levante taskName "${taskName}". Known: ${[...knownIds].join(', ')}`);
    }
    return taskName;
  },
};
