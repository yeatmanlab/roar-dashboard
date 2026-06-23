import { THETA_SCORE_NAMES } from '../constants/theta-score-names.js';

// ─── Letter score names ───────────────────────────────────────────────────────
// The letter task (taskId: 'letter', 'letter-es', 'letter-en-ca') uses Clowder
// with five named CAT subtasks:
//   LetterPractice, LowercaseNames, UppercaseNames, PhonemePractice, Phonemes
// plus composite and composite_foundational rollup domains.

/**
 * Canonical run_scores.name strings for letter subtask domains
 * (LetterPractice, LowercaseNames, UppercaseNames, PhonemePractice, Phonemes).
 * All subtask entries are type=COMPUTED — counts and item lists are accumulated
 * across trials rather than captured per-trial.
 *
 * Item list fields (lowerCorrect, etc.) are comma-joined strings of item IDs.
 * They are emitted for ALL subtasks (both practice and test) when non-null,
 * matching observed production Firestore behavior.
 */
export const LETTER_SUBTASK_SCORE_NAMES = {
  SUB_SCORE: 'subScore',
  SUB_PERCENT_CORRECT: 'subPercentCorrect',
  LOWER_CORRECT: 'lowerCorrect',
  LOWER_INCORRECT: 'lowerIncorrect',
  UPPER_CORRECT: 'upperCorrect',
  UPPER_INCORRECT: 'upperIncorrect',
  PHONEME_CORRECT: 'phonemeCorrect',
  PHONEME_INCORRECT: 'phonemeIncorrect',
} as const;

export type LetterSubtaskScoreName = (typeof LETTER_SUBTASK_SCORE_NAMES)[keyof typeof LETTER_SUBTASK_SCORE_NAMES];

/**
 * Canonical run_scores.name strings for the letter composite domain.
 * English (letter) produces IRT theta estimates and normed scores.
 * Spanish and Canadian English (letter-es, letter-en-ca) return null from
 * computedScoreCallback — toLetterScoreEntries(null) returns [].
 *
 * - thetaEstimateRaw / thetaSERaw / totalCorrect / totalNumAttempted → type=RAW
 * - Everything else → type=COMPUTED
 */
export const LETTER_COMPOSITE_SCORE_NAMES = {
  ...THETA_SCORE_NAMES,
  TOTAL_CORRECT: 'totalCorrect',
  TOTAL_NUM_ATTEMPTED: 'totalNumAttempted',
  TOTAL_PERCENT_CORRECT: 'totalPercentCorrect',
  ROAR_SCORE: 'roarScore',
  STANDARD_SCORE: 'standardScore',
  PERCENTILE: 'percentile',
  ROAR_SCORE_KIND: 'roarScoreKind',
  SCORING_VERSION: 'scoringVersion',
} as const;

export type LetterCompositeScoreName = (typeof LETTER_COMPOSITE_SCORE_NAMES)[keyof typeof LETTER_COMPOSITE_SCORE_NAMES];

/**
 * Score names in the composite domain that map to type='raw'.
 * These are direct measurements: native-scale IRT estimates from the CAT engine
 * and cumulative trial counts.
 */
export const LETTER_RAW_COMPOSITE_SCORE_NAMES = new Set<LetterCompositeScoreName>([
  LETTER_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE_RAW,
  LETTER_COMPOSITE_SCORE_NAMES.THETA_SE_RAW,
  LETTER_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT,
  LETTER_COMPOSITE_SCORE_NAMES.TOTAL_NUM_ATTEMPTED,
]);

/**
 * Canonical run_scores.name strings for the letter composite_foundational domain.
 * Carries IRT estimates and metadata for the foundational letter-knowledge sub-score.
 * thetaEstimateRaw and thetaSERaw are type=RAW (native-scale estimates from the CAT engine);
 * all other entries are type=COMPUTED.
 */
export const LETTER_COMPOSITE_FOUNDATIONAL_SCORE_NAMES = {
  ...THETA_SCORE_NAMES,
  ROAR_SCORE_KIND: 'roarScoreKind',
  SCORING_VERSION: 'scoringVersion',
} as const;

export type LetterCompositeFoundationalScoreName =
  (typeof LETTER_COMPOSITE_FOUNDATIONAL_SCORE_NAMES)[keyof typeof LETTER_COMPOSITE_FOUNDATIONAL_SCORE_NAMES];

/**
 * Score names in the composite_foundational domain that map to type='raw'.
 * Native-scale IRT estimates from the CAT engine, parallel to LETTER_RAW_COMPOSITE_SCORE_NAMES
 * in the composite domain.
 */
