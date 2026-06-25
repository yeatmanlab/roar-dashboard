import { LETTER_SUBTASK_DOMAINS } from './domains.js';
import { LETTER_SUBTASK_SCORE_NAMES, PHONICS_GROUP_SCORE_NAMES } from './score-names.js';
import type { LetterSubtaskDomain } from './domains.js';
import type { LetterSubtaskScoreName, PhonicsGroupScoreName } from './score-names.js';

// ─── Phonics subscore column defs ─────────────────────────────────────────────
//
// The reporting-side grouping for phonics sub-skill columns: which run_scores
// names form each column, plus its display label and canonical order. Backends
// import these and add only presentation discriminators (kind / key / round).
// This is the reporting counterpart to PHONICS_SUBSCORE_GROUPS in
// score-entries.ts (the emission flattener); both anchor on the same
// PHONICS_GROUP_SCORE_NAMES, so they cannot drift.

/** Canonical, ordered phonics sub-skill keys (snake_case to match historical response keys). */
export const PHONICS_SUBSKILL_KEYS = [
  'cvc',
  'digraph',
  'initial_blend',
  'tri_blend',
  'final_blend',
  'r_controlled',
  'r_cluster',
  'silent_e',
  'vowel_team',
] as const;

export type PhonicsSubskillKey = (typeof PHONICS_SUBSKILL_KEYS)[number];

export interface PhonicsSubskillDef {
  /** Human-readable column header label. */
  label: string;
  correctName: PhonicsGroupScoreName;
  attemptedName: PhonicsGroupScoreName;
}

export const PHONICS_SUBSKILL_DEFS = {
  cvc: {
    label: 'CVC',
    correctName: PHONICS_GROUP_SCORE_NAMES.CVC_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.CVC_ATTEMPTED,
  },
  digraph: {
    label: 'Digraph',
    correctName: PHONICS_GROUP_SCORE_NAMES.DIGRAPH_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.DIGRAPH_ATTEMPTED,
  },
  initial_blend: {
    label: 'Initial Blend',
    correctName: PHONICS_GROUP_SCORE_NAMES.INITIAL_BLEND_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.INITIAL_BLEND_ATTEMPTED,
  },
  tri_blend: {
    label: 'Triple Blend',
    correctName: PHONICS_GROUP_SCORE_NAMES.TRI_BLEND_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.TRI_BLEND_ATTEMPTED,
  },
  final_blend: {
    label: 'Final Blend',
    correctName: PHONICS_GROUP_SCORE_NAMES.FINAL_BLEND_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.FINAL_BLEND_ATTEMPTED,
  },
  r_controlled: {
    label: 'R-Controlled',
    correctName: PHONICS_GROUP_SCORE_NAMES.R_CONTROLLED_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.R_CONTROLLED_ATTEMPTED,
  },
  r_cluster: {
    label: 'R-Cluster',
    correctName: PHONICS_GROUP_SCORE_NAMES.R_CLUSTER_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.R_CLUSTER_ATTEMPTED,
  },
  silent_e: {
    label: 'Silent E',
    correctName: PHONICS_GROUP_SCORE_NAMES.SILENT_E_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.SILENT_E_ATTEMPTED,
  },
  vowel_team: {
    label: 'Vowel Team',
    correctName: PHONICS_GROUP_SCORE_NAMES.VOWEL_TEAM_CORRECT,
    attemptedName: PHONICS_GROUP_SCORE_NAMES.VOWEL_TEAM_ATTEMPTED,
  },
} as const satisfies Record<PhonicsSubskillKey, PhonicsSubskillDef>;

// ─── Letter subscore column defs ──────────────────────────────────────────────
//
// Per-subtask grouping for the letter subscore table. Letter is domain-indexed:
// the per-subtask value is the generic `subScore` emitted under a per-subtask
// domain, and the "to work on" list is that subtask's incorrect-items field.
// Mirrors the legacy dashboard mapping (ScoreReport.vue).

/** Ordered letter subtask column keys. */
export const LETTER_SUBSCORE_KEYS = ['lowerCase', 'upperCase', 'letterSounds'] as const;

export type LetterSubscoreKey = (typeof LETTER_SUBSCORE_KEYS)[number];

export interface LetterSubscoreDef {
  /** Human-readable column header label. */
  label: string;
  /** run_scores.domain the subtask's scores are emitted under. */
  domain: LetterSubtaskDomain;
  /** Generic per-subtask score name (subScore), read under `domain`. */
  scoreName: LetterSubtaskScoreName;
  /** Per-subtask incorrect-items list name (comma-joined item IDs), read under `domain`. */
  incorrectName: LetterSubtaskScoreName;
}

export const LETTER_SUBSCORE_DEFS = {
  lowerCase: {
    label: 'Lower Case',
    domain: LETTER_SUBTASK_DOMAINS.LOWERCASE_NAMES,
    scoreName: LETTER_SUBTASK_SCORE_NAMES.SUB_SCORE,
    incorrectName: LETTER_SUBTASK_SCORE_NAMES.LOWER_INCORRECT,
  },
  upperCase: {
    label: 'Upper Case',
    domain: LETTER_SUBTASK_DOMAINS.UPPERCASE_NAMES,
    scoreName: LETTER_SUBTASK_SCORE_NAMES.SUB_SCORE,
    incorrectName: LETTER_SUBTASK_SCORE_NAMES.UPPER_INCORRECT,
  },
  letterSounds: {
    label: 'Letter Sounds',
    domain: LETTER_SUBTASK_DOMAINS.PHONEMES,
    scoreName: LETTER_SUBTASK_SCORE_NAMES.SUB_SCORE,
    incorrectName: LETTER_SUBTASK_SCORE_NAMES.PHONEME_INCORRECT,
  },
} as const satisfies Record<LetterSubscoreKey, LetterSubscoreDef>;
