import { z } from 'zod';
import { PaginationQuerySchema, PaginationMetaSchema, createDynamicSortQuerySchema } from '../../../common/query';
import {
  ReportScopeQuerySchema,
  createFilterQuerySchema,
  ReportTaskMetadataSchema,
  ReportUserInfoSchema,
} from '../common';

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
 *
 * Note: the three support-level percentages (achievedSkill, developingSkill,
 * needsExtraSupport) are not guaranteed to sum to 100%. Students with completed
 * runs whose scores can't be classified (null `getSupportLevel` return — e.g.,
 * raw-score-only tasks, unknown task slugs, or unresolvable thresholds for the
 * scoring version) are counted in `totalAssessed` but in none of the three
 * buckets, so the bucket sum can be less than `totalAssessed` and the
 * percentages can sum to less than 100%.
 */
export const SupportLevelEntrySchema = z.object({
  count: z.number().int(),
  /** Percentage of totalAssessed (0-100), rounded to 1 decimal place */
  percentage: z.number(),
});

export type SupportLevelEntry = z.infer<typeof SupportLevelEntrySchema>;

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
  /** Server timestamp when the aggregation was computed (ISO 8601) */
  computedAt: z.string().datetime(),
});

export type ScoreOverviewResponse = z.infer<typeof ScoreOverviewResponseSchema>;

// --- Student Scores schemas ---

/**
 * Per-task score field types that may appear in dynamic sort/filter strings,
 * formatted as `scores.<taskId>.<field>`.
 *
 * - `rawScore` — domain-specific raw score value
 * - `percentile` — percentile ranking
 * - `standardScore` — normed standard score
 * - `supportLevel` — derived classification (achievedSkill, developingSkill,
 *   needsExtraSupport, optional, null). Sortable via per-variant SQL CASE
 *   constructed from the scoring config's resolved cutoffs.
 */
export const SCORE_FIELD_TYPES = ['rawScore', 'percentile', 'standardScore', 'supportLevel'] as const;
export type ScoreFieldType = (typeof SCORE_FIELD_TYPES)[number];

/**
 * Regex pattern matching `scores.<uuid>.<field>` for dynamic sort/filter.
 * The UUID is validated against the administration's actual task IDs in the
 * service layer; the field is one of `SCORE_FIELD_TYPES`.
 */
export const SCORE_TASK_FIELD_PATTERN =
  /^scores\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(rawScore|percentile|standardScore|supportLevel)$/;

/**
 * Static sort fields for the student scores endpoint.
 *
 * Also accepts dynamic `scores.<taskId>.<field>` fields via pattern matching.
 * The taskId UUID is validated against the administration's actual tasks in the
 * service layer — unknown task IDs return 400.
 *
 * `user.schoolName` is sortable here (unlike progress) because the column is
 * resolved via a LEFT JOIN against the org/class hierarchy that supports
 * SQL-level ordering.
 */
export const STUDENT_SCORES_SORT_FIELDS = [
  'user.lastName',
  'user.firstName',
  'user.username',
  'user.grade',
  'user.schoolName',
] as const;

export type StudentScoresSortField = (typeof STUDENT_SCORES_SORT_FIELDS)[number];

/**
 * Static filter fields for the student scores endpoint.
 *
 * Also accepts dynamic `scores.<taskId>.<field>` fields via pattern matching.
 * `user.schoolName` filtering uses ILIKE for partial matches and is only
 * meaningful at district scope.
 */
export const STUDENT_SCORES_FILTER_FIELDS = [
  'taskId',
  'user.grade',
  'user.firstName',
  'user.lastName',
  'user.username',
  'user.email',
  'user.schoolName',
] as const;

export type StudentScoresFilterField = (typeof STUDENT_SCORES_FILTER_FIELDS)[number];

/**
 * Query schema for the student scores endpoint.
 * Combines pagination, scope, filter, and sort parameters with dynamic score-field support.
 */
export const StudentScoresQuerySchema = PaginationQuerySchema.merge(ReportScopeQuerySchema)
  .merge(
    createFilterQuerySchema(STUDENT_SCORES_FILTER_FIELDS, {
      dynamicFieldPatterns: [SCORE_TASK_FIELD_PATTERN],
      dynamicFieldHint: 'scores.<taskId>.<rawScore|percentile|standardScore|supportLevel>',
    }),
  )
  .merge(
    createDynamicSortQuerySchema(
      STUDENT_SCORES_SORT_FIELDS,
      'user.lastName',
      'asc',
      [SCORE_TASK_FIELD_PATTERN],
      'scores.<taskId>.<rawScore|percentile|standardScore|supportLevel>',
    ),
  );

export type StudentScoresQuery = z.infer<typeof StudentScoresQuerySchema>;

/**
 * Support level classification values returned in per-task score entries.
 *
 * Names match the scoring service's `SupportLevel` type for consistency.
 * `optional` appears only when the student has no completed run AND the task
 * is optional for them per condition evaluation. Students with completed runs
 * are categorized into their actual support level (achievedSkill, developingSkill,
 * or needsExtraSupport) regardless of whether the task was optional.
 *
 * `null` is returned when classification is not possible (no score data, unknown
 * task, or thresholds unavailable).
 */
export const SupportLevelValueSchema = z.enum(['achievedSkill', 'developingSkill', 'needsExtraSupport', 'optional']);

export type SupportLevelValue = z.infer<typeof SupportLevelValueSchema>;

/**
 * Per-task score entry on a student row.
 *
 * - `completed: true` → student has a completed run; score fields populated where available
 * - `completed: false` → student has no completed run; score fields are null and
 *   `supportLevel` is either `'optional'` (task optional for this student) or `null` (assigned-required)
 *
 * `reliable` and `engagementFlags` are populated from the underlying run regardless
 * of completion. They are null/empty when no run exists.
 */
export const StudentScoreEntrySchema = z.object({
  rawScore: z.number().int().nullable(),
  percentile: z.number().int().nullable(),
  standardScore: z.number().int().nullable(),
  supportLevel: SupportLevelValueSchema.nullable(),
  reliable: z.boolean().nullable(),
  engagementFlags: z.array(z.string()),
  /**
   * Whether this task is optional for the student per condition evaluation.
   * Independent of completion status — an optional task can still be completed.
   */
  optional: z.boolean(),
  /** Whether the student has at least one completed run for this task. */
  completed: z.boolean(),
});

export type StudentScoreEntry = z.infer<typeof StudentScoreEntrySchema>;

/**
 * A student row in the score report, keyed by taskId.
 *
 * Tasks where `conditionsAssignment` evaluates to false for the student are excluded
 * from the `scores` map entirely — the task is not visible to that student.
 */
export const StudentScoreRowSchema = z.object({
  user: ReportUserInfoSchema,
  scores: z.record(z.string().uuid(), StudentScoreEntrySchema),
});

export type StudentScoreRow = z.infer<typeof StudentScoreRowSchema>;

/**
 * Response schema for the student scores endpoint.
 * Includes task metadata for column rendering and paginated student rows.
 */
export const StudentScoresResponseSchema = z.object({
  tasks: z.array(ReportTaskMetadataSchema),
  items: z.array(StudentScoreRowSchema),
  pagination: PaginationMetaSchema,
});

export type StudentScoresResponse = z.infer<typeof StudentScoresResponseSchema>;
