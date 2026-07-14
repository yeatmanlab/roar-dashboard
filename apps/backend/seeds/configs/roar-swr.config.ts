/**
 * Seed config for ROAR Single Word Recognition (SWR).
 *
 * SWR is a single-word reading fluency assessment available in multiple languages.
 * Each language maps to a separate backend task (swr, swr-es, swr-it, swr-pt, swr-de)
 * via the `lng` param — the task set is derived from the unique `lng` values in the
 * parameters file.
 *
 * Params match the gameParams from roar-swr's serve.js.
 */
import { swr } from '@roar-platform/assessment-schema';

import type { TaskSeedConfig } from '../task-seed-configs';

const { SWR_TASK_IDS, SWR_LANGUAGES, SWR_SCORING_VERSION } = swr;

const VALID_SCORING_VERSIONS = new Set(Object.values(SWR_SCORING_VERSION));

export const swrConfig: TaskSeedConfig = {
  tasks: {
    [SWR_TASK_IDS.EN]: {
      name: 'Single Word Recognition',
      nameSimple: 'SWR',
      nameTechnical: 'Rapid Online Assessment of Reading — Single Word Recognition',
    },
    [SWR_TASK_IDS.ES]: {
      name: 'Single Word Recognition (Spanish)',
      nameSimple: 'SWR-ES',
      nameTechnical: 'Rapid Online Assessment of Reading — Single Word Recognition (Spanish)',
    },
    [SWR_TASK_IDS.IT]: {
      name: 'Single Word Recognition (Italian)',
      nameSimple: 'SWR-IT',
      nameTechnical: 'Rapid Online Assessment of Reading — Single Word Recognition (Italian)',
    },
    [SWR_TASK_IDS.PT]: {
      name: 'Single Word Recognition (Portuguese)',
      nameSimple: 'SWR-PT',
      nameTechnical: 'Rapid Online Assessment of Reading — Single Word Recognition (Portuguese)',
    },
    [SWR_TASK_IDS.DE]: {
      name: 'Single Word Recognition (German)',
      nameSimple: 'SWR-DE',
      nameTechnical: 'Rapid Online Assessment of Reading — Single Word Recognition (German)',
    },
  },
  allowedParamKeys: new Set([
    'addNoResponse',
    'audioFeedbackOption',
    'consent',
    'lng',
    'numAdaptive',
    'numNew',
    'numValidated',
    'recruitment',
    'scoringVersion',
    'skipInstructions',
    'storyOption',
    'userMode',
  ]),
  validateVariant(loc, params) {
    const lng = params.lng as string | undefined;
    if (!lng) throw new Error(`${loc}: "lng" is required`);

    // lng must be a known SWR language code (e.g., "en", "es", "it", "pt", "de")
    const validLanguages = new Set(Object.values(SWR_LANGUAGES).map((l) => l.code));
    if (!validLanguages.has(lng)) {
      throw new Error(`${loc}: unsupported lng "${lng}". Valid: ${[...validLanguages].join(', ')}`);
    }

    // scoringVersion is optional but must match a known version when present
    const scoringVersion = params.scoringVersion as number | null | undefined;
    if (scoringVersion !== undefined && scoringVersion !== null) {
      if (!VALID_SCORING_VERSIONS.has(scoringVersion)) {
        throw new Error(
          `${loc}: invalid scoringVersion ${scoringVersion}. Valid: ${[...VALID_SCORING_VERSIONS].join(', ')}`,
        );
      }
    }
  },
  /** Routes each variant to its language-specific task via the `lng` param. */
  resolveTaskId(params) {
    const lng = params.lng as string | undefined;
    if (!lng) return SWR_TASK_IDS.EN;
    const entry = Object.values(SWR_LANGUAGES).find((l) => l.code === lng);
    if (!entry) throw new Error(`Unknown SWR language "${lng}"`);
    return entry.taskId;
  },
};
