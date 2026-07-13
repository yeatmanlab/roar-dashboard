import { letter } from '@roar-platform/assessment-schema';

import type { TaskSeedConfig } from '../task-seed-configs';

const { LETTER_TASK_IDS, PHONICS_TASK_IDS } = letter;

export const letterConfig: TaskSeedConfig = {
  tasks: {
    [LETTER_TASK_IDS.EN]: {
      name: 'Letter Names and Sounds',
      nameSimple: 'Letter Names and Sounds',
      nameTechnical: 'Rapid Online Assessment of Reading — Letter Names and Sounds (English)',
    },
    [LETTER_TASK_IDS.ES]: {
      name: 'Nombres y Sonidos de Letras',
      nameSimple: 'Nombres y Sonidos de Letras',
      nameTechnical: 'Rapid Online Assessment of Reading — Letter Names and Sounds (Spanish)',
    },
    [LETTER_TASK_IDS.EN_CA]: {
      name: 'Letter Names and Sounds',
      nameSimple: 'Letter Names and Sounds',
      nameTechnical: 'Rapid Online Assessment of Reading — Letter Names and Sounds (English Canada)',
    },
    [PHONICS_TASK_IDS.EN]: {
      name: 'Phonics',
      nameSimple: 'Phonics',
      nameTechnical: 'Rapid Online Assessment of Reading — Phonics (English)',
    },
  },
  resolveTaskId(params) {
    const language = params.language as string | undefined;
    const task = params.task as string | undefined;
    if (task === 'phonics') return PHONICS_TASK_IDS.EN;
    if (!language || language === 'en') return LETTER_TASK_IDS.EN;
    if (language === 'es') return LETTER_TASK_IDS.ES;
    if (language === 'en-CA' || language === 'en-ca') return LETTER_TASK_IDS.EN_CA;
    throw new Error(`Unknown letter language "${language}"`);
  },
};
