import { z } from 'zod';
import { UsersResponseSchema } from '../common/user';

export const ClassUsersResponseSchema = z.object({
  classId: z.string().uuid(),
  users: z.array(UsersResponseSchema),
});

export type ClassUsersResponse = z.infer<typeof ClassUsersResponseSchema>;
