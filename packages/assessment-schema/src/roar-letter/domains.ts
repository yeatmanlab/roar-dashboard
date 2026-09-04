/**
 * Subtask domain names emitted by RoarScores.computedScoreCallback for the letter task.
 * These are the five CAT subtask groups produced by the Clowder engine.
 * Domains whose name contains "Practice" (LetterPractice, PhonemePractice) map to
 * assessmentStage=PRACTICE; all others (LowercaseNames, UppercaseNames, Phonemes) map to TEST.
 */
export const LETTER_SUBTASK_DOMAINS = {
  LETTER_PRACTICE: 'LetterPractice',
  LOWERCASE_NAMES: 'LowercaseNames',
  UPPERCASE_NAMES: 'UppercaseNames',
  PHONEME_PRACTICE: 'PhonemePractice',
  PHONEMES: 'Phonemes',
} as const;

export type LetterSubtaskDomain = (typeof LETTER_SUBTASK_DOMAINS)[keyof typeof LETTER_SUBTASK_DOMAINS];

/**
 * Subtask domain names used by the phonics task within roar-letter.
 * PhonicsPractice maps to assessmentStage=PRACTICE; TextSoundPseudo maps to TEST.
 */
export const PHONICS_SUBTASK_DOMAINS = {
  PHONICS_PRACTICE: 'PhonicsPractice',
  TEXT_SOUND_PSEUDO: 'TextSoundPseudo',
} as const;

export type PhonicsSubtaskDomain = (typeof PHONICS_SUBTASK_DOMAINS)[keyof typeof PHONICS_SUBTASK_DOMAINS];
