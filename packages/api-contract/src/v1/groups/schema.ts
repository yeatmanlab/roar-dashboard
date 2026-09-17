import { z } from 'zod';
import { PaginationQuerySchema, createSortQuerySchema, createPaginatedResponseSchema } from '../common/query';

/**
 * Invitation Code Schema
 *
 * Represents an invitation code that can be used to join a group.
 */
export const InvitationCodeSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  code: z.string(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().nullable(),
  dates: z.object({
    created: z.string().datetime(),
    updated: z.string().datetime(),
  }),
});

export type InvitationCode = z.infer<typeof InvitationCodeSchema>;

/**
 * Group Type Schema
 *
 * Mirrors the `group_type` Postgres enum values.
 */
export const GroupTypeSchema = z.enum(['cohort', 'community', 'business']);

export type GroupType = z.infer<typeof GroupTypeSchema>;

/**
 * Group location schema. Mirrors the address fields stored on the `groups` table.
 * `coordinates` (lat/long) is intentionally omitted from the create-request shape —
 * the column exists but isn't accepted at create time.
 */
export const GroupLocationSchema = z.object({
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateProvince: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

export type GroupLocation = z.infer<typeof GroupLocationSchema>;

/**
 * Request body for creating a group.
 *
 * Groups are flat (no parent, no ltree path), so there are no derived columns
 * and no parent verification at the service layer — just a super-admin gate
 * and a direct insert.
 */
export const CreateGroupRequestSchema = z
  .object({
    name: z.string().min(1).max(255),
    abbreviation: z
      .string()
      .min(1)
      .max(10)
      .regex(/^[A-Za-z0-9]+$/, 'abbreviation must contain only letters and digits'),
    groupType: GroupTypeSchema,
    location: GroupLocationSchema.optional(),
  })
  .strict();

export type CreateGroupRequest = z.infer<typeof CreateGroupRequestSchema>;

/**
 * Response payload for POST /groups.
 *
 * Returns only the new group id, matching the existing POST /runs and
 * POST /districts / POST /schools / POST /classes convention.
 */
export const CreateGroupResponseSchema = z.object({
  id: z.string().uuid(),
});

export type CreateGroupResponse = z.infer<typeof CreateGroupResponseSchema>;

/**
 * Request body for updating a group (PATCH /groups/:groupId).
 *
 * A partial of the mutable fields of CreateGroupRequestSchema — every field is
 * optional and only those present in the body are applied. `.strict()` rejects
 * unknown keys and the immutable `id`.
 *
 * As on create, `location.coordinates` is omitted — lat/long isn't accepted.
 */
export const UpdateGroupRequestSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    abbreviation: z
      .string()
      .min(1)
      .max(10)
      .regex(/^[A-Za-z0-9]+$/, 'abbreviation must contain only letters and digits')
      .optional(),
    groupType: GroupTypeSchema.optional(),
    location: GroupLocationSchema.optional(),
  })
  .strict();

export type UpdateGroupRequest = z.infer<typeof UpdateGroupRequestSchema>;

/**
 * Response payload for PATCH /groups/:groupId.
 *
 * Returns only the updated group id, matching the create-response shape.
 */
export const UpdateGroupResponseSchema = z.object({
  id: z.string().uuid(),
});

export type UpdateGroupResponse = z.infer<typeof UpdateGroupResponseSchema>;

/**
 * Group detail location schema (read shape).
 *
 * Extends the address fields stored on the `groups` table with the optional
 * `coordinates` (lat/long) that the create-request `GroupLocationSchema`
 * intentionally omits — on read, the persisted `locationLatLong` is surfaced
 * as GeoJSON.
 */
export const GroupDetailLocationSchema = GroupLocationSchema.extend({
  coordinates: z
    .object({
      type: z.literal('Point'),
      coordinates: z.tuple([z.number(), z.number()]), // [longitude, latitude]
    })
    .optional(),
});

export type GroupDetailLocation = z.infer<typeof GroupDetailLocationSchema>;

/**
 * Group detail schema (read shape).
 *
 * Groups are flat, standalone entities — unlike orgs they have no `orgType`,
 * `parentOrgId`, or `isRosteringRootOrg`, and no MDR/NCES identifiers. Each
 * field derives from the `groups` table: scalar columns map directly, `location`
 * is assembled from the address columns plus the point, and nullable columns
 * (e.g. `rosteringEnded`) become optional fields that are omitted when null.
 */
export const GroupDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  abbreviation: z.string(),
  groupType: GroupTypeSchema,
  location: GroupDetailLocationSchema.optional(),
  rosteringEnded: z.string().datetime().optional(),
});

export type GroupDetail = z.infer<typeof GroupDetailSchema>;

/**
 * Allowed sort fields for group details.
 */
export const GROUP_DETAIL_SORT_FIELDS = ['name', 'abbreviation'] as const;

/**
 * Sort field type for groups.
 */
export type GroupSortFieldType = (typeof GROUP_DETAIL_SORT_FIELDS)[number];

/**
 * Sort field constants for type-safe access.
 */
export const GroupDetailSortField = {
  NAME: 'name',
  ABBREVIATION: 'abbreviation',
} as const satisfies Record<string, (typeof GROUP_DETAIL_SORT_FIELDS)[number]>;

/**
 * Query parameters for listing groups.
 *
 * Groups have no sub-entity counts, so there is no `embed` option.
 */
export const GroupsListQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(GROUP_DETAIL_SORT_FIELDS, 'name'),
).extend({
  includeEnded: z.coerce.boolean().optional(),
});

export type GroupsListQuery = z.infer<typeof GroupsListQuerySchema>;

/**
 * Paginated response for groups list.
 */
export const GroupsListResponseSchema = createPaginatedResponseSchema(GroupDetailSchema);

export type GroupsListResponse = z.infer<typeof GroupsListResponseSchema>;
