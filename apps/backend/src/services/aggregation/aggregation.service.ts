import { StatusCodes } from 'http-status-codes';
import { logger } from '../../logger';
import { ApiError } from '../../errors/api-error';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { AdministrationRepository } from '../../repositories/administration.repository';
import { AdministrationTaskVariantRepository } from '../../repositories/administration-task-variant.repository';
import { AggregationRepository } from '../../repositories/aggregation.repository';
import { TaskVariantParameterRepository } from '../../repositories/task-variant-parameter.repository';
import {
  extractScoringVersions,
  getScoreRange,
  getSupportLevel,
  parseScoreValue,
  resolveNumericScore,
  resolveScoreFieldNames,
} from '../scoring';
import { SCORE_NAME } from '../../constants/run-scores';
import { getGradeAsNumber } from '../../utils/get-grade-as-number.util';
import { SWR_TASK_IDS } from '@roar-platform/assessment-schema/roar-swr';
import { SRE_TASK_IDS } from '@roar-platform/assessment-schema/roar-sre';
import { PA_TASK_ID } from '@roar-platform/assessment-schema/roar-pa';
import { MORPHOLOGY_TASK_ID, CVA_TASK_ID } from '@roar-platform/assessment-schema/roar-multichoice';
import { LEVANTE_NORMED_TASK_IDS } from '@roar-platform/assessment-schema/roar-levante-tasks';

const SCORED_TASK_IDS = [
  SWR_TASK_IDS.EN,
  SWR_TASK_IDS.ES,
  SRE_TASK_IDS.EN,
  SRE_TASK_IDS.ES,
  PA_TASK_ID,
  CVA_TASK_ID,
  MORPHOLOGY_TASK_ID,
  LEVANTE_NORMED_TASK_IDS.TROG,
  LEVANTE_NORMED_TASK_IDS.ROAR_INFERENCE,
] as const;

export type SupportLevel = 'achievedSkill' | 'developingSkill' | 'needsExtraSupport';

export interface SchoolGradeCounts {
  schools: Record<string, { name: string; count: number }>;
  grades: Record<string, number>;
  total: number;
}

export interface TaskCounts {
  achievedSkill: SchoolGradeCounts;
  developingSkill: SchoolGradeCounts;
  needsExtraSupport: SchoolGradeCounts;
  raw: Record<string, SchoolGradeCounts>;
  percentile: Record<string, SchoolGradeCounts>;
}

export type AggregatedSupportCategories = Record<string, TaskCounts>;

interface RunWithDemographics {
  runId: string;
  userId: string;
  taskId: string;
  taskSlug: string;
  grade: string | null;
  schoolIds: string[];
  percentile: number | null;
  rawScore: number | null;
  scoringVersion: number | null;
}

/**
 * AggregationService
 *
 * Provides business logic for aggregation operations related to reporting.
 * Follows the factory pattern with dependency injection.
 *
 * @param params - Configuration object containing repository instances (optional)
 * @returns AggregationService - An object with aggregation service methods.
 */
