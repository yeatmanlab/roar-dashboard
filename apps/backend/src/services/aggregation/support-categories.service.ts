import { StatusCodes } from 'http-status-codes';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { logger } from '../../logger';
import { ApiError } from '../../errors/api-error';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { AdministrationRepository } from '../../repositories/administration.repository';
import { AdministrationTaskVariantRepository } from '../../repositories/administration-task-variant.repository';
import { getSupportLevel, parseScoreValue } from '../scoring/scoring.service';
import { CoreDbClient } from '../../db/clients';
import type * as CoreDbSchema from '../../db/schema/core';
import { fdwRuns } from '../../db/schema/assessment-fdw/runs';
import { fdwRunScores } from '../../db/schema/assessment-fdw/run-scores';
import { runDemographics } from '../../db/schema/core/run-demographics';
import { userClasses } from '../../db/schema/core/user-classes';
import { classes } from '../../db/schema/core/classes';
import { orgs } from '../../db/schema/core/orgs';

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
 * Aggregates support category counts and distributions across schools and grades
 * for multiple assessment tasks within a district administration.
 *
 * @param params - Input parameters with assignmentId and districtId
 * @param dependencies - Injected dependencies (optional, uses defaults)
 * @returns Aggregated support categories by task
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

  // Verify administration exists
  const administration = await administrationRepository.getById({ id: assignmentId });
  if (!administration) {
    throw new ApiError(ApiErrorMessage.NOT_FOUND, {
      statusCode: StatusCodes.NOT_FOUND,
      code: ApiErrorCode.RESOURCE_NOT_FOUND,
      context: { assignmentId, districtId },
    });
  }

  // Get scored tasks for this administration
  const adminTaskVarRepo = new AdministrationTaskVariantRepository(coreDb);
  const taskMap = await adminTaskVarRepo.getByAdministrationIds([assignmentId]);
  const taskVariants = taskMap.get(assignmentId) ?? [];

  const scoredTasks = taskVariants.filter((tv) =>
    SCORED_TASK_IDS.includes(tv.taskId as (typeof SCORED_TASK_IDS)[number]),
  );

  if (scoredTasks.length === 0) {
    logger.info({ assignmentId, districtId }, 'No scored tasks found for administration');
    return null;
  }

  // Map task variant ID → task slug for lookup later
  const taskSlugByVariantId = new Map(scoredTasks.map((t) => [t.variantId, t.taskId]));
  const variantIds = scoredTasks.map((t) => t.variantId);

  // Fetch all best runs for these task variants
  const runs = await coreDb
    .select({
      id: fdwRuns.id,
      userId: fdwRuns.userId,
      taskVariantId: fdwRuns.taskVariantId,
      administrationId: fdwRuns.administrationId,
    })
    .from(fdwRuns)
    .where(
      and(
        eq(fdwRuns.administrationId, assignmentId),
        inArray(fdwRuns.taskVariantId, variantIds),
        eq(fdwRuns.useForReporting, true),
        isNull(fdwRuns.deletedAt),
      ),
    );

  if (runs.length === 0) {
    logger.info({ assignmentId, districtId }, 'No best runs found for scored tasks');
    return null;
  }

  // Fetch demographics (grade) for all runs
  const runIds = runs.map((r) => r.id);
  const demographicsMap = new Map(
    (
      await coreDb
        .select({ runId: runDemographics.runId, grade: runDemographics.grade })
        .from(runDemographics)
        .where(inArray(runDemographics.runId, runIds))
    ).map((d) => [d.runId, d.grade]),
  );

  // Fetch scores for all runs (computed type contains percentile, raw type is raw score)
  const scoresData = await coreDb
    .select({
      runId: fdwRunScores.runId,
      type: fdwRunScores.type,
      name: fdwRunScores.name,
      value: fdwRunScores.value,
    })
    .from(fdwRunScores)
    .where(inArray(fdwRunScores.runId, runIds));

  const scoresByRunId = new Map<
    string,
    { percentile: number | null; rawScore: number | null; scoringVersion: number | null }
  >();

  for (const score of scoresData) {
    if (!scoresByRunId.has(score.runId)) {
      scoresByRunId.set(score.runId, { percentile: null, rawScore: null, scoringVersion: null });
    }
    const runScores = scoresByRunId.get(score.runId)!;

    // Extract score value - some may be angle-bracket strings
    const parsedValue = parseScoreValue(score.value);

    // Percentile is stored with type='computed' and name='percentile'
    if ((score.type as string) === 'computed' && score.name === 'percentile') {
      runScores.percentile = parsedValue;
      // Raw score is stored with type='raw' and name='rawScore'
    } else if ((score.type as string) === 'raw' && score.name === 'rawScore') {
      runScores.rawScore = parsedValue;
    }
  }

  // Fetch user school enrollments
  const userIds = runs.map((r) => r.userId);
  const userSchoolsData = await coreDb
    .select({
      userId: userClasses.userId,
      schoolId: classes.schoolId,
      schoolName: orgs.name,
    })
    .from(userClasses)
    .innerJoin(classes, eq(userClasses.classId, classes.id))
    .innerJoin(orgs, eq(classes.schoolId, orgs.id))
    .where(inArray(userClasses.userId, userIds));

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
    const scores = scoresByRunId.get(run.id) || { percentile: null, rawScore: null, scoringVersion: null };

    return {
      runId: run.id,
      userId: run.userId,
      taskId: run.taskVariantId,
      taskSlug,
      grade,
      schoolIds: schools.map((s) => s.id),
      percentile: scores.percentile,
      rawScore: scores.rawScore,
      scoringVersion: scores.scoringVersion,
    };
  });

  // Initialize aggregation structure
  const aggregated: AggregatedSupportCategories = {};
  for (const task of scoredTasks) {
    aggregated[task.taskId] = {
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
    const taskCounts = aggregated[enrichedRun.taskSlug];
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

    // Aggregate score ranges
    if (enrichedRun.percentile !== null) {
      const percentileRange = getPercentileRange(enrichedRun.percentile);
      aggregateToScoreRange(
        taskCounts.percentile,
        percentileRange,
        (schoolId) => schoolNameMap.get(schoolId) || schoolId,
        enrichedRun.schoolIds,
        gradeKey,
      );
    }

    if (enrichedRun.rawScore !== null) {
      const rawRange = getRawScoreRange(enrichedRun.taskSlug, enrichedRun.rawScore);
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
      administrationId: assignmentId,
      districtId,
      runCount: enrichedRuns.length,
      taskCount: scoredTasks.length,
    },
    `Aggregated support categories for ${enrichedRuns.length} runs across ${scoredTasks.length} tasks`,
  );

  return aggregated;
}

