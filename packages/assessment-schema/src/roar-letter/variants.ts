import type { LetterScoringVersion, LetterTaskId } from './config.js';
import { LETTER_TASK_IDS, LETTER_SCORING_VERSION, PHONICS_TASK_IDS } from './config.js';

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
 * Derives a task ID from the task name and i18next language code.
 *
 * Task variant parameters carry `task` and `language` but not `taskId`.
 * This function maps the combination to the correct backend task ID so that
 * scoring guard logic in the assessment can branch on it correctly.
 *
 * Language lookup is case-insensitive: 'en-CA' and 'en-ca' both resolve to
 * LETTER_TASK_IDS.EN_CA. Unknown languages fall back to LETTER_TASK_IDS.EN.
 *
 * @param task - Task name from variant params (e.g. 'letter', 'phonics')
 * @param language - i18next language code (e.g. 'en', 'es', 'en-CA')
 * @returns The resolved task ID
 */
export function resolveTaskId(task: string, language: string): string {
  if (task === PHONICS_TASK_IDS.EN) return PHONICS_TASK_IDS.EN;
  return LETTER_LANGUAGES[language.toLowerCase() as keyof typeof LETTER_LANGUAGES]?.taskId ?? LETTER_TASK_IDS.EN;
}

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
