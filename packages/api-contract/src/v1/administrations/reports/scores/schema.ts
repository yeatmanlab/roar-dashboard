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
 * Support level distribution counts and percentages for a single category.
 */
export const SupportLevelEntrySchema = z.object({
  count: z.number().int(),
  /** Percentage of totalAssessed (0-100), rounded to 1 decimal place */
  percentage: z.number(),
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
  supportLevels: z.object({
    achievedSkill: SupportLevelEntrySchema,
    developingSkill: SupportLevelEntrySchema,
    needsExtraSupport: SupportLevelEntrySchema,
  }),
});

export type TaskScoreOverview = z.infer<typeof TaskScoreOverviewSchema>;

/**
 * Response schema for the score overview endpoint.
 */
export const ScoreOverviewResponseSchema = z.object({
  totalStudents: z.number().int(),
  tasks: z.array(TaskScoreOverviewSchema),
});

export type ScoreOverviewResponse = z.infer<typeof ScoreOverviewResponseSchema>;
