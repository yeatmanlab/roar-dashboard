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
 * Base district detail schema (without embedded data).
 */
export const DistrictDetailBaseSchema = z.object({
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

export type DistrictDetailBase = z.infer<typeof DistrictDetailBaseSchema>;

/**
 * Full district detail schema with optional embedded data.
 */
export const DistrictDetailSchema = DistrictDetailBaseSchema.extend({
  counts: DistrictCountsSchema.optional(),
});

export type DistrictDetail = z.infer<typeof DistrictDetailSchema>;

/**
 * Allowed sort fields for district details.
 */
export const DISTRICT_DETAIL_SORT_FIELDS = ['name', 'abbreviation', 'createdAt'] as const;

/**
 * Sort field type for districts.
 */
export type DistrictSortFieldType = (typeof DISTRICT_DETAIL_SORT_FIELDS)[number];

/**
 * Sort field constants for type-safe access.
 */
export const DistrictDetailSortField = {
  NAME: 'name',
  ABBREVIATION: 'abbreviation',
  CREATED_AT: 'createdAt',
} as const satisfies Record<string, (typeof DISTRICT_DETAIL_SORT_FIELDS)[number]>;

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
  createSortQuerySchema(DISTRICT_DETAIL_SORT_FIELDS, 'createdAt'),
)
  .merge(createEmbedQuerySchema(DISTRICT_EMBED_OPTIONS))
  .extend({
    includeEnded: z.boolean().optional(),
  });

export type DistrictsListQuery = z.infer<typeof DistrictsListQuerySchema>;

/**
 * Paginated response for districts list.
 */
export const DistrictsListResponseSchema = createPaginatedResponseSchema(DistrictDetailSchema);

export type DistrictsListResponse = z.infer<typeof DistrictsListResponseSchema>;
