import { z } from 'zod';

// Filter types are defined in common/query and re-exported here for backwards compatibility.
export type { FilterOperator, ParsedFilter, FilterQuerySchemaOptions } from '../../common/query';
export { FilterOperatorSchema, createFilterQuerySchema } from '../../common/query';

/**
 * Supported scope types for reporting endpoints.
 * Determines which entity type is used to narrow the student population.
 */
export const ScopeTypeSchema = z.enum(['district', 'school', 'class', 'group']);

export type ScopeType = z.infer<typeof ScopeTypeSchema>;

export const ScopeType = {
  DISTRICT: 'district',
  SCHOOL: 'school',
  CLASS: 'class',
  GROUP: 'group',
} as const satisfies Record<string, ScopeType>;

/**
 * Required query parameters for scoping report results to a specific entity.
 * Both scopeType and scopeId are required on all administration-scoped report endpoints.
 */
export const ReportScopeQuerySchema = z.object({
  scopeType: ScopeTypeSchema,
  scopeId: z.string().uuid(),
});

export type ReportScopeQuery = z.infer<typeof ReportScopeQuerySchema>;

/**
 * Task metadata included in report responses for column header rendering.
 * Eliminates the need for a separate task dictionary query.
 */
export const ReportTaskMetadataSchema = z.object({
  taskId: z.string().uuid(),
  taskSlug: z.string(),
  taskName: z.string(),
  orderIndex: z.number().int(),
});

export type ReportTaskMetadata = z.infer<typeof ReportTaskMetadataSchema>;

/**
 * User info included in report student rows.
 *
 * `schoolName` is only populated for district-scoped requests. It is a derived
 * field (resolved via org membership lookup, not a direct column), so it supports
 * neither sorting nor filtering. Sortable fields: lastName, firstName, username,
 * grade. Filterable fields: grade, firstName, lastName, username, email.
 */
export const ReportUserInfoSchema = z.object({
  userId: z.string().uuid(),
  assessmentPid: z.string().nullable(),
  username: z.string().nullable(),
  email: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  grade: z.string().nullable(),
  schoolName: z.string().nullable().optional(),
});

export type ReportUserInfo = z.infer<typeof ReportUserInfoSchema>;
