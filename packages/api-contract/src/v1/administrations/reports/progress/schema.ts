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
 * - `assigned` — task is assigned but not yet started
 * - `started` — a run exists but is not completed
 * - `completed` — a run with a completedAt timestamp exists
 * - `optional` — reserved for future use; will be produced when task condition
 *   evaluation is implemented (e.g., tasks conditionally assigned based on grade/ELL status).
 *   Currently never returned by the API.
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
 * `startedAt` is currently always null because the FDW view (`app_fdw.fdw_runs`)
 * does not expose the assessment runs table's `created_at` column. The backend
 * is fully wired to populate `startedAt` — once the FDW view is migrated to
 * include `created_at`, add it to the `fdwRuns` Drizzle schema and the
 * repository SELECT to activate it. No other code changes needed.
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
