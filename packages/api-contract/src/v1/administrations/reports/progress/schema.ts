import { z } from 'zod';
import { PaginationQuerySchema, PaginationMetaSchema, createDynamicSortQuerySchema } from '../../../common/query';
import {
  ReportScopeQuerySchema,
  createFilterQuerySchema,
  ReportTaskMetadataSchema,
  ReportUserInfoSchema,
} from '../common';

/**
 * Completion status for a student on a specific task.
 *
 * - `assigned` — task is assigned and required, but not yet started
 * - `started` — a run exists but is not completed
 * - `completed` — a run with a completedAt timestamp exists
 * - `optional` — task conditions mark it optional for this student (e.g., based on
 *   grade/ELL status). Produced when conditionsRequirements evaluates to true.
 *
 * Tasks where conditionsAssignment evaluates to false for a student are excluded
 * from that student's progress map entirely — they are not visible.
 */
export const ProgressStatusSchema = z.enum(['assigned', 'started', 'completed', 'optional']);

export type ProgressStatus = z.infer<typeof ProgressStatusSchema>;

export const ProgressStatus = {
  ASSIGNED: 'assigned',
  STARTED: 'started',
  COMPLETED: 'completed',
  OPTIONAL: 'optional',
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
 * highest-priority status (completed > started > assigned > optional).
 */
export const ProgressTaskOverviewSchema = z.object({
  taskId: z.string().uuid(),
  taskSlug: z.string(),
  taskName: z.string(),
  orderIndex: z.number().int(),
  assigned: z.number().int(),
  started: z.number().int(),
  completed: z.number().int(),
  optional: z.number().int(),
});

export type ProgressTaskOverview = z.infer<typeof ProgressTaskOverviewSchema>;

/**
 * Response schema for the progress overview endpoint.
 *
 * - `totalStudents`: distinct student count in scope (regardless of task assignment).
 *   Students excluded from all tasks by `conditionsAssignment` are counted here
 *   but not in any per-task count.
 * - `assigned`, `started`, `completed`: aggregate sums across all tasks in `byTask`.
 *   `optional` is excluded from top-level totals — it represents non-required tasks
 *   and doesn't contribute to completion goals.
 * - `byTask`: ordered array (by orderIndex) with per-task counts
 * - `computedAt`: server timestamp for freshness display
 */
export const ProgressOverviewResponseSchema = z.object({
  totalStudents: z.number().int(),
  assigned: z.number().int(),
  started: z.number().int(),
  completed: z.number().int(),
  byTask: z.array(ProgressTaskOverviewSchema),
  computedAt: z.string().datetime(),
});

export type ProgressOverviewResponse = z.infer<typeof ProgressOverviewResponseSchema>;
