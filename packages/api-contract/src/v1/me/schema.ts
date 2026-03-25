import { z } from 'zod';
import { UserTypeSchema } from '../common/user';

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
