import { z } from 'zod';
import {
  PaginationQuerySchema,
  createSortQuerySchema,
  createEmbedQuerySchema,
  createPaginatedResponseSchema,
} from '../common/query';

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
 * Administration assessment schema (embedded via ?embed=assessments).
 */
export const AdministrationAssessmentSchema = z.object({
  taskId: z.string().uuid(),
  variantId: z.string().uuid(),
  variantName: z.string().nullable(),
  orderIndex: z.number().int(),
});

export type AdministrationAssessment = z.infer<typeof AdministrationAssessmentSchema>;

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
  assessments: z.array(AdministrationAssessmentSchema).optional(),
});

export type Administration = z.infer<typeof AdministrationSchema>;

/**
 * Allowed sort fields for administrations.
 *
 * @TODO: Check with team whether to rename the DB column from 'nameInternal' to 'name'
 * to avoid needing the mapping in the service layer.
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
export const ADMINISTRATION_EMBED_OPTIONS = ['stats', 'assessments'] as const;

/**
 * Embed option constants for type-safe access.
 */
export const AdministrationEmbedOption = {
  STATS: 'stats',
  ASSESSMENTS: 'assessments',
} as const satisfies Record<string, (typeof ADMINISTRATION_EMBED_OPTIONS)[number]>;

/**
 * Query parameters for listing administrations.
 */
export const AdministrationsListQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(ADMINISTRATION_SORT_FIELDS, 'createdAt'),
).merge(createEmbedQuerySchema(ADMINISTRATION_EMBED_OPTIONS));

export type AdministrationsListQuery = z.infer<typeof AdministrationsListQuerySchema>;

/**
 * Paginated response for administrations list.
 */
export const AdministrationsListResponseSchema = createPaginatedResponseSchema(AdministrationSchema);

export type AdministrationsListResponse = z.infer<typeof AdministrationsListResponseSchema>;
