import { z } from 'zod';

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
export const CreateGroupRequestSchema = z.object({
  name: z.string().min(1),
  abbreviation: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/, 'abbreviation must contain only letters and digits'),
  groupType: GroupTypeSchema,
  location: GroupLocationSchema.optional(),
});

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
