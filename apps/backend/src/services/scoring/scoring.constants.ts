import type { RawScoreThreshold, ScoreFieldResolution } from './scoring.types';

/**
 * Scoring version thresholds that determine when "updated norms" apply.
 * When scoringVersion >= the threshold, the updated percentile cutoffs [40, 20] are used
 * instead of the legacy cutoffs [50, 25].
 *
 * Ported from apps/dashboard/src/helpers/reports.js `updatedNormVersions`.
 */
export const UPDATED_NORM_VERSIONS: Record<string, number> = {
  swr: 7,
  'swr-es': 1,
  sre: 4,
  'sre-es': 1,
  pa: 4,
};

/**
 * Percentile cutoffs for support level classification (grades < 6).
 *
 * - Legacy norms: percentile >= 50 → achieved, > 25 → developing, else → needs support
 * - Updated norms: percentile >= 40 → achieved, > 20 → developing, else → needs support
 */
export const PERCENTILE_CUTOFFS = {
  legacy: { achieved: 50, developing: 25 },
  updated: { achieved: 40, developing: 20 },
} as const;

/**
 * Tasks that display only raw scores (no support level classification).
 * These tasks are in both `tasksToDisplayPercentCorrect`/`tasksToDisplayTotalCorrect`
 * AND `tasksToDisplayGradeEstimate` in the frontend.
 *
 * Special case: swr-es with scoringVersion >= 1 is excluded from percent-correct
 * display, so it gets support level classification instead.
 *
 * Ported from apps/dashboard/src/helpers/reports.js.
 */
export const RAW_SCORE_ONLY_TASKS = new Set(['phonics', 'roam-alpaca']);

/**
 * Per-task raw score thresholds by scoring version.
 * Returns { above, some } where:
 * - rawScore >= above → achievedSkill
 * - rawScore > some && rawScore < above → developingSkill
 * - rawScore <= some → needsExtraSupport
 *
 * Returns null if no thresholds exist for the task/version combination.
 *
 * Ported from apps/dashboard/src/helpers/reports.js `getRawScoreThreshold`.
 */
export function getRawScoreThreshold(taskSlug: string, scoringVersion: number | null): RawScoreThreshold | null {
  const version = scoringVersion ?? 0;

  switch (taskSlug) {
    case 'swr':
      return version >= 7 ? { above: 513, some: 413 } : { above: 550, some: 400 };
    case 'swr-es':
      return version >= 1 ? { above: 547, some: 447 } : null;
    case 'sre':
      return version >= 4 ? { above: 41, some: 23 } : { above: 70, some: 47 };
    case 'sre-es':
      return version >= 1 ? { above: 25, some: 12 } : null;
    case 'pa':
      return { above: 55, some: 45 };
    default:
      return null;
  }
}

/**
 * Score field name mappings for resolving score values from the `fdwRunScores` table.
 * Each task maps to the `name` column values used to store percentile and raw score.
 *
 * For grade-dependent field names (pa, sre legacy), both possible names are returned
 * so the caller can look up whichever is present in the run's scores.
 *
 * Ported from apps/dashboard/src/helpers/reports.js `SCORE_FIELD_MAPPINGS`.
 *
 * @param taskSlug - The task slug (e.g., 'swr', 'sre', 'pa')
 * @param gradeLevel - Numeric grade level (used for grade-dependent field resolution)
 * @returns Resolved field names, or empty arrays if the task is unknown
 */
export function resolveScoreFieldNames(taskSlug: string, gradeLevel: number | null): ScoreFieldResolution {
  switch (taskSlug) {
    case 'swr':
    case 'swr-es':
      return {
        percentileFieldNames: ['percentile', 'wjPercentile'],
        rawScoreFieldNames: ['roarScore'],
      };

    case 'sre':
      // Legacy SRE used different field names depending on grade
      if (gradeLevel !== null && gradeLevel < 6) {
        return {
          percentileFieldNames: ['percentile', 'tosrecPercentile'],
          rawScoreFieldNames: ['sreScore'],
        };
      }
      return {
        percentileFieldNames: ['percentile', 'sprPercentile'],
        rawScoreFieldNames: ['sreScore'],
      };

    case 'sre-es':
      return {
        percentileFieldNames: ['percentile'],
        rawScoreFieldNames: ['sreScore'],
      };

    case 'pa':
    case 'pa-es':
      // PA uses different field names for grade < 6 vs >= 6
      if (gradeLevel !== null && gradeLevel < 6) {
        return {
          percentileFieldNames: ['percentile'],
          rawScoreFieldNames: ['roarScore'],
        };
      }
      return {
        percentileFieldNames: ['sprPercentile'],
        rawScoreFieldNames: ['roarScore'],
      };

    case 'letter':
    case 'letter-es':
    case 'letter-en-ca':
      return {
        percentileFieldNames: ['totalPercentCorrect'],
        rawScoreFieldNames: ['totalCorrect'],
      };

    case 'phonics':
      return {
        percentileFieldNames: ['totalPercentCorrect'],
        rawScoreFieldNames: ['totalCorrect'],
      };

    default:
      return {
        percentileFieldNames: [],
        rawScoreFieldNames: [],
      };
  }
}
