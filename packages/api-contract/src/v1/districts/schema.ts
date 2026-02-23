import { z } from 'zod';
import {
  PaginationQuerySchema,
  createSortQuerySchema,
  createEmbedQuerySchema,
  createPaginatedResponseSchema,
} from '../common/query';
import { AdministrationStatsSchema } from '../administrations';

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
 * Organization schema (for children embed).
 * Represents any child organization (school, department, etc.)
 */
export const OrganizationSchema = z.object({
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

export type Organization = z.infer<typeof OrganizationSchema>;

/**
 * Stats by task schema
 */
export const TaskStatsSchema = z.object({
  taskId: z.string().uuid(),
  taskName: z.string(),
  assigned: z.number().int(),
  started: z.number().int(),
  completed: z.number().int(),
});

/**
 * Full district detail schema with optional embedded data.
 * Supports both counts (for list) and children (for detail) embeds.
 */
export const DistrictDetailSchema = DistrictBaseSchema.extend({
  counts: DistrictCountsSchema.optional(),
  children: z.array(OrganizationSchema).optional(),
});

export type DistrictDetail = z.infer<typeof DistrictDetailSchema>;

/**
 * Allowed sort fields for districts list.
 */
export const DISTRICTS_SORT_FIELDS = ['name', 'abbreviation', 'createdAt'] as const;

/**
 * Sort field type for districts.
 */
export type DistrictSortFieldType = (typeof DISTRICTS_SORT_FIELDS)[number];

/**
 * Sort field constants for type-safe access.
 */
export const DistrictsSortField = {
  NAME: 'name',
  ABBREVIATION: 'abbreviation',
  CREATED_AT: 'createdAt',
} as const satisfies Record<string, (typeof DISTRICTS_SORT_FIELDS)[number]>;

/**
 * Allowed embed options for districts list.
 */
export const DISTRICT_LIST_EMBED_OPTIONS = ['counts'] as const;

/**
 * Allowed embed options for district detail.
 */
export const DISTRICT_DETAIL_EMBED_OPTIONS = ['children'] as const;

/**
 * Embed option constants for type-safe access.
 */
export const DistrictEmbedOption = {
  COUNTS: 'counts',
  CHILDREN: 'children',
} as const;

/**
 * Query parameters for listing districts.
 */
export const DistrictsListQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(DISTRICTS_SORT_FIELDS, 'createdAt'),
)
  .merge(createEmbedQuerySchema(DISTRICT_LIST_EMBED_OPTIONS))
  .extend({
    includeEnded: z.boolean().optional(),
  });

export type DistrictsListQuery = z.infer<typeof DistrictsListQuerySchema>;

/**
 * Paginated response for districts list.
 */
export const DistrictsListResponseSchema = createPaginatedResponseSchema(DistrictDetailSchema);

export type DistrictsListResponse = z.infer<typeof DistrictsListResponseSchema>;

/**
 * Query parameters for getting a single district.
 */
export const DistrictGetQuerySchema = createEmbedQuerySchema(DISTRICT_DETAIL_EMBED_OPTIONS);

export type DistrictGetQuery = z.infer<typeof DistrictGetQuerySchema>;

/**
 * Response for single district.
 */
export const DistrictGetResponseSchema = DistrictDetailSchema;

export type DistrictGetResponse = z.infer<typeof DistrictGetResponseSchema>;

/**
 * Query parameters for getting a single district-level administration statistics object.
 */
export const DistrictAdministrationStatsQuerySchema = z.object({
  taskId: z.string().uuid().optional(),
});

export type DistrictAdministrationStatsQuery = z.infer<typeof DistrictAdministrationStatsQuerySchema>;

/**
 * Response for single district-level administration statistics object.
 */
export const DistrictAdministrationStatsResponseSchema = AdministrationStatsSchema.extend({
  byTask: z.record(z.string().uuid(), TaskStatsSchema),
});

export type DistrictAdministrationStatsResponse = z.infer<typeof DistrictAdministrationStatsResponseSchema>;
