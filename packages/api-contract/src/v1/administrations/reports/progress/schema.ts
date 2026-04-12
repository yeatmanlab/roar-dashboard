import { z } from 'zod';
import { PaginationQuerySchema, PaginationMetaSchema, createDynamicSortQuerySchema } from '../../../common/query';
import {
  ReportScopeQuerySchema,
  createFilterQuerySchema,
  ReportTaskMetadataSchema,
  ReportUserInfoSchema,
} from '../common';

/**
 * 7-level progress status that orthogonalizes progress (assigned → started → completed)
 * from requirement (required vs optional).
 *
 * - `assigned-required` — task is assigned, required, not yet started
 * - `assigned-optional` — task is assigned, optional, not yet started
 * - `started-required` — a run exists but not completed; task is required
 * - `started-optional` — a run exists but not completed; task is optional
 * - `completed-required` — a run with completedAt exists; task is required
 * - `completed-optional` — a run with completedAt exists; task is optional
 *
 * The required/optional distinction comes from `conditionsRequirements` (which is an
 * "optional_if" condition — when it evaluates to true, the task is optional for that
 * student). Conditions are evaluated for ALL students, including those with runs.
 *
 * Tasks where conditionsAssignment evaluates to false for a student are excluded
 * from that student's progress map entirely — they are not visible. This "excluded"
 * state (priority -1) is the 7th level in the SQL CASE expression but is filtered
 * before reaching API consumers, so this schema only defines the 6 visible statuses.
 */
export const ProgressStatusSchema = z.enum([
  'assigned-required',
  'assigned-optional',
  'started-required',
  'started-optional',
  'completed-required',
  'completed-optional',
]);

export type ProgressStatus = z.infer<typeof ProgressStatusSchema>;

export const ProgressStatus = {
  ASSIGNED_REQUIRED: 'assigned-required',
  ASSIGNED_OPTIONAL: 'assigned-optional',
  STARTED_REQUIRED: 'started-required',
  STARTED_OPTIONAL: 'started-optional',
  COMPLETED_REQUIRED: 'completed-required',
  COMPLETED_OPTIONAL: 'completed-optional',
} as const satisfies Record<string, ProgressStatus>;

/**
 * Regex pattern matching `progress.<uuid>.status` for dynamic sort/filter fields.
 * The UUID is validated against the administration's actual task IDs in the service layer.
 */
export const PROGRESS_TASK_STATUS_PATTERN =
  /^progress\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.status$/;

/**
 * Static sort fields for the progress students endpoint.
 *
 * Also accepts dynamic `progress.<taskId>.status` fields via pattern matching.
 * The taskId UUID is validated against the administration's actual tasks in the
 * service layer — unknown task IDs return 400.
 *
 * Note: `user.schoolName` sorting is not supported because it's a derived field
 * resolved via a separate org membership query, not a direct column. Filtering
 * by school is not needed — use `scopeType=school` instead.
 */
export const PROGRESS_STUDENTS_SORT_FIELDS = [
  'user.lastName',
  'user.firstName',
  'user.username',
  'user.grade',
] as const;

export type ProgressStudentsSortField = (typeof PROGRESS_STUDENTS_SORT_FIELDS)[number];

/**
 * Static filter fields for the progress students endpoint.
 *
 * Also accepts dynamic `progress.<taskId>.status` fields via pattern matching.
 * The taskId UUID is validated against the administration's actual tasks in the
 * service layer — unknown task IDs return 400.
 *
 * Note: `user.schoolName` filtering is not needed — use `scopeType=school` instead,
 * which scopes the entire student population to a specific school.
 */
export const PROGRESS_STUDENTS_FILTER_FIELDS = [
  'user.grade',
  'user.firstName',
  'user.lastName',
  'user.username',
  'user.email',
] as const;

export type ProgressStudentsFilterField = (typeof PROGRESS_STUDENTS_FILTER_FIELDS)[number];

/**
 * Query schema for the progress students endpoint.
 * Combines pagination, scope, filter, and sort parameters.
 *
 * Both sort and filter accept dynamic `progress.<taskId>.status` fields
 * in addition to the static user fields.
 */
export const ProgressStudentsQuerySchema = PaginationQuerySchema.merge(ReportScopeQuerySchema)
  .merge(
    createFilterQuerySchema(PROGRESS_STUDENTS_FILTER_FIELDS, {
      dynamicFieldPatterns: [PROGRESS_TASK_STATUS_PATTERN],
      dynamicFieldHint: 'progress.<taskId>.status',
    }),
  )
  .merge(
    createDynamicSortQuerySchema(
      PROGRESS_STUDENTS_SORT_FIELDS,
      'user.lastName',
      'asc',
      [PROGRESS_TASK_STATUS_PATTERN],
      'progress.<taskId>.status',
    ),
  );

