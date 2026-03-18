import { z } from 'zod';
import {
  PaginationQuerySchema,
  createSortQuerySchema,
  createEmbedQuerySchema,
  createPaginatedResponseSchema,
} from '../common/query';

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
  orgType: z.string(),
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
