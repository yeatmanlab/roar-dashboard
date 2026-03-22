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
 */
export const createDynamicSortQuerySchema = <T extends readonly [string, ...string[]]>(
  sortFields: T,
  defaultField: T[number],
  defaultOrder: SortOrder = 'desc',
  dynamicFieldPatterns: RegExp[] = [],
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
          message: `Unknown sort field: "${val}". Allowed: ${sortFields.join(', ')}, progress.<taskId>.status`,
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