export type ProgressStudentsQuery = z.infer<typeof ProgressStudentsQuerySchema>;

/**
 * Per-task progress entry for a student.
 *
 * `startedAt` is populated from the FDW runs table's `created_at` column,
 * which represents when the run was created (i.e., when the student started
 * the task). It is null only for tasks with no run (assigned/optional status).
 */
export const ProgressEntrySchema = z.object({
  status: ProgressStatusSchema,
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});

export type ProgressEntry = z.infer<typeof ProgressEntrySchema>;

/**
 * A student row in the progress report.
 */
export const ProgressStudentSchema = z.object({
  user: ReportUserInfoSchema,
  progress: z.record(z.string().uuid(), ProgressEntrySchema),
});

export type ProgressStudent = z.infer<typeof ProgressStudentSchema>;

/**
 * Response schema for the progress students endpoint.
 * Includes task metadata for column rendering and paginated student rows.
 */
export const ProgressStudentsResponseSchema = z.object({
  tasks: z.array(ReportTaskMetadataSchema),
  items: z.array(ProgressStudentSchema),
  pagination: PaginationMetaSchema,
});

export type ProgressStudentsResponse = z.infer<typeof ProgressStudentsResponseSchema>;

// --- Progress Overview schemas ---

/**
 * Query schema for the progress overview endpoint.
 * Only requires scope parameters — no pagination, sorting, or filtering.
 */
export const ProgressOverviewQuerySchema = ReportScopeQuerySchema;

export type ProgressOverviewQuery = z.infer<typeof ProgressOverviewQuerySchema>;

/**
 * Per-task aggregation in the progress overview response.
 * Counts are mutually exclusive: each student is counted once per task at their
 * highest-priority status across both the progress and requirement axes.
 *
 * The 7-level counts are also rolled up into convenience totals by progress axis
 * (assigned, started, completed) and requirement axis (required, optional) for
 * simpler consumption.
 */
export const ProgressTaskOverviewSchema = z.object({
  taskId: z.string().uuid(),
  taskSlug: z.string(),
  taskName: z.string(),
  orderIndex: z.number().int(),
  /** 7-level per-status counts */
  assignedRequired: z.number().int(),
  assignedOptional: z.number().int(),
  startedRequired: z.number().int(),
  startedOptional: z.number().int(),
  completedRequired: z.number().int(),
  completedOptional: z.number().int(),
  /** Convenience totals by progress axis */
  assigned: z.number().int(),
  started: z.number().int(),
  completed: z.number().int(),
  /** Convenience totals by requirement axis */
  required: z.number().int(),
  optional: z.number().int(),
});

export type ProgressTaskOverview = z.infer<typeof ProgressTaskOverviewSchema>;

/**
 * Response schema for the progress overview endpoint.
 *
 * Top-level fields are per-student, assignment-level counts based on required tasks only:
 *
 * - `totalStudents`: distinct student count in scope (regardless of task assignment).
 *   Students excluded from all tasks by `conditionsAssignment` are still counted here.
 * - `studentsWithRequiredTasks`: students who have at least one required task.
 *   This is the denominator for the three assignment-level buckets below.
 *   Students whose tasks are ALL optional are excluded.
 * - `studentsAssigned`: students where ALL required tasks are still at assigned-required.
 * - `studentsStarted`: students with at least one required task started or completed,
 *   but not ALL required tasks completed.
 * - `studentsCompleted`: students where ALL required tasks are at completed-required.
 *
 * Invariant: `studentsAssigned + studentsStarted + studentsCompleted = studentsWithRequiredTasks`.
 *
 * - `byTask`: ordered array (by orderIndex) with per-task counts
 * - `computedAt`: server timestamp for freshness display
 */
export const ProgressOverviewResponseSchema = z.object({
  totalStudents: z.number().int(),
  studentsWithRequiredTasks: z.number().int(),
  studentsAssigned: z.number().int(),
  studentsStarted: z.number().int(),
  studentsCompleted: z.number().int(),
  byTask: z.array(ProgressTaskOverviewSchema),
  computedAt: z.string().datetime(),
});

export type ProgressOverviewResponse = z.infer<typeof ProgressOverviewResponseSchema>;
