import { pa } from '@roar-platform/assessment-schema';

import type { TaskSeedConfig } from '../task-seed-configs';

const { PA_TASK_ID, PA_LANGUAGES, PA_SCORING_VERSION } = pa;

const VALID_PA_LANGUAGES = new Set(Object.keys(PA_LANGUAGES));
const VALID_PA_SCORING_VERSIONS = new Set<unknown>(Object.values(PA_SCORING_VERSION));

export const paConfig: TaskSeedConfig = {
  tasks: {
    [PA_TASK_ID]: {
      name: 'Phonological Awareness',
      nameSimple: 'Phonological Awareness',
      nameTechnical: 'Rapid Online Assessment of Reading — Phonological Awareness',
    },
  },
  allowedParamKeys: new Set([
    'abilityMethod',
    'consent',
    'earlyStopping',
    'isAdaptive',
    'itemSelect',
    'language',
    'logicalOperation',
    'numTestItems',
    'randomSeed',
    'recruitment',
    'scoreKind',
    'scoringVersion',
    'skipInstructions',
    'storyOption',
    'userMode',
  ]),
  validateVariant(loc, params) {
    if (!('language' in params)) {
      throw new Error(`${loc}: "language" is required`);
    }
    if (!VALID_PA_LANGUAGES.has(params.language as string)) {
      throw new Error(`${loc}: "language" must be one of ${[...VALID_PA_LANGUAGES].join(', ')}`);
    }
    if ('scoringVersion' in params && params.scoringVersion !== null) {
      if (!VALID_PA_SCORING_VERSIONS.has(params.scoringVersion)) {
        throw new Error(`${loc}: "scoringVersion" must be one of ${[...VALID_PA_SCORING_VERSIONS].join(', ')} or null`);
      }
    }
  },
};