export const LETTER_RAW_FOUNDATIONAL_SCORE_NAMES = new Set<LetterCompositeFoundationalScoreName>([
  LETTER_COMPOSITE_FOUNDATIONAL_SCORE_NAMES.THETA_ESTIMATE_RAW,
  LETTER_COMPOSITE_FOUNDATIONAL_SCORE_NAMES.THETA_SE_RAW,
]);

export type LetterScoreName = LetterSubtaskScoreName | LetterCompositeScoreName | LetterCompositeFoundationalScoreName;

// ─── Phonics score names ──────────────────────────────────────────────────────
// The phonics task (taskId: 'phonics') has a different score shape:
// raw counts + phonics group subscores, no IRT theta.

/**
 * Canonical run_scores.name strings for phonics subtask domains.
 * All phonics domains → assessmentStage=TEST (no practice phase).
 */
export const PHONICS_SUBTASK_SCORE_NAMES = {
  SUB_SCORE: 'subScore',
  SUB_PERCENT_CORRECT: 'subPercentCorrect',
} as const;

export type PhonicsSubtaskScoreName = (typeof PHONICS_SUBTASK_SCORE_NAMES)[keyof typeof PHONICS_SUBTASK_SCORE_NAMES];

/**
 * Flat run_scores.name strings for phonics group subscores.
 * scores.js produces composite.subscores = { cvc: { correct, attempted }, … }
 * (nested). toPhonicsScoreEntries flattens these to the names below.
 *
 * Values must match phonics.json subscores[*].correctName / attemptedName exactly.
 * Do not change the string values without updating phonics.json.
 */
export const PHONICS_GROUP_SCORE_NAMES = {
  CVC_CORRECT: 'cvcCorrect',
  CVC_ATTEMPTED: 'cvcAttempted',
  DIGRAPH_CORRECT: 'digraphCorrect',
  DIGRAPH_ATTEMPTED: 'digraphAttempted',
  INITIAL_BLEND_CORRECT: 'initialBlendCorrect',
  INITIAL_BLEND_ATTEMPTED: 'initialBlendAttempted',
  TRI_BLEND_CORRECT: 'triBlendCorrect',
  TRI_BLEND_ATTEMPTED: 'triBlendAttempted',
  FINAL_BLEND_CORRECT: 'finalBlendCorrect',
  FINAL_BLEND_ATTEMPTED: 'finalBlendAttempted',
  R_CONTROLLED_CORRECT: 'rControlledCorrect',
  R_CONTROLLED_ATTEMPTED: 'rControlledAttempted',
  R_CLUSTER_CORRECT: 'rClusterCorrect',
  R_CLUSTER_ATTEMPTED: 'rClusterAttempted',
  SILENT_E_CORRECT: 'silentECorrect',
  SILENT_E_ATTEMPTED: 'silentEAttempted',
  VOWEL_TEAM_CORRECT: 'vowelTeamCorrect',
  VOWEL_TEAM_ATTEMPTED: 'vowelTeamAttempted',
} as const;

export type PhonicsGroupScoreName = (typeof PHONICS_GROUP_SCORE_NAMES)[keyof typeof PHONICS_GROUP_SCORE_NAMES];

/**
 * Top-level (non-subscores) fields in the phonics composite domain.
 * totalCorrect / totalNumAttempted → type=RAW; everything else → type=COMPUTED.
 * Group subscores (cvcCorrect, etc.) are handled separately via PHONICS_SUBSCORE_GROUPS.
 */
export const PHONICS_COMPOSITE_SCORE_NAMES = {
  TOTAL_CORRECT: 'totalCorrect',
  TOTAL_NUM_ATTEMPTED: 'totalNumAttempted',
  TOTAL_PERCENT_CORRECT: 'totalPercentCorrect',
  ROAR_SCORE_KIND: 'roarScoreKind',
  SCORING_VERSION: 'scoringVersion',
} as const;

export type PhonicsCompositeScoreName =
  (typeof PHONICS_COMPOSITE_SCORE_NAMES)[keyof typeof PHONICS_COMPOSITE_SCORE_NAMES];

/**
 * Score names in the phonics composite domain that map to type='raw'.
 */
export const PHONICS_RAW_COMPOSITE_SCORE_NAMES = new Set<PhonicsCompositeScoreName>([
  PHONICS_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT,
  PHONICS_COMPOSITE_SCORE_NAMES.TOTAL_NUM_ATTEMPTED,
]);

export type PhonicsScoreName = PhonicsSubtaskScoreName | PhonicsCompositeScoreName | PhonicsGroupScoreName;
