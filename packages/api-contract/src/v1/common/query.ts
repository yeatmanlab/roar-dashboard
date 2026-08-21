import { z } from 'zod';

/**
 * Schema for pagination query parameters.
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Schema for search query parameter.
 */
export const SearchQuerySchema = z.object({
  search: z.string().optional(),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

/**
 * Sort order enum.
 */
export const SortOrderSchema = z.enum(['asc', 'desc']).default('desc');

export type SortOrder = z.infer<typeof SortOrderSchema>;

/**
 * Sort order constants for type-safe access.
 */
export const SortOrder = {
  ASC: 'asc',
  DESC: 'desc',
} as const satisfies Record<string, SortOrder>;

/**
 * Creates a sort query schema with a specific set of allowed sort fields.
 * @param sortFields - The allowed sort field values
 * @param defaultField - The default sort field
 * @param defaultOrder - The default sort order (defaults to 'desc')
 */
export const createSortQuerySchema = <T extends readonly [string, ...string[]]>(
  sortFields: T,
  defaultField: T[number],
  defaultOrder: SortOrder = 'desc',
) =>
  z.object({
    sortBy: z.enum(sortFields).default(defaultField),
    sortOrder: SortOrderSchema.default(defaultOrder),
  });

/**
 * Creates a sort query schema that accepts both static enum fields and
 * dynamic pattern-matched fields (e.g., `progress.<uuid>.status`).
 *
 * Dynamic fields pass through as `string` — the service layer validates
 * them against actual data (e.g., administration task IDs).
 *
 * @param sortFields - The allowed static sort field values
 * @param defaultField - The default sort field (must be a static field)
 * @param defaultOrder - The default sort order (defaults to 'desc')
 * @param dynamicFieldPatterns - Regex patterns for dynamic field names
 * @param dynamicFieldHint - Human-readable description of accepted dynamic fields for error messages
 */
export const createDynamicSortQuerySchema = <T extends readonly [string, ...string[]]>(
  sortFields: T,
  defaultField: T[number],
  defaultOrder: SortOrder = 'desc',
  dynamicFieldPatterns: RegExp[] = [],
  dynamicFieldHint?: string,
) =>
  z.object({
    sortBy: z
      .string()
      .default(defaultField)
      .refine(
        (val) => {
          if ((sortFields as readonly string[]).includes(val)) return true;
          return dynamicFieldPatterns.some((pattern) => pattern.test(val));
        },
        (val) => ({
          message: `Unknown sort field: "${val}". Allowed: ${sortFields.join(', ')}${dynamicFieldHint ? `, ${dynamicFieldHint}` : ''}`,
        }),
      ),
    sortOrder: SortOrderSchema.default(defaultOrder),
  });

// Template schema to extract sort query structure
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used only for type derivation
const _sortQueryTemplate = createSortQuerySchema(['_'] as const, '_');
type SortQueryShape = z.infer<typeof _sortQueryTemplate>;

/**
 * Generic sort query type derived from createSortQuerySchema.
 * @typeParam T - The allowed sort field values
 */
export type SortQuery<T extends string = string> = Omit<SortQueryShape, 'sortBy'> & { sortBy: T };

/**
 * Schema for embed query parameter.
 */
export const createEmbedQuerySchema = <T extends readonly [string, ...string[]]>(allowedEmbeds: T) =>
  z.object({
    embed: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return [];
        return val.split(',').filter((v) => allowedEmbeds.includes(v as T[number])) as T[number][];
      }),
  });

/**
 * Schema for pagination metadata in responses.
 */
export const PaginationMetaSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  totalItems: z.number().int(),
  totalPages: z.number().int(),
});

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

/**
 * Base paginated result returned by repositories/services.
 * Contains items and total count for pagination calculation.
 */
export interface PaginatedResult<T> {
  items: T[];
  totalItems: number;
}

/**
 * Creates a paginated response schema for a given item schema.
 * @param itemSchema - The Zod schema for individual items in the list
 */
export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: PaginationMetaSchema,
  });

/**
 * Filter operator for filter expressions.
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
