/**
 * Letter task IDs — one per supported language. Mirrors SWR_TASK_IDS / SRE_TASK_IDS.
 * The `lng` URL param selects the language; `serve.js` uses LETTER_LANGUAGES to
 * translate that into the correct task ID for bootstrapAnonymousSession.
 */
export const LETTER_TASK_IDS = {
  EN: 'letter',
  ES: 'letter-es',
  EN_CA: 'letter-en-ca',
} as const;

export type LetterTaskId = (typeof LETTER_TASK_IDS)[keyof typeof LETTER_TASK_IDS];

/**
 * Phonics task IDs — currently English only. Kept separate from LETTER_TASK_IDS
 * because phonics is a distinct task family (different scoring, different corpus).
 */
export const PHONICS_TASK_IDS = {
  EN: 'phonics',
} as const;

export type PhonicsTaskId = (typeof PHONICS_TASK_IDS)[keyof typeof PHONICS_TASK_IDS];

/**
 * Scoring versions for the letter task IRT lookup table.
 * Only the `letter` (EN) task has a normed lookup table — phonics, letter-es,
 * and letter-en-ca produce raw counts only.
 * Default is V1 (matches config.js: scoringVersion ?? 1).
 */
export const LETTER_SCORING_VERSION = {
  V1: 1,
} as const;

export type LetterScoringVersion = (typeof LETTER_SCORING_VERSION)[keyof typeof LETTER_SCORING_VERSION];

/**
 * GCS URL for the letter task IRT scoring lookup table.
 * Columns: ageMonths, thetaEstimate, roarScore, standardScore, percentile.
 *
 * @param version - The scoring version
 * @returns The full GCS URL for the lookup table
 */
export const LETTER_SCORE_TABLE_URL = (version: LetterScoringVersion): string =>
  `https://storage.googleapis.com/roar-ak/scores/letter_lookup_v${version}.csv`;

/**
 * Clowder CAT category names for the letter assessment engine.
 * These are the internal identifiers for the Clowder adaptive testing algorithm —
 * used in catOrderMap, catsConfig, requiredItems, and catsToUpdate arrays.
 * Distinct from run_scores domain names (see LETTER_SUBTASK_DOMAINS in score-names.ts).
 * The mapping between these names and domain names lives in catToSubTaskMap in experimentSetup.js.
 */
export const LETTER_CAT_NAMES = {
  LETTER_NAME_PRACTICE: 'letterNamePractice',
  LETTER_NAME_LOWER: 'letterNameLower',
  LETTER_NAME_UPPER: 'letterNameUpper',
  LETTER_PHONEME_PRACTICE: 'letterPhonemePractice',
  LETTER_PHONEME: 'letterPhoneme',
} as const;

export type LetterCatName = (typeof LETTER_CAT_NAMES)[keyof typeof LETTER_CAT_NAMES];
