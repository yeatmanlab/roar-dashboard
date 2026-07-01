import { StatusCodes } from 'http-status-codes';
import { logger } from '../../logger';
import { ApiError } from '../../errors/api-error';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { AdministrationRepository } from '../../repositories/administration.repository';
import { AdministrationTaskVariantRepository } from '../../repositories/administration-task-variant.repository';
import { AggregationRepository } from '../../repositories/aggregation.repository';
import { getSupportLevel } from '../scoring/scoring.service';
import { SWR_TASK_IDS } from '@roar-platform/assessment-schema/roar-swr';
import { SRE_TASK_IDS } from '@roar-platform/assessment-schema/roar-sre';
import { PA_TASK_ID } from '@roar-platform/assessment-schema/roar-pa';
import { MORPHOLOGY_TASK_ID, CVA_TASK_ID } from '@roar-platform/assessment-schema/roar-multichoice';

export const ScoreType = {
  COMPUTED: 'computed',
  RAW: 'raw',
} as const;
export type ScoreType = (typeof ScoreType)[keyof typeof ScoreType];

const SCORED_TASK_IDS = [
  SWR_TASK_IDS.EN,
  SWR_TASK_IDS.ES,
  SRE_TASK_IDS.EN,
  SRE_TASK_IDS.ES,
  PA_TASK_ID,
  CVA_TASK_ID,
  MORPHOLOGY_TASK_ID,
  'trog',
  'roar-inference',
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

export function AggregationService({
  administrationRepository = new AdministrationRepository(),
  administrationTaskVariantRepository = new AdministrationTaskVariantRepository(),
  aggregationRepository = new AggregationRepository(),
}: {
  administrationRepository?: AdministrationRepository;
  administrationTaskVariantRepository?: AdministrationTaskVariantRepository;
  aggregationRepository?: AggregationRepository;
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

function getPercentileRange(percentile: number): string {
  if (percentile >= 80) return '80-100';
  if (percentile >= 70) return '70-80';
  if (percentile >= 60) return '60-70';
  if (percentile >= 50) return '50-60';
  if (percentile >= 40) return '40-50';
  if (percentile >= 30) return '30-40';
  if (percentile >= 20) return '20-30';
  if (percentile >= 10) return '10-20';
  return '0-10';
}

function getRawScoreRange(taskSlug: string, rawScore: number): string | null {
  const ranges: Record<string, Array<[number, number]>> = {
    swr: [
      [0, 50],
      [50, 100],
      [100, 150],
      [150, 200],
      [200, 250],
      [250, 300],
      [300, 350],
      [350, 400],
      [400, 450],
      [450, 500],
      [500, 550],
      [550, 600],
      [600, 650],
      [650, 700],
    ],
    pa: [
      [0, 10],
      [10, 20],
      [20, 30],
      [30, 40],
      [40, 50],
      [50, 60],
      [60, 70],
    ],
    sre: [
      [0, 10],
      [10, 20],
      [20, 30],
      [30, 40],
      [40, 50],
    ],
    cva: [
      [0, 10],
      [10, 20],
      [20, 30],
      [30, 40],
      [40, 50],
      [50, 60],
      [60, 70],
      [70, 80],
      [80, 90],
      [90, 100],
    ],
  };

  const taskRanges = ranges[taskSlug];
  if (!taskRanges) return null;

  for (const [min, max] of taskRanges) {
    if (rawScore >= min && rawScore < max) {
      return `${min}-${max}`;
    }
  }

  return null;
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
