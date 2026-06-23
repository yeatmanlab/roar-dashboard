import type { LetterScoringVersion, LetterTaskId } from './config.js';
import { LETTER_TASK_IDS, LETTER_SCORING_VERSION } from './config.js';

type LetterLanguageEntry = {
  code: string;
  label: string;
  taskId: LetterTaskId;
  /**
   * Default scoring version for this language's seed variant.
   * Null for languages without normed IRT scoring (letter-es, letter-en-ca).
   */
  defaultScoringVersion: LetterScoringVersion | null;
};

/**
 * Languages the letter task ships variants for. Each language is a separate
 * task in the backend (distinct task ID), mirroring the SWR/SRE pattern.
 *
 * Italian has stimulus CSVs in the source but is NOT registered as a task ID.
 * Add an entry here only when a backend task + scoring config exists for it.
 */
export const LETTER_LANGUAGES = {
  en: {
    code: 'en',
    label: 'English',
    taskId: LETTER_TASK_IDS.EN,
    defaultScoringVersion: LETTER_SCORING_VERSION.V1,
  },
  es: {
    code: 'es',
    label: 'Spanish',
    taskId: LETTER_TASK_IDS.ES,
    defaultScoringVersion: null,
  },
  'en-ca': {
    code: 'en-CA',
    label: 'English (Canada)',
    taskId: LETTER_TASK_IDS.EN_CA,
    defaultScoringVersion: null,
  },
} as const satisfies Record<string, LetterLanguageEntry>;

/**
 * i18next language codes used for corpus and configuration branching in the letter assessment.
 * These are the values that i18next.language returns after changeLanguage() is called —
 * they may differ from LETTER_LANGUAGES keys (which are lowercase URL-convention codes).
 *
 * EN, ES, EN_CA correspond to supported letter variants registered in LETTER_LANGUAGES.
 * IT (Italian) has stimulus CSVs in the source but is not a registered backend task;
 * it is included here only for the corpus-selection code path that predates task registration.
 */
export const LETTER_LANGUAGE_CODES = {
  EN: 'en',
  ES: 'es',
  IT: 'it',
  EN_CA: 'en-CA',
} as const;
