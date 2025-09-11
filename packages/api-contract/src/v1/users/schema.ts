import { z } from 'zod';

/**
 * Schema for a user.
 */
export const User = z.object({
  id: z.string().uuid(),
  auth_id: z.string(),
  email: z.string().email().optional(),
  username: z.string().optional(),
});
