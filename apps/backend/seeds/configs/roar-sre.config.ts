/**
 * Seed config for ROAR Sentence Reading Efficiency (SRE).
 *
 * SRE is a sentence-level reading fluency assessment available in multiple languages.
 * Each language maps to a separate backend task (sre, sre-es, sre-pt, sre-de) via the
 * `lng` param.
 *
 * Unlike SWR, SRE silently skips unsupported languages rather than throwing — this
 * matches the original seed script behavior where new languages in the parameters file
 * were ignored until backend support was added.
 *
 * Params match the gameParams from roar-sre's serve.js.
 */
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

    // Gracefully skip languages not yet supported by the backend (return false = skip).
    // This lets the parameters file include future languages without breaking the seed.
    if (!SUPPORTED_LANGUAGES.has(lng)) {
      return false;
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
    if (!lng) return SRE_TASK_IDS.EN;
    const entry = Object.values(SRE_LANGUAGES).find((l) => l.code === lng);
    if (!entry) throw new Error(`Unknown SRE language "${lng}"`);
    return entry.taskId;
  },
};
