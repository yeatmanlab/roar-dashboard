import { StatusCodes } from 'http-status-codes';
import { inArray, eq, and, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { logger } from '../../logger';
import { ApiError } from '../../errors/api-error';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { AdministrationRepository } from '../../repositories/administration.repository';
import { getSupportLevel } from '../scoring/scoring.service';
import { CoreDbClient } from '../../db/clients';
import type * as CoreDbSchema from '../../db/schema/core';
import { fdwRuns } from '../../db/schema/assessment-fdw/runs';

/**
 * Scored tasks that support support level aggregation.
 * Must be kept in sync with the ticket specifications.
 */
const SCORED_TASK_IDS = [
  'swr',
  'pa',
  'sre',
  'cva',
  'morphology',
  'trog',
  'roar-inference',
  'swr-es',
  'sre-es',
] as const;

/**
 * Batch size thresholds for processing large datasets.
 */
const BATCH_SIZE_LARGE_DATASET = 2000;
const BATCH_SIZE_NORMAL = 1000;
const YIELD_FREQUENCY = 5; // Yield control every 5 batches for large datasets
const LARGE_DATASET_THRESHOLD = 50000;

/**
 * Score range definitions for standard score ranges.
 * These are task-specific and should match the dashboard's display ranges.
 */
const SCORE_RANGES = {
  swr: { raw: [400, 450, 500, 550, 600, 650, 700] as const },
  pa: { raw: [40, 45, 50, 55, 60, 65, 70] as const },
  sre: { raw: [20, 25, 30, 35, 40, 45, 50] as const },
  cva: { raw: [0, 20, 40, 60, 80, 100] as const },
  percentile: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const,
};

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

/**
 * Raw run data needed for aggregation, fetched with minimal columns for efficiency.
 */
interface AggregationRun {
  id: string;
  userId: string;
  taskId: string;
  administrationId: string;
  grade?: string | null;
  schools?: string[];
  scores?: {
    percentile?: number | null;
    rawScore?: number | null;
    scoringVersion?: number | null;
  };
}

/**
 * Aggregates support category counts and distributions across schools and grades
 * for multiple assessment tasks within a district administration.
 *
 * Processes datasets efficiently with batching and yield control to prevent timeouts.
 *
 * @param params - Input parameters with assignmentId and districtId
 * @param dependencies - Injected dependencies (optional, uses defaults)
 * @returns Aggregated support categories by task, or null if no best runs found
 * @throws {ApiError} NOT_FOUND if administration doesn't exist
 */
export async function aggregateSupportCategories(
  params: {
    assignmentId: string;
    districtId: string;
  },
  dependencies?: {
    administrationRepository?: AdministrationRepository;
    coreDb?: NodePgDatabase<typeof CoreDbSchema>;
  },
): Promise<AggregatedSupportCategories | null> {
  const { assignmentId, districtId } = params;
  const administrationRepository = dependencies?.administrationRepository ?? new AdministrationRepository();
  const coreDb = dependencies?.coreDb ?? CoreDbClient;

  const startTime = Date.now();

  // Phase 1: Fetch administration and filter to scored tasks
  const administration = await administrationRepository.getById({ id: assignmentId });
  if (!administration) {
    throw new ApiError(ApiErrorMessage.NOT_FOUND, {
      statusCode: StatusCodes.NOT_FOUND,
      code: ApiErrorCode.RESOURCE_NOT_FOUND,
      context: { assignmentId, districtId },
    });
  }

  const scoredTasks = (administration.assessments ?? []).filter((assessment) =>
    SCORED_TASK_IDS.includes(assessment.taskId as (typeof SCORED_TASK_IDS)[number]),
  );

  if (scoredTasks.length === 0) {
    logger.info({ assignmentId, districtId }, 'No scored tasks found for administration');
    return null;
  }

  const taskIds = scoredTasks.map((t) => t.taskId);

  // Phase 2: Query best runs (useForReporting = true, not deleted) via FDW
  let allRuns: AggregationRun[] = [];
  try {
    // Query FDW runs (available via CoreDbClient) for all scored tasks in this administration
    // useForReporting = true marks the best run for each (user, task, administration) tuple
    const runs = await coreDb
      .select({
        id: fdwRuns.id,
        userId: fdwRuns.userId,
        taskId: fdwRuns.taskId,
        administrationId: fdwRuns.administrationId,
      })
      .from(fdwRuns)
      .where(
        and(
          eq(fdwRuns.administrationId, assignmentId),
          inArray(fdwRuns.taskId, taskIds),
          eq(fdwRuns.useForReporting, true),
          isNull(fdwRuns.deletedAt),
        ),
      );

    allRuns = runs.map((r) => ({
      id: r.id,
      userId: r.userId,
      taskId: r.taskId,
      administrationId: r.administrationId,
      grade: undefined,
      schools: [],
      scores: {},
    }));
  } catch (error) {
    logger.error({ err: error, context: { assignmentId, districtId } }, 'Failed to fetch best runs');
    return null;
  }

  if (allRuns.length === 0) {
    logger.error({ assignmentId, districtId, taskIds }, `No best runs found for taskIds: ${taskIds.join(', ')}`);
    return null;
  }

  // Phase 3: Fetch school information and build lookup map
  // This would need to be integrated with the actual user/enrollment data structure
  const schoolIdToNameMap = new Map<string, string>();
  // Placeholder for school name fetching logic

  // Phase 4: Initialize aggregation structure
  const aggregated: AggregatedSupportCategories = {};
  for (const taskId of taskIds) {
    aggregated[taskId] = {
      achievedSkill: { schools: {}, grades: {}, total: 0 },
      developingSkill: { schools: {}, grades: {}, total: 0 },
      needsExtraSupport: { schools: {}, grades: {}, total: 0 },
      raw: {},
      percentile: {},
    };
  }

  // Phase 5: Process runs in batches
  const batchSize = allRuns.length > LARGE_DATASET_THRESHOLD ? BATCH_SIZE_LARGE_DATASET : BATCH_SIZE_NORMAL;
  const numBatches = Math.ceil(allRuns.length / batchSize);

  for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
    const start = batchIndex * batchSize;
    const end = Math.min(start + batchSize, allRuns.length);
    const batch = allRuns.slice(start, end);

    // Process each run in the batch
    for (const run of batch) {
      try {
        const taskId = run.taskId;
        if (!aggregated[taskId]) continue;

        const taskCounts = aggregated[taskId]!;

        // Extract grade and scores (placeholders - actual implementation would fetch from user data)
        const grade = run.grade ?? 'NONE';
        const percentile = run.scores?.percentile ?? null;
        const rawScore = run.scores?.rawScore ?? null;
        const scoringVersion = run.scores?.scoringVersion ?? null;

        // Classify score into support level
        const supportLevel = getSupportLevel({
          grade,
          percentile,
          rawScore,
          taskSlug: taskId,
          scoringVersion,
          assessmentSupportLevel: undefined,
        });

        if (!supportLevel) {
          logger.debug({ runId: run.id, taskId, grade }, 'Invalid support category for run');
          continue;
        }

        // Update support level aggregations
        const levelCounts = taskCounts[supportLevel];
        levelCounts.total++;

        // Update school counts
        const schools = run.schools ?? [];
        for (const schoolId of schools) {
          const schoolName = schoolIdToNameMap.get(schoolId) || schoolId;
          if (!levelCounts.schools[schoolId]) {
            levelCounts.schools[schoolId] = { name: schoolName, count: 0 };
          }
          levelCounts.schools[schoolId]!.count++;
        }

        // Update grade counts
        if (!levelCounts.grades[grade]) {
          levelCounts.grades[grade] = 0;
        }
        levelCounts.grades[grade]!++;

        // Aggregate score ranges if scores are available
        if (rawScore !== null || percentile !== null) {
          aggregateScoreRanges(taskCounts, taskId, rawScore, percentile, schoolIdToNameMap, schools, grade);
        }
      } catch (error) {
        logger.error({ err: error, context: { runId: run.id } }, 'Error processing run in aggregation');
        continue;
      }
    }

    // Yield control for large datasets
    if (allRuns.length > LARGE_DATASET_THRESHOLD && (batchIndex + 1) % YIELD_FREQUENCY === 0) {
      const percentage = Math.round(((batchIndex + 1) / numBatches) * 100);
      logger.info(
        {
          batch: batchIndex + 1,
          totalBatches: numBatches,
          percentage,
          processed: Math.min((batchIndex + 1) * batchSize, allRuns.length),
          total: allRuns.length,
          assignmentId,
          districtId,
        },
        `Processing batch ${batchIndex + 1}/${numBatches} (${percentage}% - ${Math.min((batchIndex + 1) * batchSize, allRuns.length)}/${allRuns.length})`,
      );

      // Yield to event loop
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  const elapsed = Date.now() - startTime;
  logger.info(
    {
      runCount: allRuns.length,
      taskCount: taskIds.length,
      batchSize,
      numBatches,
      elapsedMs: elapsed,
      assignmentId,
      districtId,
    },
    `Processed ${allRuns.length} runs in ${numBatches} batches in ${elapsed}ms`,
  );

  return aggregated;
}

/**
 * Aggregates raw and percentile score ranges for a run.
 * Updates the taskCounts with score range bucketing.
 */
function aggregateScoreRanges(
  taskCounts: TaskCounts,
  taskId: string,
  rawScore: number | null,
  percentile: number | null,
  schoolIdToNameMap: Map<string, string>,
  schools: string[],
  grade: string,
): void {
  // Determine percentile range
  if (percentile !== null) {
    const percentileRange = getPercentileRange(percentile);
    if (!taskCounts.percentile[percentileRange]) {
      taskCounts.percentile[percentileRange] = { schools: {}, grades: {}, total: 0 };
    }

    const rangeCount = taskCounts.percentile[percentileRange]!;
    rangeCount.total++;

    for (const schoolId of schools) {
      const schoolName = schoolIdToNameMap.get(schoolId) || schoolId;
      if (!rangeCount.schools[schoolId]) {
        rangeCount.schools[schoolId] = { name: schoolName, count: 0 };
      }
      rangeCount.schools[schoolId]!.count++;
    }

    if (!rangeCount.grades[grade]) {
      rangeCount.grades[grade] = 0;
    }
    rangeCount.grades[grade]!++;
  }

  // Determine raw score range
  if (rawScore !== null) {
    const rawRange = getRawScoreRange(taskId, rawScore);
    if (rawRange && !taskCounts.raw[rawRange]) {
      taskCounts.raw[rawRange] = { schools: {}, grades: {}, total: 0 };
    }

    if (rawRange) {
      const rangeCount = taskCounts.raw[rawRange]!;
      rangeCount.total++;

      for (const schoolId of schools) {
        const schoolName = schoolIdToNameMap.get(schoolId) || schoolId;
        if (!rangeCount.schools[schoolId]) {
          rangeCount.schools[schoolId] = { name: schoolName, count: 0 };
        }
        rangeCount.schools[schoolId]!.count++;
      }

      if (!rangeCount.grades[grade]) {
        rangeCount.grades[grade] = 0;
      }
      rangeCount.grades[grade]!++;
    }
  }
}

/**
 * Determine the percentile range bucket for a given percentile value.
 * Ranges: 0-10, 10-20, ..., 90-100
 */
function getPercentileRange(percentile: number): string {
  if (percentile < 0) return '0-10';
  const bucket = Math.floor(percentile / 10) * 10;
  if (bucket >= 100) return '90-100';
  return `${bucket}-${bucket + 10}`;
}

/**
 * Determine the raw score range bucket for a given raw score.
 * Task-specific bucketing logic.
 */
function getRawScoreRange(taskId: string, rawScore: number): string | null {
  const ranges = SCORE_RANGES[taskId as keyof typeof SCORE_RANGES]?.raw;
  if (!ranges) return null;

  for (let i = 0; i < ranges.length - 1; i++) {
    const lower = ranges[i]!;
    const upper = ranges[i + 1]!;
    if (rawScore >= lower && rawScore < upper) {
      return `${lower}-${upper}`;
    }
  }

  // Handle edge case: score >= highest range
  if (rawScore >= ranges[ranges.length - 1]!) {
    return `${ranges[ranges.length - 1]}-${ranges[ranges.length - 1]! + 50}`;
  }

  return null;
}
