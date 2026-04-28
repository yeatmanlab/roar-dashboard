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

// --- Individual Student Report schemas ---

/**
 * Severity styling for a tag, mirroring PrimeVue's tag severity values.
 * Backend emits these as plain strings; the frontend renders them as colored chips.
 */
export const TagSeveritySchema = z.enum(['info', 'success', 'warn', 'danger', 'secondary', 'contrast']);

export type TagSeverity = z.infer<typeof TagSeveritySchema>;

/**
 * A single tag in the per-task entry (e.g., `Type: Required`, `Reliability: Reliable`).
 *
 * `label` and `value` are display strings; the frontend may localize `value`
 * but `label` is a stable identifier the frontend can switch on.
 */
export const TaskTagSchema = z.object({
  label: z.string(),
  value: z.string(),
  severity: TagSeveritySchema,
});

export type TaskTag = z.infer<typeof TaskTagSchema>;

/**
 * Per-task scores object — all three score types are surfaced so the frontend
 * can decide which to display per its grade/task rules. `null` for fields that
 * don't apply (e.g., `standardScore` for grades the task config doesn't norm).
 */
export const TaskScoresSchema = z.object({
  rawScore: z.number().int().nullable(),
  percentile: z.number().int().nullable(),
  standardScore: z.number().int().nullable(),
});

export type TaskScores = z.infer<typeof TaskScoresSchema>;

/**
 * One subscore entry under a task's `subscores` map. `correct`/`attempted` are
 * the underlying counts; `percentCorrect` is `100 * correct / attempted` rounded
 * to one decimal place. Both raw counts are nullable so partial data renders
 * defensibly when the assessment side has not yet emitted a complete tally.
 */
export const SubscoreEntrySchema = z.object({
  correct: z.number().int().nullable(),
  attempted: z.number().int().nullable(),
  percentCorrect: z.number().nullable(),
});

export type SubscoreEntry = z.infer<typeof SubscoreEntrySchema>;

/**
 * A historical score entry for a task — one per prior administration the
 * student completed runs in (and the current administration itself, included
 * for trend continuity).
 *
 * `administrationName` is included so the frontend can label trend chart
 * points without an additional query.
 */
export const HistoricalScoreSchema = z.object({
  administrationId: z.string().uuid(),
  administrationName: z.string(),
  date: z.string().datetime(),
  scores: TaskScoresSchema,
});

export type HistoricalScore = z.infer<typeof HistoricalScoreSchema>;

/**
 * Per-task entry in the individual student report.
 *
 * Fields specific to certain task families:
 * - `subscores` — present for tasks with sub-skill breakdowns (PA, phonics).
 *   Omitted for tasks without subscores.
 * - `skillsToWorkOn` — present for PA tasks only; lists subscore keys whose
 *   `percentCorrect` is below the PA proficiency threshold.
 *
 * `historicalScores` includes only administrations whose `dateStart` is on or
 * before this administration's `dateStart` (ordered chronologically). For
 * tasks the student never completed in a prior administration, this is `[]`.
 */
export const IndividualStudentReportTaskSchema = z.object({
  taskId: z.string().uuid(),
  taskSlug: z.string(),
  taskName: z.string(),
  orderIndex: z.number().int(),
  scores: TaskScoresSchema,
  supportLevel: SupportLevelValueSchema.nullable(),
  reliable: z.boolean().nullable(),
  optional: z.boolean(),
  completed: z.boolean(),
  engagementFlags: z.array(z.string()),
  tags: z.array(TaskTagSchema),
  subscores: z.record(z.string(), SubscoreEntrySchema).optional(),
  skillsToWorkOn: z.array(z.string()).optional(),
  historicalScores: z.array(HistoricalScoreSchema),
});

export type IndividualStudentReportTask = z.infer<typeof IndividualStudentReportTaskSchema>;

/** Header-level student info for the individual student report. */
export const IndividualStudentReportStudentSchema = z.object({
  userId: z.string().uuid(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
  grade: z.string().nullable(),
});

export type IndividualStudentReportStudent = z.infer<typeof IndividualStudentReportStudentSchema>;

/** Header-level administration metadata for the individual student report. */
export const IndividualStudentReportAdministrationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  dateStart: z.string().datetime(),
  dateEnd: z.string().datetime(),
});

export type IndividualStudentReportAdministration = z.infer<typeof IndividualStudentReportAdministrationSchema>;

/**
 * Response schema for the individual student report endpoint.
 *
 * Returns a single resource (no pagination): one student's complete scoreboard
 * for one administration, with header context, per-task scores plus tags and
 * subscores, longitudinal historical scores, and completion summary counts.
 */
export const IndividualStudentReportResponseSchema = z.object({
  student: IndividualStudentReportStudentSchema,
  administration: IndividualStudentReportAdministrationSchema,
  tasks: z.array(IndividualStudentReportTaskSchema),
  /** Number of tasks the student has at least one completed run for. */
  completedTaskCount: z.number().int(),
  /** Total number of tasks visible to the student (post condition evaluation). */
  totalTaskCount: z.number().int(),
});

export type IndividualStudentReportResponse = z.infer<typeof IndividualStudentReportResponseSchema>;

