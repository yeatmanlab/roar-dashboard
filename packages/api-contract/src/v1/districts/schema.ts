import { z } from 'zod';
import {
  PaginationQuerySchema,
  createSortQuerySchema,
  createEmbedQuerySchema,
  createPaginatedResponseSchema,
} from '../common/query';
import { SchoolDetailSchema } from '../schools/schema';

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
  orgType: z.literal('district'),
  parentOrgId: z.string().uuid().nullable(),
  location: DistrictLocationSchema.optional(),
  identifiers: DistrictIdentifiersSchema.optional(),
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
export const DISTRICT_DETAIL_SORT_FIELDS = ['name', 'abbreviation'] as const;

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
  createSortQuerySchema(DISTRICT_DETAIL_SORT_FIELDS, 'name'),
)
  .merge(createEmbedQuerySchema(DISTRICT_EMBED_OPTIONS))
  .extend({
    includeEnded: z.coerce.boolean().optional(),
  });

export type DistrictsListQuery = z.infer<typeof DistrictsListQuerySchema>;

/**
 * Paginated response for districts list.
 */
export const DistrictsListResponseSchema = createPaginatedResponseSchema(DistrictDetailSchema);

export type DistrictsListResponse = z.infer<typeof DistrictsListResponseSchema>;

/**
 * Request body for creating a district.
 *
 * `orgType` is fixed to 'district' server-side and is not accepted in the body.
 * `parentOrgId` is always null for districts.
 * `path` is computed from the generated `id` by a database trigger.
 * `isRosteringRootOrg` is set to true server-side (a database constraint requires
 * root orgs to have isRosteringRootOrg = true).
 *
 * `location.coordinates` is omitted from the request shape — lat/long isn't
 * accepted on create.
 *
 * `identifiers.schoolNumber` is omitted from the request shape — it's a
 * school-level identifier, not a district-level one. The column exists on the
 * shared `orgs` table for schools but is not meaningful for districts.
 */
export const CreateDistrictRequestSchema = z
  .object({
    name: z.string().min(1).max(255),
    abbreviation: z
      .string()
      .min(1)
      .max(10)
      .regex(/^[A-Za-z0-9]+$/, 'abbreviation must contain only letters and digits'),
    location: DistrictLocationSchema.omit({ coordinates: true }).optional(),
    identifiers: DistrictIdentifiersSchema.omit({ schoolNumber: true }).optional(),
  })
  .strict();

export type CreateDistrictRequest = z.infer<typeof CreateDistrictRequestSchema>;

/**
 * Response payload for POST /districts.
 *
 * Returns only the new district id, matching the existing POST /runs and
 * POST /users/:userId/agreements convention. Clients that need the full
 * entity follow up with GET /districts/:id.
 */
export const CreateDistrictResponseSchema = z.object({
  id: z.string().uuid(),
});

export type CreateDistrictResponse = z.infer<typeof CreateDistrictResponseSchema>;

/**
 * Allowed sort fields for schools within a district.
 */
export const DISTRICT_SCHOOL_SORT_FIELDS = ['name', 'abbreviation'] as const;

/**
 * Sort field type for schools within a district.
 */
export type DistrictSchoolSortFieldType = (typeof DISTRICT_SCHOOL_SORT_FIELDS)[number];

/**
 * Sort field constants for type-safe access.
 */
export const DistrictSchoolSortField = {
  NAME: 'name',
  ABBREVIATION: 'abbreviation',
} as const satisfies Record<string, (typeof DISTRICT_SCHOOL_SORT_FIELDS)[number]>;

/**
 * Allowed embed options for schools within a district.
 */
export const DISTRICT_SCHOOL_EMBED_OPTIONS = ['counts'] as const;

/**
 * Embed option constants for type-safe access.
 */
export const DistrictSchoolEmbedOption = {
  COUNTS: 'counts',
} as const satisfies Record<string, (typeof DISTRICT_SCHOOL_EMBED_OPTIONS)[number]>;

/**
 * Query parameters for listing schools in a district.
 */
export const DistrictSchoolsListQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(DISTRICT_SCHOOL_SORT_FIELDS, 'name'),
)
  .merge(createEmbedQuerySchema(DISTRICT_SCHOOL_EMBED_OPTIONS))
  .extend({
    includeEnded: z.coerce.boolean().optional(),
  });

export type DistrictSchoolsListQuery = z.infer<typeof DistrictSchoolsListQuerySchema>;

/**
 * Paginated response for district schools list.
 * Reuses SchoolDetailSchema from the schools contract to keep schemas in sync.
 */
export const DistrictSchoolsListResponseSchema = createPaginatedResponseSchema(SchoolDetailSchema);

export type DistrictSchoolsListResponse = z.infer<typeof DistrictSchoolsListResponseSchema>;
