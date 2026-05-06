import { z } from 'zod';
import { ReportScopeQuerySchema, createFilterQuerySchema, ReportTaskMetadataSchema } from '../common';

/**
 * Filter fields for the score overview endpoint.
 *
 * - `taskId`: limit which tasks are included in the aggregation (use `in` operator)
 * - `user.grade`: filter the student population by grade before aggregation
 *
 * Note: `user.schoolName` filtering is deferred — it requires a join through
 * org membership that is not yet implemented in the repository layer.
 */
export const SCORE_OVERVIEW_FILTER_FIELDS = ['taskId', 'user.grade'] as const;

export type ScoreOverviewFilterField = (typeof SCORE_OVERVIEW_FILTER_FIELDS)[number];

/**
 * Query schema for the score overview endpoint.
 * Combines scope and filter parameters. Not paginated — this is an aggregation.
 */
export const ScoreOverviewQuerySchema = ReportScopeQuerySchema.merge(
  createFilterQuerySchema(SCORE_OVERVIEW_FILTER_FIELDS),
);

export type ScoreOverviewQuery = z.infer<typeof ScoreOverviewQuerySchema>;

/**
 * Support level distribution counts for a single category.
 */
export const SupportLevelEntrySchema = z.object({
  count: z.number().int(),
});

export type SupportLevelEntry = z.infer<typeof SupportLevelEntrySchema>;

const SupportLevelSchema = z.object({
  achievedSkill: SupportLevelEntrySchema,
  developingSkill: SupportLevelEntrySchema,
  needsExtraSupport: SupportLevelEntrySchema,
});

/**
 * Per-task score overview with support level distribution.
 */
export const TaskScoreOverviewSchema = ReportTaskMetadataSchema.extend({
  /** Number of students with a completed run and classifiable scores */
  totalAssessed: z.number().int(),
  /** Students with no completed run, split by assignment status */
  totalNotAssessed: z.object({
    required: z.number().int(),
    optional: z.number().int(),
  }),
  /** Support level distribution (only for assessed students) */
  supportLevels: SupportLevelSchema,
});

export type TaskScoreOverview = z.infer<typeof TaskScoreOverviewSchema>;

/**
 * Response schema for the score overview endpoint.
 */
export const ScoreOverviewResponseSchema = z.object({
  totalStudents: z.number().int(),
  tasks: z.array(TaskScoreOverviewSchema),
  /** Server timestamp when the aggregation was computed (ISO 8601) */
  computedAt: z.string().datetime(),
});

export type ScoreOverviewResponse = z.infer<typeof ScoreOverviewResponseSchema>;

/**
 * Schemas part of the score distribution response
 */
const SupportLevelByGradeSchema = SupportLevelSchema.extend({
  grade: z.string(),
  totalAssessed: z.number().int(),
});

// AMY TODO: Why is it optional for schoolName?
const SupportLevelBySchoolSchema = SupportLevelSchema.extend({
  schoolId: z.string().uuid(),
  schoolName: z.string().nullable().optional(),
  totalAssessed: z.number().int(),
});

const ScoreBinSchema = z.object({
  binStart: z.number(),
  binEnd: z.number(),
  count: z.number().int(),
});

const ScoreBinsByGradeSchema = z.object({
  grade: z.string(),
  rawScore: z.array(ScoreBinSchema),
  percentile: z.array(ScoreBinSchema),
});

const ScoreBinsBySchoolSchema = z.object({
  schoolId: z.string().uuid(),
  schoolName: z.string(),
  rawScore: z.array(ScoreBinSchema),
  percentile: z.array(ScoreBinSchema),
});

const TaskScoreFacetSchema = ReportTaskMetadataSchema.extend({
  supportLevelByGrade: z.array(SupportLevelByGradeSchema),
  supportLevelBySchool: z.array(SupportLevelBySchoolSchema).nullable(),
  scoreBinsByGrade: z.array(ScoreBinsByGradeSchema),
  scoreBinsBySchool: z.array(ScoreBinsBySchoolSchema).nullable(),
});

/**
 * Response schema for score distribution facets endpoint
 */
export const ScoreFacetsResponseSchema = z.object({
  totalStudents: z.number().int(),
  tasks: z.array(TaskScoreFacetSchema),
  /** Server timestamp when the aggregation was computed (ISO 8601) */
  computedAt: z.string().datetime(),
});