export function AggregationService({
  administrationRepository = new AdministrationRepository(),
  administrationTaskVariantRepository = new AdministrationTaskVariantRepository(),
  aggregationRepository = new AggregationRepository(),
  taskVariantParameterRepository = new TaskVariantParameterRepository(),
}: {
  administrationRepository?: AdministrationRepository;
  administrationTaskVariantRepository?: AdministrationTaskVariantRepository;
  aggregationRepository?: AggregationRepository;
  taskVariantParameterRepository?: TaskVariantParameterRepository;
} = {}) {
  async function aggregateSupportCategories(params: {
    administrationId: string;
    districtId: string;
  }): Promise<AggregatedSupportCategories | null> {
    const { administrationId, districtId } = params;

    // Verify administration exists
    const administration = await administrationRepository.getById({ id: administrationId });
    if (!administration) {
      throw new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { administrationId, districtId },
      });
    }

    // Get scored tasks for this administration
    const taskMap = await administrationTaskVariantRepository.getByAdministrationIds([administrationId]);
    const taskVariants = taskMap.get(administrationId) ?? [];

    const scoredTasks = taskVariants.filter((tv) =>
      SCORED_TASK_IDS.includes(tv.taskSlug as (typeof SCORED_TASK_IDS)[number]),
    );

    if (scoredTasks.length === 0) {
      logger.info({ administrationId, districtId }, 'No scored tasks found for administration');
      return null;
    }

    // Map task variant ID → task slug for lookup later
    const taskSlugByVariantId = new Map(scoredTasks.map((t) => [t.variantId, t.taskSlug]));
    const variantIds = scoredTasks.map((t) => t.variantId);

    // Buckets use the variant's version so the distribution is one scale; runs are
    // classified against their own version below.
    const variantParams = await taskVariantParameterRepository.getByTaskVariantIds(variantIds);
    const scoringVersionByVariant = extractScoringVersions(variantParams);
    const rawBucketMaps = buildRawBucketMaps(scoredTasks, scoringVersionByVariant);

    // Fetch all best runs for these task variants
    const runs = await aggregationRepository.getBestRunsForVariants(administrationId, variantIds);

    if (runs.length === 0) {
      logger.info({ administrationId, districtId }, 'No best runs found for scored tasks');
      return null;
    }

    // Fetch demographics (grade) for all runs
    const runIds = runs.map((r) => r.id);
    const demographicsMap = await aggregationRepository.getDemographicsByRunIds(runIds);

    // Fetch scores for all runs
    const scoresByRunId = await aggregationRepository.getScoresByRunIds(runIds);

    // Fetch user school enrollments
    const userIds = runs.map((r) => r.userId);
    const userSchoolsData = await aggregationRepository.getUserSchoolsByUserIds(userIds);

    const userSchoolsMap = new Map<string, Array<{ id: string; name: string }>>();
    for (const row of userSchoolsData) {
      if (!userSchoolsMap.has(row.userId)) {
        userSchoolsMap.set(row.userId, []);
      }
      const schools = userSchoolsMap.get(row.userId)!;
      if (!schools.some((s) => s.id === row.schoolId)) {
        schools.push({ id: row.schoolId, name: row.schoolName });
      }
    }

    // Enrich runs with demographics and scores
    const enrichedRuns: RunWithDemographics[] = runs.map((run) => {
      const taskSlug = taskSlugByVariantId.get(run.taskVariantId) || '';
      const grade = demographicsMap.get(run.id) || null;
      const schools = userSchoolsMap.get(run.userId) || [];
      const scoreMap = scoresByRunId.get(run.id) ?? new Map<string, string>();

      // Which name holds the percentile or raw score varies by task, grade, and
      // scoring version — resolve against the scoring config rather than assuming.
      // The run's own version, not the variant's: it reflects how this run was scored.
      const scoringVersion = parseScoreValue(scoreMap.get(SCORE_NAME.SCORING_VERSION));
      const gradeLevel = getGradeAsNumber(grade);
      const fieldNames = resolveScoreFieldNames(taskSlug, gradeLevel, scoringVersion);

      return {
        runId: run.id,
        userId: run.userId,
        taskId: run.taskVariantId,
        taskSlug,
        grade,
        schoolIds: schools.map((s) => s.id),
        percentile: resolveNumericScore(scoreMap, fieldNames.percentileFieldNames),
        rawScore: resolveNumericScore(scoreMap, fieldNames.rawScoreFieldNames),
        scoringVersion,
      };
    });

    // Initialize aggregation structure by taskSlug
    const aggregatedBySlug: Record<string, TaskCounts> = {};
    for (const task of scoredTasks) {
      aggregatedBySlug[task.taskSlug] = {
        achievedSkill: { schools: {}, grades: {}, total: 0 },
        developingSkill: { schools: {}, grades: {}, total: 0 },
        needsExtraSupport: { schools: {}, grades: {}, total: 0 },
        raw: {},
        percentile: {},
      };
    }

    // Create school ID → name map for quick lookups
    const schoolNameMap = new Map<string, string>();
    for (const row of userSchoolsData) {
      schoolNameMap.set(row.schoolId, row.schoolName);
    }

    // Process each run and aggregate
    for (const enrichedRun of enrichedRuns) {
      const taskCounts = aggregatedBySlug[enrichedRun.taskSlug];
      if (!taskCounts) continue;

      // Classify run by support level
      const supportLevel = getSupportLevel({
        grade: enrichedRun.grade,
        percentile: enrichedRun.percentile,
        rawScore: enrichedRun.rawScore,
        taskSlug: enrichedRun.taskSlug,
        scoringVersion: enrichedRun.scoringVersion,
      });

      if (!supportLevel) continue;

      // Aggregate by support level
      const levelCounts = taskCounts[supportLevel];
      levelCounts.total++;

      // Aggregate by grade
      const gradeKey = enrichedRun.grade ?? 'NONE';
      if (!levelCounts.grades[gradeKey]) {
        levelCounts.grades[gradeKey] = 0;
      }
      levelCounts.grades[gradeKey]!++;

      // Aggregate by school
      for (const schoolId of enrichedRun.schoolIds) {
        const schoolName = schoolNameMap.get(schoolId) || schoolId;
        if (!levelCounts.schools[schoolId]) {
          levelCounts.schools[schoolId] = { name: schoolName, count: 0 };
        }
        levelCounts.schools[schoolId]!.count++;
      }

      // Histogram totals can potentially deviate if admin has runs with different scoring versions
      if (enrichedRun.percentile !== null) {
        const percentileRange = getPercentileRange(enrichedRun.taskSlug, enrichedRun.percentile);
        if (percentileRange) {
          aggregateToScoreRange(
            taskCounts.percentile,
            percentileRange,
            (schoolId) => schoolNameMap.get(schoolId) || schoolId,
            enrichedRun.schoolIds,
            gradeKey,
          );
        }
      }

      if (enrichedRun.rawScore !== null) {
        const bucketMap = rawBucketMaps.get(enrichedRun.taskSlug);
        const rawRange = bucketMap ? findRangeInMap(bucketMap, enrichedRun.rawScore) : null;
        if (rawRange) {
          aggregateToScoreRange(
            taskCounts.raw,
            rawRange,
            (schoolId) => schoolNameMap.get(schoolId) || schoolId,
            enrichedRun.schoolIds,
            gradeKey,
          );
        }
      }
    }

    logger.info(
      {
        administrationId,
        districtId,
        runCount: enrichedRuns.length,
        taskCount: scoredTasks.length,
      },
      'Successfully aggregated support categories',
    );

    // Remap aggregation keys from taskSlug to taskId (UUID)
    const aggregatedByTaskId: AggregatedSupportCategories = {};
    for (const task of scoredTasks) {
      aggregatedByTaskId[task.taskId] = aggregatedBySlug[task.taskSlug]!;
    }

    return aggregatedByTaskId;
  }

  return { aggregateSupportCategories };
}

