import { sre } from '@roar-platform/assessment-schema';

import type { TaskSeedConfig } from '../task-seed-configs';

const { SRE_TASK_IDS, SRE_LANGUAGES, SRE_SCORING_VERSION } = sre;

const VALID_SCORING_VERSIONS = new Set(Object.values(SRE_SCORING_VERSION));
const SUPPORTED_LANGUAGES = new Set(Object.values(SRE_LANGUAGES).map((l) => l.code));

export const sreConfig: TaskSeedConfig = {
  tasks: {
    [SRE_TASK_IDS.EN]: {
      name: 'Sentence Reading Efficiency',
      nameSimple: 'SRE',
      nameTechnical: 'Rapid Online Assessment of Reading — Sentence Reading Efficiency',
    },
    [SRE_TASK_IDS.ES]: {
      name: 'Sentence Reading Efficiency (Spanish)',
      nameSimple: 'SRE-ES',
      nameTechnical: 'Rapid Online Assessment of Reading — Sentence Reading Efficiency (Spanish)',
    },
    [SRE_TASK_IDS.PT]: {
      name: 'Sentence Reading Efficiency (Portuguese)',
      nameSimple: 'SRE-PT',
      nameTechnical: 'Rapid Online Assessment of Reading — Sentence Reading Efficiency (Portuguese)',
    },
    [SRE_TASK_IDS.DE]: {
      name: 'Sentence Reading Efficiency (German)',
      nameSimple: 'SRE-DE',
      nameTechnical: 'Rapid Online Assessment of Reading — Sentence Reading Efficiency (German)',
    },
  },
  allowedParamKeys: new Set([
    'consent',
    'lng',
    'recruitment',
    'scoringVersion',
    'skipInstructions',
    'storyOption',
    'timerLength',
    'userMode',
  ]),
  validateVariant(loc, params) {
    const lng = params.lng as string | undefined;
    if (!lng) throw new Error(`${loc}: "lng" is required`);

    // Skip unsupported languages gracefully (matches original seed script behavior)
    if (!SUPPORTED_LANGUAGES.has(lng)) {
      return false;
    }

    const scoringVersion = params.scoringVersion as number | null | undefined;
    if (scoringVersion !== undefined && scoringVersion !== null) {
      if (!VALID_SCORING_VERSIONS.has(scoringVersion)) {
        throw new Error(
          `${loc}: invalid scoringVersion ${scoringVersion}. Valid: ${[...VALID_SCORING_VERSIONS].join(', ')}`,
        );
      }
    }
  },
  resolveTaskId(params) {
    const lng = params.lng as string | undefined;
    if (!lng) return SRE_TASK_IDS.EN;
    const entry = Object.values(SRE_LANGUAGES).find((l) => l.code === lng);
    if (!entry) throw new Error(`Unknown SRE language "${lng}"`);
    return entry.taskId;
  },
};