function getPercentileRange(percentile: number): string {
  if (percentile < 0) return '0-10';
  const bucket = Math.floor(percentile / 10) * 10;
  if (bucket >= 100) return '90-100';
  return `${bucket}-${bucket + 10}`;
}

function getRawScoreRange(taskSlug: string, rawScore: number): string | null {
  const ranges: Record<string, number[]> = {
    swr: [400, 450, 500, 550, 600, 650, 700],
    pa: [40, 45, 50, 55, 60, 65, 70],
    sre: [20, 25, 30, 35, 40, 45, 50],
    cva: [0, 20, 40, 60, 80, 100],
  };

  const taskRanges = ranges[taskSlug];
  if (!taskRanges) return null;

  for (let i = 0; i < taskRanges.length - 1; i++) {
    const lower = taskRanges[i]!;
    const upper = taskRanges[i + 1]!;
    if (rawScore >= lower && rawScore < upper) {
      return `${lower}-${upper}`;
    }
  }

  if (rawScore >= taskRanges[taskRanges.length - 1]!) {
    return `${taskRanges[taskRanges.length - 1]}-${taskRanges[taskRanges.length - 1]! + 50}`;
  }

  return null;
}

function aggregateToScoreRange(
  rangeMap: Record<string, SchoolGradeCounts>,
  rangeKey: string,
  getSchoolName: (id: string) => string,
  schoolIds: string[],
  gradeKey: string,
): void {
  if (!rangeMap[rangeKey]) {
    rangeMap[rangeKey] = { schools: {}, grades: {}, total: 0 };
  }

  const rangeCounts = rangeMap[rangeKey]!;
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
