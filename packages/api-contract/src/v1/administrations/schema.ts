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
 * Sort field type for administrations.
 */
export type AdministrationSortFieldType = (typeof ADMINISTRATION_SORT_FIELDS)[number];

/**
 * Sort field constants for type-safe access.
 */
export const AdministrationSortField = {
  CREATED_AT: 'createdAt',
  NAME: 'name',
  DATE_START: 'dateStart',
  DATE_END: 'dateEnd',
} as const satisfies Record<string, AdministrationSortFieldType>;

/**
 * Allowed embed options for administrations.
 */
export const ADMINISTRATION_EMBED_OPTIONS = ['stats', 'tasks'] as const;

/**
 * Embed option type for administrations.
 */
export type AdministrationEmbedOptionType = (typeof ADMINISTRATION_EMBED_OPTIONS)[number];

/**
 * Embed option constants for type-safe access.
 */
export const AdministrationEmbedOption = {
  STATS: 'stats',
  TASKS: 'tasks',
} as const satisfies Record<string, AdministrationEmbedOptionType>;

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

/**
 * GeoJSON Point schema for latitude/longitude coordinates.
 */
export const GeoPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]), // [longitude, latitude]
});

export type GeoPoint = z.infer<typeof GeoPointSchema>;

/**
 * District location schema.
 */
export const DistrictLocationSchema = z.object({
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  stateProvince: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  latLong: GeoPointSchema.nullable(),
});

export type DistrictLocation = z.infer<typeof DistrictLocationSchema>;

/**
 * District schema for administration district assignments.
 */
export const DistrictSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  abbreviation: z.string(),
  location: DistrictLocationSchema,
});

export type District = z.infer<typeof DistrictSchema>;

/**
 * Allowed sort fields for districts.
 */
export const DISTRICT_SORT_FIELDS = ['name'] as const;

/**
 * Sort field type for districts.
 */
export type DistrictSortFieldType = (typeof DISTRICT_SORT_FIELDS)[number];

/**
 * Sort field constants for type-safe access.
 */
export const DistrictSortField = {
  NAME: 'name',
} as const satisfies Record<string, DistrictSortFieldType>;

/**
 * Query parameters for listing administration districts.
 */
export const AdministrationDistrictsListQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(DISTRICT_SORT_FIELDS, 'name'),
);

export type AdministrationDistrictsListQuery = z.infer<typeof AdministrationDistrictsListQuerySchema>;

/**
 * Paginated response for administration districts list.
 */
export const AdministrationDistrictsListResponseSchema = createPaginatedResponseSchema(DistrictSchema);

export type AdministrationDistrictsListResponse = z.infer<typeof AdministrationDistrictsListResponseSchema>;
