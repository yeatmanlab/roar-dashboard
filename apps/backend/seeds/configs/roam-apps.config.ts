/**
 * Seed config for ROAM (Rapid Online Assessment of Math) tasks.
 *
 * ROAM contains three math tasks (fluency-arf, fluency-calf, roam-alpaca), each
 * seeded per language. Unlike roar-levante-tasks, the DB task slug is
 * language-suffixed (e.g. "fluency-arf-es") because roam's scoring configs key
 * off language-suffixed task slugs. The variant's own "taskName" param stays the
 * base value (e.g. "fluency-arf") so the bundle routes correctly via
 * camelize(taskName) in taskConfig.js — only the DB task row's slug carries the
 * language suffix.
 *
 * 'es' and 'pt' are dashboard-supported alongside 'en'. 'it' is migrated in
 * source but intentionally not seeded (see migration plan).
 */
import {
  ROAM_ALPACA_TASK_IDS,
  ROAM_FLUENCY_ARF_TASK_IDS,
  ROAM_FLUENCY_CALF_TASK_IDS,
} from '@roar-platform/assessment-schema/roam-apps';

import type { TaskSeedConfig } from '../task-seed-configs';

const KNOWN_TASK_NAMES = new Set<string>([
  ROAM_FLUENCY_ARF_TASK_IDS.EN,
  ROAM_FLUENCY_CALF_TASK_IDS.EN,
  ROAM_ALPACA_TASK_IDS.EN,
]);

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Spanish',
  pt: 'Portuguese',
};

export const roamAppsConfig: TaskSeedConfig = {
  tasks: {
    [ROAM_FLUENCY_ARF_TASK_IDS.EN]: {
      name: 'Arithmetic Fluency',
      nameSimple: 'ARF',
      nameTechnical: 'ROAM Arithmetic Reasoning Fluency',
    },
    [ROAM_FLUENCY_ARF_TASK_IDS.ES]: {
      name: 'Arithmetic Fluency (Spanish)',
      nameSimple: 'ARF',
      nameTechnical: 'ROAM Arithmetic Reasoning Fluency',
    },
    [ROAM_FLUENCY_ARF_TASK_IDS.PT]: {
      name: 'Arithmetic Fluency (Portuguese)',
      nameSimple: 'ARF',
      nameTechnical: 'ROAM Arithmetic Reasoning Fluency',
    },
    [ROAM_FLUENCY_CALF_TASK_IDS.EN]: {
      name: 'Calculation Fluency',
      nameSimple: 'CALF',
      nameTechnical: 'ROAM Calculation Fluency',
    },
    [ROAM_FLUENCY_CALF_TASK_IDS.ES]: {
      name: 'Calculation Fluency (Spanish)',
      nameSimple: 'CALF',
      nameTechnical: 'ROAM Calculation Fluency',
    },
    [ROAM_FLUENCY_CALF_TASK_IDS.PT]: {
      name: 'Calculation Fluency (Portuguese)',
      nameSimple: 'CALF',
      nameTechnical: 'ROAM Calculation Fluency',
    },
    [ROAM_ALPACA_TASK_IDS.EN]: {
      name: 'Core Math',
      nameSimple: 'Core Math',
      nameTechnical: 'ROAM Alpaca Core Math',
    },
    [ROAM_ALPACA_TASK_IDS.ES]: {
      name: 'Core Math (Spanish)',
      nameSimple: 'Core Math',
      nameTechnical: 'ROAM Alpaca Core Math',
    },
    [ROAM_ALPACA_TASK_IDS.PT]: {
      name: 'Core Math (Portuguese)',
      nameSimple: 'Core Math',
      nameTechnical: 'ROAM Alpaca Core Math',
    },
  },
  validateVariant(loc, params) {
    const { taskName, language } = params;

    if (typeof taskName !== 'string') {
      throw new Error(`${loc}: "taskName" is required in params`);
    }
    if (!KNOWN_TASK_NAMES.has(taskName)) {
      throw new Error(`${loc}: unknown taskName "${taskName}". Known tasks: ${[...KNOWN_TASK_NAMES].join(', ')}`);
    }
    if (typeof language !== 'string') {
      throw new Error(`${loc}: "language" is required in params`);
    }
    if (language !== 'en' && !LANGUAGE_NAMES[language]) {
      throw new Error(
        `${loc}: unsupported language "${language}". Supported: en, ${Object.keys(LANGUAGE_NAMES).join(', ')}`,
      );
    }
  },
  /** Routes each variant to its language-suffixed task slug via `params.taskName` + `params.language`. */
  resolveTaskId(params) {
    const taskName = params.taskName as string;
    const language = params.language as string;
    return language === 'en' ? taskName : `${taskName}-${language}`;
  },
};
