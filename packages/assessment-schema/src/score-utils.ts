import { AssessmentStage } from './enums/assessment-stage.enum.js';
import { ScoreType } from './enums/score-type.enum.js';
import type { ScoreEntryConstraint } from './types/score-entry.type.js';
import { PRACTICE_DOMAIN } from './constants/common-domains.js';
import { TRIAL_COUNT_SCORE_NAMES } from './constants/trial-count-score-names.js';

/**
 * Maps a run_scores domain string to its AssessmentStage.
 *
 * Defaults to the shared PRACTICE_DOMAIN ('practice'). Pass a custom practiceDomain
 * when an assessment uses a different string for its practice phase.
 *
 * @param domain - run_scores.domain value
 * @param practiceDomain - domain string that maps to PRACTICE stage (default: 'practice')
 * @returns AssessmentStage.PRACTICE when domain matches practiceDomain, TEST otherwise
 */
export function domainToAssessmentStage(domain: string, practiceDomain: string = PRACTICE_DOMAIN): AssessmentStage {
  return domain === practiceDomain ? AssessmentStage.PRACTICE : AssessmentStage.TEST;
}

/**
 * Trial count fields written as type=raw score entries across all assessments.
 * Derived from TRIAL_COUNT_SCORE_NAMES so adding a new count score name
 * automatically acquires the corresponding field here.
 */
export type RawCounts = Record<(typeof TRIAL_COUNT_SCORE_NAMES)[keyof typeof TRIAL_COUNT_SCORE_NAMES], number>;

/**
 * Builds the canonical 3-entry array for raw trial-count score entries.
 *
 * Used by assessment facades to emit numCorrect, numAttempted, and numIncorrect
 * for a given domain and stage (typically practice). Centralises both the field
 * names and the ScoreType.RAW assignment so facades don't need to duplicate
 * either.
 *
 * @param domain - run_scores.domain value (e.g. 'composite', 'FSM')
 * @param counts - Raw trial counts for the domain
 * @param stage - Assessment stage these counts belong to
 * @returns Three ScoreEntry objects ready for backend upsert
 */
export function buildRawCountEntries(
  domain: string,
  counts: RawCounts,
  stage: AssessmentStage,
): ScoreEntryConstraint[] {
  return [
    {
      type: ScoreType.RAW,
      domain,
      name: TRIAL_COUNT_SCORE_NAMES.NUM_CORRECT,
      value: String(counts.numCorrect),
      assessmentStage: stage,
    },
    {
      type: ScoreType.RAW,
      domain,
      name: TRIAL_COUNT_SCORE_NAMES.NUM_ATTEMPTED,
      value: String(counts.numAttempted),
      assessmentStage: stage,
    },
    {
      type: ScoreType.RAW,
      domain,
      name: TRIAL_COUNT_SCORE_NAMES.NUM_INCORRECT,
      value: String(counts.numIncorrect),
      assessmentStage: stage,
    },
  ];
}
