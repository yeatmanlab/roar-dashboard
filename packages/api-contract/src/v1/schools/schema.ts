import { z } from 'zod';
import {
  PaginationQuerySchema,
  createSortQuerySchema,
  createEmbedQuerySchema,
  createFilterQuerySchema,
  createPaginatedResponseSchema,
} from '../common/query';
import { ClassTypeSchema, SchoolLevelSchema, UserGradeSchema } from '../common/user';

/**
 * School location schema.
 */
export const SchoolLocationSchema = z.object({
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

export type SchoolLocation = z.infer<typeof SchoolLocationSchema>;

/**
 * School identifiers schema.
 */
export const SchoolIdentifiersSchema = z.object({
  mdrNumber: z.string().optional(),
  ncesId: z.string().optional(),
  stateId: z.string().optional(),
  schoolNumber: z.string().optional(),
});

export type SchoolIdentifiers = z.infer<typeof SchoolIdentifiersSchema>;

/**
 * School counts schema (embedded via ?embed=counts).
 * Note: Schools only count users and classes (not schools like districts do).
 */
export const SchoolCountsSchema = z.object({
  users: z.number().int(),
  classes: z.number().int(),
});

export type SchoolCounts = z.infer<typeof SchoolCountsSchema>;

/**
 * Base school detail schema (without embedded data).
 */
export const SchoolDetailBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  abbreviation: z.string(),
  orgType: z.literal('school'),
  parentOrgId: z.string().uuid().nullable(),
  location: SchoolLocationSchema.optional(),
  identifiers: SchoolIdentifiersSchema.optional(),
  rosteringEnded: z.string().datetime().optional(),
});

export type SchoolDetailBase = z.infer<typeof SchoolDetailBaseSchema>;

/**
 * Full school detail schema with optional embedded data.
 */
export const SchoolDetailSchema = SchoolDetailBaseSchema.extend({
  counts: SchoolCountsSchema.optional(),
});

export type SchoolDetail = z.infer<typeof SchoolDetailSchema>;

/**
 * Allowed sort fields for school details.
 */
export const SCHOOL_DETAIL_SORT_FIELDS = ['name', 'abbreviation'] as const;

/**
 * Sort field type for schools.
 */
export type SchoolSortFieldType = (typeof SCHOOL_DETAIL_SORT_FIELDS)[number];

/**
 * Sort field constants for type-safe access.
 */
export const SchoolDetailSortField = {
  NAME: 'name',
  ABBREVIATION: 'abbreviation',
} as const satisfies Record<string, (typeof SCHOOL_DETAIL_SORT_FIELDS)[number]>;

/**
 * Allowed embed options for schools.
 */
export const SCHOOL_EMBED_OPTIONS = ['counts'] as const;

/**
 * Embed option constants for type-safe access.
 */
export const SchoolEmbedOption = {
  COUNTS: 'counts',
} as const satisfies Record<string, (typeof SCHOOL_EMBED_OPTIONS)[number]>;

/**
 * Query parameters for listing schools.
 */
export const SchoolsListQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(SCHOOL_DETAIL_SORT_FIELDS, 'name'),
)
  .merge(createEmbedQuerySchema(SCHOOL_EMBED_OPTIONS))
  .extend({
    includeEnded: z.coerce.boolean().optional(),
  });

export type SchoolsListQuery = z.infer<typeof SchoolsListQuerySchema>;

/**
 * Paginated response for schools list.
 */
export const SchoolsListResponseSchema = createPaginatedResponseSchema(SchoolDetailSchema);

export type SchoolsListResponse = z.infer<typeof SchoolsListResponseSchema>;

/**
 * Request body for creating a school.
 *
 * `orgType` is fixed to 'school' server-side and is not accepted in the body.
 * `parentOrgId` is set to the supplied `districtId`.
 * `path` is computed from the parent district's `path` by a database trigger.
 * `isRosteringRootOrg` is set to false server-side (the validate_org_hierarchy_fn
 * trigger requires non-root orgs to have isRosteringRootOrg = false).
 *
 * `location.coordinates` is omitted from the request shape — lat/long isn't
 * accepted on create.
 */
export const CreateSchoolRequestSchema = z.object({
  districtId: z.string().uuid(),
  name: z.string().min(1),
  abbreviation: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/, 'abbreviation must contain only letters and digits'),
  location: SchoolLocationSchema.omit({ coordinates: true }).optional(),
  identifiers: SchoolIdentifiersSchema.optional(),
});

export type CreateSchoolRequest = z.infer<typeof CreateSchoolRequestSchema>;

/**
 * Response payload for POST /schools.
 *
 * Returns only the new school id, matching the existing POST /runs and
 * POST /users/:userId/agreements convention. Clients that need the full
 * entity follow up with GET /schools/:schoolId.
 */
export const CreateSchoolResponseSchema = z.object({
  id: z.string().uuid(),
});

export type CreateSchoolResponse = z.infer<typeof CreateSchoolResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────–––––
// School Classes (sub-resource: GET /schools/:schoolId/classes)
// ─────────────────────────────────────────────────────────────────────────–––––

/**
 * Schema for a class within a school listing.
 */
export const SchoolClassSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  schoolId: z.string().uuid(),
  districtId: z.string().uuid(),
  classType: ClassTypeSchema,
  grades: z.array(UserGradeSchema).nullable(),
  courseId: z.string().uuid().nullable(),
  number: z.string().nullable(),
  period: z.string().nullable(),
  subjects: z.array(z.string()).nullable(),
  schoolLevels: z.array(SchoolLevelSchema).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
});

export type SchoolClass = z.infer<typeof SchoolClassSchema>;

/**
 * Allowed sort fields for school classes.
 */
export const SCHOOL_CLASS_SORT_FIELDS = ['name', 'createdAt'] as const;

export type SchoolClassSortFieldType = (typeof SCHOOL_CLASS_SORT_FIELDS)[number];

/**
 * Allowed filter fields for school classes.
 */
export const SCHOOL_CLASS_FILTER_FIELDS = ['grade', 'classType'] as const;

/**
 * Query parameters for listing classes within a school.
 */
export const SchoolClassesListQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(SCHOOL_CLASS_SORT_FIELDS, 'name'),
).merge(createFilterQuerySchema(SCHOOL_CLASS_FILTER_FIELDS));

export type SchoolClassesListQuery = z.infer<typeof SchoolClassesListQuerySchema>;

/**
 * Paginated response for school classes list.
 */
export const SchoolClassesListResponseSchema = createPaginatedResponseSchema(SchoolClassSchema);

export type SchoolClassesListResponse = z.infer<typeof SchoolClassesListResponseSchema>;
