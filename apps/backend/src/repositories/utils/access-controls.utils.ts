import { z } from 'zod';
import { userRoleEnum } from '../../db/schema/enums';

/**
 * Schema for validating access control filter parameters.
 * Ensures userId is non-empty and allowedRoles has at least one role.
 */
const AccessControlFilterSchema = z.object({
  userId: z.string().min(1, 'userId cannot be empty'),
  allowedRoles: z.array(z.enum(userRoleEnum.enumValues)).min(1, 'allowedRoles cannot be empty'),
});

/**
 * Filter criteria for access control queries.
 */
export type AccessControlFilter = z.infer<typeof AccessControlFilterSchema>;

/**
 * Parses and validates access control filter parameters.
 * Throws ZodError if validation fails.
 */
export function parseAccessControlFilter(params: unknown): AccessControlFilter {
  return AccessControlFilterSchema.parse(params);
}
