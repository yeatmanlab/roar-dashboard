import type { SreScoringVersion, SreTaskId } from './config.js';
import { SRE_TASK_IDS, SRE_SCORING_VERSION } from './config.js';

type SreLanguageEntry = {
  code: string;
  label: string;
  taskId: SreTaskId;
  /**
   * Default scoring version for this language's seed variant.
   * Null for languages without normed scoring (Portuguese, German).
   */
  defaultScoringVersion: SreScoringVersion | null;
};

/**
 * Languages SRE ships variants for. Each language is a separate task in the
 * backend (distinct task ID), unlike assessments where language is a variant param.
 *
 * The seed script produces one task + one default variant per entry.
 * Italian is not included — translation is not yet complete.
 * Add an entry here when SRE is localized into a new language.
 */
export const SRE_LANGUAGES = {
  en: {
    code: 'en',
    label: 'English',
    taskId: SRE_TASK_IDS.EN,
    defaultScoringVersion: SRE_SCORING_VERSION.V4,
  },
  es: {
    code: 'es',
    label: 'Spanish',
    taskId: SRE_TASK_IDS.ES,
    defaultScoringVersion: SRE_SCORING_VERSION.V1,
  },
  pt: {
    code: 'pt',
    label: 'Portuguese',
    taskId: SRE_TASK_IDS.PT,
    defaultScoringVersion: null,
  },
  de: {
    code: 'de',
    label: 'German',
    taskId: SRE_TASK_IDS.DE,
    defaultScoringVersion: null,
  },
  // TODO: Add 'it' when Italian translation is complete (see SRE_TASK_IDS)
} as const satisfies Record<string, SreLanguageEntry>;
