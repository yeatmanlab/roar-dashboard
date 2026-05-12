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

/**
 * Opt-in toggle for the administration-aware enrollment overlap rule
 * (#1792). Defaults to `false` (strict overlap as of
 * `LEAST(administrations.dateEnd, NOW())`).
 *
 * When `true`, list and overview reporting endpoints additionally include
 * students whose enrollment overlapped the administration window but ended
 * before the check date **and** who have at least one non-deleted,
 * non-aborted `runs` record for this administration. This preserves the
 * "Johnny took the test before he left" case without bringing back the
 * noisy "exited student who never started" case.
 *
 * Mirrored across the four list reporting endpoints (progress students,
 * progress overview, scores overview, student scores) so callers see the
 * same shape on both report families. The per-student endpoint and the
 * tree-stats embed do not accept this parameter — see the ticket for the
 * rationale.
 *
 * Coercion: we accept JSON booleans, the literal strings `'true'` /
 * `'false'`, missing (defaults to `false`), and reject anything else with a
 * `REQUEST_VALIDATION_FAILED`. We deliberately do NOT use
 * `z.coerce.boolean()` — that calls `Boolean(value)`, so any non-empty
 * string (including `'false'`, `'0'`, and `'no'`) coerces to `true`,
 * silently turning a misconfigured frontend into a privacy bug.
 */
export const IncludeUnenrolledStudentsQuerySchema = z.object({
  includeUnenrolledStudents: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((v) => v === true || v === 'true')
    .default(false),
});

export type IncludeUnenrolledStudentsQuery = z.infer<typeof IncludeUnenrolledStudentsQuerySchema>;

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
