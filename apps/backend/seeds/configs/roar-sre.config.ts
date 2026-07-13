import { sre } from '@roar-platform/assessment-schema';

import type { TaskSeedConfig } from '../task-seed-configs';

const { SRE_TASK_IDS } = sre;

export const sreConfig: TaskSeedConfig = {
  tasks: {
    [SRE_TASK_IDS.EN]: {
      name: 'Sentence Reading Efficiency',
      nameSimple: 'Sentence Reading Efficiency',
      nameTechnical: 'Rapid Online Assessment of Reading — Sentence Reading Efficiency (English)',
    },
    [SRE_TASK_IDS.ES]: {
      name: 'Eficiencia de Lectura de Oraciones',
      nameSimple: 'Eficiencia de Lectura',
      nameTechnical: 'Rapid Online Assessment of Reading — Sentence Reading Efficiency (Spanish)',
    },
    [SRE_TASK_IDS.PT]: {
      name: 'Eficiência de Leitura de Frases',
      nameSimple: 'Eficiência de Leitura',
      nameTechnical: 'Rapid Online Assessment of Reading — Sentence Reading Efficiency (Portuguese)',
    },
    [SRE_TASK_IDS.DE]: {
      name: 'Satzleseeffizienz',
      nameSimple: 'Satzleseeffizienz',
      nameTechnical: 'Rapid Online Assessment of Reading — Sentence Reading Efficiency (German)',
    },
  },
  resolveTaskId(params) {
    const language = params.language as string | undefined;
    if (!language) return SRE_TASK_IDS.EN;
    const entry = Object.values(sre.SRE_LANGUAGES).find((l) => l.code === language);
    if (!entry) throw new Error(`Unknown SRE language "${language}"`);
    return entry.taskId;
  },
};
