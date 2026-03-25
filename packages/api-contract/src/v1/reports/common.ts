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
 * Options for createFilterQuerySchema.
 */
export interface FilterQuerySchemaOptions {
  /**
   * Regex patterns for dynamic field names that can't be enumerated statically.
   * Fields matching any pattern bypass the static allowlist and pass through
   * with type `string`. The service layer is responsible for extracting IDs
   * and validating them against actual data.
   *
   * @example
   * ```typescript
   * // Accept progress.<uuid>.status as a dynamic filter field
   * dynamicFieldPatterns: [/^progress\.[0-9a-f-]{36}\.status$/]
   * ```
   */
  dynamicFieldPatterns?: RegExp[];
  /**
   * Human-readable description of accepted dynamic fields for error messages.
   * Without this, the error only lists static fields.
   *
   * @example 'progress.<taskId>.status'
   */
  dynamicFieldHint?: string;
}

/**
 * Creates a typed filter query schema that validates field names against an
 * allowed list at parse time, mirroring how `createSortQuerySchema` validates
 * sort fields and `createEmbedQuerySchema` validates embed options.
 *
 * Accepts an array of strings in the format `field:operator:value`.
 * Parses each string into a structured `ParsedFilter<TField>` object.
 *
 * Static fields are validated against `allowedFields` and typed as `T[number]`.
 * Dynamic fields matching `options.dynamicFieldPatterns` pass through as `string`
 * — the service layer validates them against actual data (e.g., administration tasks).
 *
 * @param allowedFields - Tuple of allowed static filter field names
 * @param options - Optional configuration for dynamic field patterns
 * @returns Zod schema that parses and validates filter query parameters
 *
 * @example
 * ```typescript
 * const FIELDS = ['user.grade', 'user.firstName'] as const;
 * const schema = createFilterQuerySchema(FIELDS, {
 *   dynamicFieldPatterns: [/^progress\.[0-9a-f-]{36}\.status$/],
 * });
 * ```
 */
export const createFilterQuerySchema = <T extends readonly [string, ...string[]]>(
  allowedFields: T,
  options?: FilterQuerySchemaOptions,
) =>
  z.object({
    filter: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((val) => {
        if (!val) return [] as string[];
        return Array.isArray(val) ? val : [val];
      })
      .pipe(
        z.array(z.string()).transform((filters, ctx): ParsedFilter<T[number] | string>[] =>
          filters.reduce<ParsedFilter<T[number] | string>[]>((acc, f, i) => {
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

            // Check static allowlist first, then dynamic patterns
            const isStaticField = allowedFields.includes(field);
            const isDynamicField =
              !isStaticField && options?.dynamicFieldPatterns?.some((pattern) => pattern.test(field));

            if (!isStaticField && !isDynamicField) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Unknown filter field: "${field}". Allowed: ${allowedFields.join(', ')}${options?.dynamicFieldHint ? `, ${options.dynamicFieldHint}` : ''}`,
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

            acc.push({ field: isStaticField ? (field as T[number]) : field, operator: parsed.data, value });
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
  assessmentPid: z.string(),
  username: z.string().nullable(),
  email: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  grade: z.string().nullable(),
  schoolName: z.string().nullable().optional(),
});

export type ReportUserInfo = z.infer<typeof ReportUserInfoSchema>;
