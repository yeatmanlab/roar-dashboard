import { z } from 'zod';

/**
 * Schema for a user.
 */
export const User = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});