/**
 * Generates a map of score ranges as human-readable strings.
 *
 * Creates ranges by stepping from min to max with the given divisor as the step size.
 * Each range is represented as "start-end" (e.g., "10-20") or as a single value (e.g., "30")
 * if the start and end are the same. Ensures the final range includes max.
 *
 * @param min - The minimum value of the range
 * @param max - The maximum value of the range (exclusive in loop, but included in final range)
 * @param divisor - The step size between range starts
 * @returns A map with numeric indices as keys and range strings as values (e.g., { 0: "0-10", 1: "10-20", 2: "20" })
 */
function generateScoreRangeMap(min: number, max: number, divisor: number): Record<number, string> {
  const rangeMap: Record<number, string> = {};
  let index = 0;

  for (let start = min; start < max; start += divisor) {
    const end = Math.min(start + divisor, max);
    rangeMap[index] = start === end ? `${start}` : `${start}-${end}`;
    index++;
  }

  if (index > 0) {
    const lastRangeStr = rangeMap[index - 1];
    if (lastRangeStr !== undefined) {
      const lastEnd = parseInt(lastRangeStr.split('-').pop() || lastRangeStr);
      if (lastEnd < max) {
        rangeMap[index] = `${max}`;
      }
    }
  }

  return rangeMap;
}

