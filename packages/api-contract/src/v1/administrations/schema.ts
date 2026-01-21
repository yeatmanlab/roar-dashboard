import { z } from 'zod';
import {
  PaginationQuerySchema,
  createSortQuerySchema,
  createEmbedQuerySchema,
  createPaginatedResponseSchema,
} from '../common/query';

/**
 * Administration status values for filtering.
 * - active: dateStart <= now <= dateEnd
 * - past: dateEnd < now
 * - upcoming: dateStart > now
 */
export const ADMINISTRATION_STATUS_VALUES = ['active', 'past', 'upcoming'] as const;

/**
 * Schema for administration status filter.
 */
export const AdministrationStatusSchema = z.enum(ADMINISTRATION_STATUS_VALUES);

export type AdministrationStatus = z.infer<typeof AdministrationStatusSchema>;

/**
 * Administration dates schema.
 */
export const AdministrationDatesSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  created: z.string().datetime(),
});

export type AdministrationDates = z.infer<typeof AdministrationDatesSchema>;

/**
 * Administration stats schema (embedded via ?embed=stats).
 */
export const AdministrationStatsSchema = z.object({
  assigned: z.number().int(),
  started: z.number().int(),
  completed: z.number().int(),
});

export type AdministrationStats = z.infer<typeof AdministrationStatsSchema>;

/**
 * Administration task schema (embedded via ?embed=tasks).
 */
export const AdministrationTaskSchema = z.object({
  taskId: z.string().uuid(),
  taskName: z.string(),
  variantId: z.string().uuid(),
  variantName: z.string().nullable(),
  orderIndex: z.number().int(),
});

export type AdministrationTask = z.infer<typeof AdministrationTaskSchema>;

/**
 * Base administration schema (without embedded data).
 */
export const AdministrationBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  publicName: z.string(),
  dates: AdministrationDatesSchema,
  isOrdered: z.boolean(),
});

export type AdministrationBase = z.infer<typeof AdministrationBaseSchema>;

/**
 * Full administration schema with optional embedded data.
 */
export const AdministrationSchema = AdministrationBaseSchema.extend({
  stats: AdministrationStatsSchema.optional(),
  tasks: z.array(AdministrationTaskSchema).optional(),
});

export type Administration = z.infer<typeof AdministrationSchema>;

/**
 * Allowed sort fields for administrations.
 */
export const ADMINISTRATION_SORT_FIELDS = ['createdAt', 'name', 'dateStart', 'dateEnd'] as const;

/**
 * Sort field constants for type-safe access.
 */
export const AdministrationSortField = {
  CREATED_AT: 'createdAt',
  NAME: 'name',
  DATE_START: 'dateStart',
  DATE_END: 'dateEnd',
} as const satisfies Record<string, (typeof ADMINISTRATION_SORT_FIELDS)[number]>;

/**
 * Allowed embed options for administrations.
 */
export const ADMINISTRATION_EMBED_OPTIONS = ['stats', 'tasks'] as const;

/**
 * Embed option constants for type-safe access.
 */
export const AdministrationEmbedOption = {
  STATS: 'stats',
  TASKS: 'tasks',
} as const satisfies Record<string, (typeof ADMINISTRATION_EMBED_OPTIONS)[number]>;

/**
 * Query parameters for listing administrations.
 */
export const AdministrationsListQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(ADMINISTRATION_SORT_FIELDS, 'createdAt'),
)
  .merge(createEmbedQuerySchema(ADMINISTRATION_EMBED_OPTIONS))
  .extend({
    status: AdministrationStatusSchema.optional(),
  });

export type AdministrationsListQuery = z.infer<typeof AdministrationsListQuerySchema>;

/**
 * Paginated response for administrations list.
 */
export const AdministrationsListResponseSchema = createPaginatedResponseSchema(AdministrationSchema);

export type AdministrationsListResponse = z.infer<typeof AdministrationsListResponseSchema>;
