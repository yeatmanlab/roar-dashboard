import { getGradeAsNumber } from '../../utils/get-grade-as-number.util';
import {
  UPDATED_NORM_VERSIONS,
  PERCENTILE_CUTOFFS,
  RAW_SCORE_ONLY_TASKS,
  getRawScoreThreshold,
} from './scoring.constants';
import type { SupportLevel, ScoringInput } from './scoring.types';

/**
 * Classify a student's score into a support level for a given task.
 *
 * Algorithm (ported from apps/dashboard/src/helpers/reports.js `getSupportLevel`):
 *
 * 1. If the task is in RAW_SCORE_ONLY_TASKS (e.g., phonics, roam-alpaca), return null
 *    — these tasks display raw scores without support level classification.
 *
 * 2. For grades < 6 with a percentile available:
 *    - Determine if updated norms apply (scoringVersion >= UPDATED_NORM_VERSIONS threshold)
 *    - Apply percentile cutoffs: [50, 25] for legacy, [40, 20] for updated
 *
 * 3. For grades >= 6, or when percentile is unavailable:
 *    - Look up raw score thresholds via getRawScoreThreshold(taskSlug, scoringVersion)
 *    - If thresholds unavailable (unknown task/version), return null
 *    - Classify using raw score against the thresholds
 *
 * @param input - Scoring input with grade, percentile, rawScore, taskSlug, scoringVersion
 * @returns Support level classification, or null if classification is not possible
 */
export function getSupportLevel(input: ScoringInput): SupportLevel | null {
  const { grade, percentile, rawScore, taskSlug, scoringVersion } = input;

  // No score data at all — cannot classify
  if (rawScore === null && percentile === null) {
    return null;
  }

  // Raw-score-only tasks don't get support level classification
  if (RAW_SCORE_ONLY_TASKS.has(taskSlug)) {
    return null;
  }

  const gradeLevel = getGradeAsNumber(grade);

  // Try percentile-based classification for grades < 6
  if (percentile !== null && gradeLevel !== null && gradeLevel < 6) {
    const useUpdatedNorms = hasUpdatedNorms(taskSlug, scoringVersion);
    const cutoffs = useUpdatedNorms ? PERCENTILE_CUTOFFS.updated : PERCENTILE_CUTOFFS.legacy;

    return classifyByThresholds(percentile, cutoffs.achieved, cutoffs.developing);
  }

  // Fall back to raw score thresholds (grades >= 6 or no percentile)
  if (rawScore !== null) {
    const thresholds = getRawScoreThreshold(taskSlug, scoringVersion);
    if (!thresholds) {
      return null;
    }
    return classifyByThresholds(rawScore, thresholds.above, thresholds.some);
  }

  return null;
}

/**
 * Check if a task uses updated norms for the given scoring version.
 *
 * @param taskSlug - Task slug (e.g., 'swr', 'sre')
 * @param scoringVersion - The scoring version, or null for legacy
 * @returns true if updated norms should be applied
 */
function hasUpdatedNorms(taskSlug: string, scoringVersion: number | null): boolean {
  if (scoringVersion === null) return false;
  const threshold = UPDATED_NORM_VERSIONS[taskSlug];
  if (threshold === undefined) return false;
  return scoringVersion >= threshold;
}

/**
 * Classify a numeric score against achieved/developing thresholds.
 * Matches the exact boundary logic from the frontend:
 * - score >= achieved → achievedSkill
 * - score > developing AND score < achieved → developingSkill
 * - otherwise → needsExtraSupport
 *
 * @param score - The score value to classify
 * @param achievedThreshold - The "achieved" boundary (inclusive)
 * @param developingThreshold - The "developing" boundary (exclusive)
 */
function classifyByThresholds(score: number, achievedThreshold: number, developingThreshold: number): SupportLevel {
  if (score >= achievedThreshold) {
    return 'achievedSkill';
  }
  if (score > developingThreshold) {
    return 'developingSkill';
  }
  return 'needsExtraSupport';
}
