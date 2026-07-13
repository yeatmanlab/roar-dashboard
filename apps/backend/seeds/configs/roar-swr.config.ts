import { swr } from '@roar-platform/assessment-schema';

import type { TaskSeedConfig } from '../task-seed-configs';

const { SWR_TASK_IDS } = swr;

export const swrConfig: TaskSeedConfig = {
  tasks: {
    [SWR_TASK_IDS.EN]: {
      name: 'Sight Word Reading',
      nameSimple: 'Sight Word Reading',
      nameTechnical: 'Rapid Online Assessment of Reading — Sight Word Reading (English)',
    },
    [SWR_TASK_IDS.ES]: {
      name: 'Lectura de Palabras',
      nameSimple: 'Lectura de Palabras',
      nameTechnical: 'Rapid Online Assessment of Reading — Sight Word Reading (Spanish)',
    },
    [SWR_TASK_IDS.IT]: {
      name: 'Lettura di Parole',
      nameSimple: 'Lettura di Parole',
      nameTechnical: 'Rapid Online Assessment of Reading — Sight Word Reading (Italian)',
    },
    [SWR_TASK_IDS.PT]: {
      name: 'Leitura de Palavras',
      nameSimple: 'Leitura de Palavras',
      nameTechnical: 'Rapid Online Assessment of Reading — Sight Word Reading (Portuguese)',
    },
    [SWR_TASK_IDS.DE]: {
      name: 'Wortlesen',
      nameSimple: 'Wortlesen',
      nameTechnical: 'Rapid Online Assessment of Reading — Sight Word Reading (German)',
    },
  },
  resolveTaskId(params) {
    const language = params.language as string | undefined;
    if (!language) return SWR_TASK_IDS.EN;
    const entry = Object.values(swr.SWR_LANGUAGES).find((l) => l.code === language);
    if (!entry) throw new Error(`Unknown SWR language "${language}"`);
    return entry.taskId;
  },
};
