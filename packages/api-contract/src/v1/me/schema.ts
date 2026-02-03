import { z } from 'zod';

/**
 * User type enum values matching the database enum.
 */
export const UserTypeSchema = z.enum(['student', 'educator', 'caregiver', 'admin', 'super_admin']);

/**
 * Schema for the authenticated user's profile returned by /me endpoint.
 */
export const MeSchema = z.object({
  id: z.string().uuid(),
  userType: UserTypeSchema,
  nameFirst: z.string().nullable(),
  nameLast: z.string().nullable(),
});

export type Me = z.infer<typeof MeSchema>;
export type UserType = z.infer<typeof UserTypeSchema>;
