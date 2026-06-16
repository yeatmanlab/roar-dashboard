import { AssessmentStage } from './enums/assessment-stage.enum.js';
import { ScoreType } from './enums/score-type.enum.js';
import type { ScoreEntryConstraint } from './types/score-entry.type.js';

/**
 * Score names shared across all ROAR assessments.
 * Assessment-specific score names (e.g. PA_SCORE_NAMES, SWR_SCORE_NAMES) extend
 * these with fields that only apply to their own scoring schema.
 */
export const COMMON_SCORE_NAMES = {
  NUM_CORRECT: 'numCorrect',
  NUM_ATTEMPTED: 'numAttempted',
  NUM_INCORRECT: 'numIncorrect',
} as const;

export interface RawCounts {
  numCorrect: number;
  numAttempted: number;
  numIncorrect: number;
}

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
      name: COMMON_SCORE_NAMES.NUM_CORRECT,
      value: String(counts.numCorrect),
      assessmentStage: stage,
    },
    {
      type: ScoreType.RAW,
      domain,
      name: COMMON_SCORE_NAMES.NUM_ATTEMPTED,
      value: String(counts.numAttempted),
      assessmentStage: stage,
    },
    {
      type: ScoreType.RAW,
      domain,
      name: COMMON_SCORE_NAMES.NUM_INCORRECT,
      value: String(counts.numIncorrect),
      assessmentStage: stage,
    },
  ];
}