/** Bucket width per task. Bounds come from the scoring config; only the width lives here. */
const RAW_BUCKET_WIDTH: Record<string, number> = {
  swr: 50,
  'swr-es': 50,
  pa: 50,
  letter: 10,
  sre: 50,
  'sre-es': 10,
  cva: 50,
  trog: 50,
  'roar-inference': 50,
  morphology: 50,
};

// Percentile ranges (0-99 for most normed tasks)
const PERCENTILE_RANGE_MAP = generateScoreRangeMap(0, 99, 10);

function findRangeInMap(rangeMap: Record<number, string>, score: number): string | null {
  return (
    Object.values(rangeMap).find((rangeStr) => {
      const parts = rangeStr.split('-').map(Number);
      const min = parts[0];
      const max = parts[1];
      if (min === undefined) return false;
      const upper = max !== undefined && !isNaN(max) ? max : min;
      return score >= min && score <= upper;
    }) ?? null
  );
}

/**
 * Build each task's raw score buckets from its configured range for the variant's
 * scoring version.
 *
 * @param scoredTasks - The administration's scored task variants
 * @param scoringVersionByVariant - Scoring version per task variant ID
 * @returns Map of task slug to its bucket map; tasks without bounds or a width are omitted
 */
function buildRawBucketMaps(
  scoredTasks: Array<{ variantId: string; taskSlug: string }>,
  scoringVersionByVariant: Map<string, number>,
): Map<string, Record<number, string>> {
  const bucketMaps = new Map<string, Record<number, string>>();

  for (const task of scoredTasks) {
    const width = RAW_BUCKET_WIDTH[task.taskSlug];
    const scoringVersion = scoringVersionByVariant.get(task.variantId) ?? 0;
    const bounds = getScoreRange(task.taskSlug, 'rawScore', scoringVersion);
    if (!width || !bounds) continue;

    // Assumes one scoring version per task per administration.
    if (bucketMaps.has(task.taskSlug)) {
      logger.warn(
        { taskSlug: task.taskSlug, variantId: task.variantId, scoringVersion },
        'Multiple variants for one task slug; raw score buckets use the first resolved version',
      );
      continue;
    }

    bucketMaps.set(task.taskSlug, generateScoreRangeMap(bounds.min, bounds.max, width));
  }

  return bucketMaps;
}

function getPercentileRange(taskSlug: string, percentile: number): string | null {
  // Task-specific percentile range maps for normed tasks
  const percentileRangeMaps: Record<string, Record<number, string>> = {
    swr: PERCENTILE_RANGE_MAP,
    'swr-es': PERCENTILE_RANGE_MAP,
    pa: PERCENTILE_RANGE_MAP,
    letter: PERCENTILE_RANGE_MAP,
    sre: PERCENTILE_RANGE_MAP,
    'sre-es': PERCENTILE_RANGE_MAP,
    cva: PERCENTILE_RANGE_MAP,
    trog: PERCENTILE_RANGE_MAP,
    'roar-inference': PERCENTILE_RANGE_MAP,
    morphology: PERCENTILE_RANGE_MAP,
  };

  const rangeMap = percentileRangeMaps[taskSlug];
  if (!rangeMap) return null;
  return findRangeInMap(rangeMap, percentile);
}

function aggregateToScoreRange(
  scoreRangeAggregate: Record<string, SchoolGradeCounts>,
  rangeKey: string,
  getSchoolName: (schoolId: string) => string,
  schoolIds: string[],
  gradeKey: string,
) {
  if (!scoreRangeAggregate[rangeKey]) {
    scoreRangeAggregate[rangeKey] = { schools: {}, grades: {}, total: 0 };
  }

  const rangeCounts = scoreRangeAggregate[rangeKey];
  rangeCounts.total++;

  if (!rangeCounts.grades[gradeKey]) {
    rangeCounts.grades[gradeKey] = 0;
  }
  rangeCounts.grades[gradeKey]!++;

  for (const schoolId of schoolIds) {
    const schoolName = getSchoolName(schoolId);
    if (!rangeCounts.schools[schoolId]) {
      rangeCounts.schools[schoolId] = { name: schoolName, count: 0 };
    }
    rangeCounts.schools[schoolId]!.count++;
  }
}
