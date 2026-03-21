import { z } from 'zod';
import { PaginationQuerySchema, PaginationMetaSchema, createSortQuerySchema } from '../../common/query';
import {
  ReportScopeQuerySchema,
  ReportFilterQuerySchema,
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
 * Sort fields for the progress students endpoint.
 *
 * Currently supports user fields only. Dynamic `progress.<taskId>.status` sorting
 * is planned for a future iteration — when added, it will be validated against
 * a UUID regex pattern in the service layer.
 *
 * Note: `user.schoolName` is excluded because it's a derived field resolved via
 * a separate query, not a direct column. Sorting by it would require a join.
 */
export const PROGRESS_STUDENTS_SORT_FIELDS = [
  'user.lastName',
  'user.firstName',
  'user.username',
  'user.grade',
] as const;

export type ProgressStudentsSortField = (typeof PROGRESS_STUDENTS_SORT_FIELDS)[number];

/**
 * Query schema for the progress students endpoint.
 * Combines pagination, scope, filter, and sort parameters.
 */
export const ProgressStudentsQuerySchema = PaginationQuerySchema.merge(ReportScopeQuerySchema)
  .merge(ReportFilterQuerySchema)
  .merge(createSortQuerySchema(PROGRESS_STUDENTS_SORT_FIELDS, 'user.lastName', 'asc'));

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
