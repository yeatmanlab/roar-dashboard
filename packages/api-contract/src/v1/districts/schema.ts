import { z } from 'zod';
import {
  PaginationQuerySchema,
  createSortQuerySchema,
  createEmbedQuerySchema,
  createPaginatedResponseSchema,
} from '../common/query';

/**
 * District location schema.
 */
export const DistrictLocationSchema = z.object({
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateProvince: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  coordinates: z
    .object({
      type: z.literal('Point'),
      coordinates: z.tuple([z.number(), z.number()]), // [longitude, latitude]
    })
    .optional(),
});

export type DistrictLocation = z.infer<typeof DistrictLocationSchema>;

/**
 * District identifiers schema.
 */
export const DistrictIdentifiersSchema = z.object({
  mdrNumber: z.string().optional(),
  ncesId: z.string().optional(),
  stateId: z.string().optional(),
  schoolNumber: z.string().optional(),
});

export type DistrictIdentifiers = z.infer<typeof DistrictIdentifiersSchema>;

/**
 * District dates schema.
 */
export const DistrictDatesSchema = z.object({
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export type DistrictDates = z.infer<typeof DistrictDatesSchema>;

/**
 * District counts schema (embedded via ?embed=counts).
 */
export const DistrictCountsSchema = z.object({
  users: z.number().int(),
  schools: z.number().int(),
  classes: z.number().int(),
});

export type DistrictCounts = z.infer<typeof DistrictCountsSchema>;

/**
 * Base district schema (without embedded data).
 */
export const DistrictBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  abbreviation: z.string(),
  orgType: z.string(),
  parentOrgId: z.string().uuid().nullable(),
  location: DistrictLocationSchema.optional(),
  identifiers: DistrictIdentifiersSchema.optional(),
  dates: DistrictDatesSchema,
  isRosteringRootOrg: z.boolean(),
  rosteringEnded: z.string().datetime().optional(),
});

export type DistrictBase = z.infer<typeof DistrictBaseSchema>;

/**
 * Full district schema with optional embedded data.
 */
export const DistrictSchema = DistrictBaseSchema.extend({
  counts: DistrictCountsSchema.optional(),
});

export type District = z.infer<typeof DistrictSchema>;

/**
 * Allowed sort fields for districts.
 */
export const DISTRICT_SORT_FIELDS = ['name', 'abbreviation', 'createdAt'] as const;

/**
 * Sort field constants for type-safe access.
 */
export const DistrictSortField = {
  NAME: 'name',
  ABBREVIATION: 'abbreviation',
  CREATED_AT: 'createdAt',
} as const satisfies Record<string, (typeof DISTRICT_SORT_FIELDS)[number]>;

/**
 * Allowed embed options for districts.
 */
export const DISTRICT_EMBED_OPTIONS = ['counts'] as const;

/**
 * Embed option constants for type-safe access.
 */
export const DistrictEmbedOption = {
  COUNTS: 'counts',
} as const satisfies Record<string, (typeof DISTRICT_EMBED_OPTIONS)[number]>;

/**
 * Query parameters for listing districts.
 */
export const DistrictsListQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(DISTRICT_SORT_FIELDS, 'createdAt'),
)
  .merge(createEmbedQuerySchema(DISTRICT_EMBED_OPTIONS))
  .extend({
    includeEnded: z.boolean().optional(),
  });

export type DistrictsListQuery = z.infer<typeof DistrictsListQuerySchema>;

/**
 * Paginated response for districts list.
 */
export const DistrictsListResponseSchema = createPaginatedResponseSchema(DistrictSchema);

export type DistrictsListResponse = z.infer<typeof DistrictsListResponseSchema>;
