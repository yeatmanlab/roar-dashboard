import { z } from 'zod';

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
 * Filter operator for report filter expressions.
 */
export const FilterOperatorSchema = z.enum(['eq', 'neq', 'in', 'gte', 'lte', 'contains']);

export type FilterOperator = z.infer<typeof FilterOperatorSchema>;

/**
 * Parsed filter expression from the `?filter=field:operator:value` query parameter.
 *
 * @typeParam TField - The allowed filter field names. Defaults to `string` for
 *   backwards compatibility, but when produced by `createFilterQuerySchema`, the
 *   field is constrained to the allowed values at parse time.
 */
export interface ParsedFilter<TField extends string = string> {
  field: TField;
  operator: FilterOperator;
  value: string;
}

/**
 * Creates a typed filter query schema that validates field names against an
 * allowed list at parse time, mirroring how `createSortQuerySchema` validates
 * sort fields and `createEmbedQuerySchema` validates embed options.
 *
 * Accepts an array of strings in the format `field:operator:value`.
 * Parses each string into a structured `ParsedFilter<TField>` object.
 *
 * @param allowedFields - Tuple of allowed filter field names
 * @returns Zod schema that parses and validates filter query parameters
 *
 * @example
 * ```typescript
 * const PROGRESS_FILTER_FIELDS = ['user.grade', 'user.firstName'] as const;
 * const schema = createFilterQuerySchema(PROGRESS_FILTER_FIELDS);
 * // Produces ParsedFilter<'user.grade' | 'user.firstName'>[]
 * ```
 */
export const createFilterQuerySchema = <T extends readonly [string, ...string[]]>(allowedFields: T) =>
  z.object({
    filter: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((val) => {
        if (!val) return [] as string[];
        return Array.isArray(val) ? val : [val];
      })
      .pipe(
        z.array(z.string()).transform((filters, ctx): ParsedFilter<T[number]>[] =>
          filters.reduce<ParsedFilter<T[number]>[]>((acc, f, i) => {
            const parts = f.split(':');
            if (parts.length < 3) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Invalid filter format: "${f}". Expected "field:operator:value"`,
                path: [i],
              });
              return acc;
            }

            // Rejoin parts after the second colon to handle values containing colons
            const field = parts[0]!;
            const operator = parts[1]!;
            const value = parts.slice(2).join(':');

            if (!field) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Filter field name must not be empty: "${f}"`,
                path: [i],
              });
              return acc;
            }
            if (value === '') {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Filter value must not be empty: "${f}"`,
                path: [i],
              });
              return acc;
            }
            if (!allowedFields.includes(field)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Unknown filter field: "${field}". Allowed: ${allowedFields.join(', ')}`,
                path: [i],
              });
              return acc;
            }

            const parsed = FilterOperatorSchema.safeParse(operator);
            if (!parsed.success) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Invalid filter operator: "${operator}". Supported: eq, neq, in, gte, lte, contains`,
                path: [i],
              });
              return acc;
            }

            acc.push({ field: field as T[number], operator: parsed.data, value });
            return acc;
          }, []),
        ),
      ),
  });

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
  username: z.string().nullable(),
  email: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  grade: z.string().nullable(),
  schoolName: z.string().nullable().optional(),
});

export type ReportUserInfo = z.infer<typeof ReportUserInfoSchema>;
