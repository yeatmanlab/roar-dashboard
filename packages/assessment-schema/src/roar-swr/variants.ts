import type { SwrScoringVersion, SwrTaskId } from './config.js';
import { SWR_TASK_IDS, SWR_SCORING_VERSION } from './config.js';

type SwrLanguageEntry = {
  code: string;
  label: string;
  taskId: SwrTaskId;
  /**
   * Default scoring version for this language's seed variant.
   * Null for languages without normed scoring (Italian, Portuguese, German).
   */
  defaultScoringVersion: SwrScoringVersion | null;
};

/**
 * Languages SWR ships variants for. Each language is a separate task in the
 * backend (distinct task ID), unlike assessments where language is a variant param.
 *
 * The seed script produces one task + one default variant per entry.
 * Add an entry here when SWR is localized into a new language.
 */
export const SWR_LANGUAGES = {
  en: {
    code: 'en',
    label: 'English',
    taskId: SWR_TASK_IDS.EN,
    defaultScoringVersion: SWR_SCORING_VERSION.V7,
  },
  es: {
    code: 'es',
    label: 'Spanish',
    taskId: SWR_TASK_IDS.ES,
    defaultScoringVersion: SWR_SCORING_VERSION.V1,
  },
  it: {
    code: 'it',
    label: 'Italian',
    taskId: SWR_TASK_IDS.IT,
    defaultScoringVersion: null,
  },
  pt: {
    code: 'pt',
    label: 'Portuguese',
    taskId: SWR_TASK_IDS.PT,
    defaultScoringVersion: null,
  },
  de: {
    code: 'de',
    label: 'German',
    taskId: SWR_TASK_IDS.DE,
    defaultScoringVersion: null,
  },
} as const satisfies Record<string, SwrLanguageEntry>;