/**
 * Query schema for the individual student report endpoint.
 * Requires scope parameters; no pagination/sort/filter.
 */
export const IndividualStudentReportQuerySchema = ReportScopeQuerySchema;

export type IndividualStudentReportQuery = z.infer<typeof IndividualStudentReportQuerySchema>;

// --- Task Subscores schemas ---

/**
 * One column descriptor in the task subscores response. The frontend uses
 * this metadata to render the per-task table header without hard-coding
 * column lists per task slug.
 */
export const TaskSubscoreColumnSchema = z.object({
  /** Stable column identifier; appears as a key in `subscores` row entries. */
  key: z.string(),
  /** Human-readable label for the column header. */
  label: z.string(),
});

export type TaskSubscoreColumn = z.infer<typeof TaskSubscoreColumnSchema>;

/**
 * One value cell in a task-subscore row. Three shapes are supported:
 * - Item-level scores render as `"correct/attempted"` strings (e.g., `"15/19"`)
 * - Percent / total / raw-score values render as numbers
 * - Computed strings (skills/letters/sounds to work on) render as comma-separated text
 */
export const TaskSubscoreValueSchema = z.union([z.string(), z.number(), z.null()]);

export type TaskSubscoreValue = z.infer<typeof TaskSubscoreValueSchema>;

/**
 * One row in the task subscores response — student demographics plus the
 * per-column subscore values. Keys in `subscores` correspond exactly to
 * the `subscoreColumns[].key` values returned with the same response so
 * the frontend can iterate the columns and look up cells by key.
 */
export const TaskSubscoreRowSchema = z.object({
  user: ReportUserInfoSchema,
  subscores: z.record(z.string(), TaskSubscoreValueSchema),
});

export type TaskSubscoreRow = z.infer<typeof TaskSubscoreRowSchema>;

/**
 * Pattern matching `subscores.<key>` for dynamic sort/filter — the key is
 * validated against the task's registered subscore columns in the service
 * layer. Unknown keys return 400.
 */
export const SUBSCORE_FIELD_PATTERN = /^subscores\.[a-zA-Z][a-zA-Z0-9_]*$/;

/**
 * Static sort fields for the task subscores endpoint.
 *
 * Also accepts dynamic `subscores.<key>` fields via pattern matching. The
 * key is validated server-side against the task's registered subscore
 * columns; unknown keys return 400.
 *
 * `user.schoolName` is intentionally absent from the sort fields — it's
 * filterable (against district scope) but not sortable on this endpoint,
 * since the repository doesn't compile a school-name sort path. Static
 * user-table columns (`lastName`, `firstName`, `username`, `grade`) are
 * the only allowed user-side sort keys.
 */
export const TASK_SUBSCORES_SORT_FIELDS = ['user.lastName', 'user.firstName', 'user.username', 'user.grade'] as const;

export type TaskSubscoresSortField = (typeof TASK_SUBSCORES_SORT_FIELDS)[number];

/**
 * Static filter fields for the task subscores endpoint.
 *
 * Also accepts dynamic `subscores.<key>` fields. Numeric subscore filters
 * (`gte`, `lte`, `eq`, `neq`) are evaluated against the column's
 * percent-correct value where one is defined; columns without a numeric
 * representation (e.g., `skillsToWorkOn`) reject numeric operators.
 */
export const TASK_SUBSCORES_FILTER_FIELDS = [
  'user.grade',
  'user.firstName',
  'user.lastName',
  'user.username',
  'user.email',
  'user.schoolName',
] as const;

export type TaskSubscoresFilterField = (typeof TASK_SUBSCORES_FILTER_FIELDS)[number];

/**
 * Query schema for the task subscores endpoint. Combines pagination, scope,
 * filter (with dynamic `subscores.<key>` support), and sort (with dynamic
 * `subscores.<key>` support).
 */
export const TaskSubscoresQuerySchema = PaginationQuerySchema.merge(ReportScopeQuerySchema)
  .merge(
    createFilterQuerySchema(TASK_SUBSCORES_FILTER_FIELDS, {
      dynamicFieldPatterns: [SUBSCORE_FIELD_PATTERN],
      dynamicFieldHint: 'subscores.<key>',
    }),
  )
  .merge(
    createDynamicSortQuerySchema(
      TASK_SUBSCORES_SORT_FIELDS,
      'user.lastName',
      'asc',
      [SUBSCORE_FIELD_PATTERN],
      'subscores.<key>',
    ),
  );

export type TaskSubscoresQuery = z.infer<typeof TaskSubscoresQuerySchema>;

/**
 * Response schema for the task subscores endpoint.
 *
 * `task` carries the same identifying metadata as other report responses.
 * `subscoreColumns` declares the column ordering and labels — the frontend
 * iterates this array, then looks up each row's value by key. Tasks without
 * a registered subscore schema return 400 from this endpoint.
 */
export const TaskSubscoresResponseSchema = z.object({
  task: ReportTaskMetadataSchema,
  subscoreColumns: z.array(TaskSubscoreColumnSchema),
  items: z.array(TaskSubscoreRowSchema),
  pagination: PaginationMetaSchema,
});

export type TaskSubscoresResponse = z.infer<typeof TaskSubscoresResponseSchema>;
