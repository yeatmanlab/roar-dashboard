import { z } from 'zod';
import { UsersListResponseSchema } from '../common/user';

export const ClassUsersResponseSchema = z.object({
  classId: z.string().uuid(),
  users: z.array(UsersListResponseSchema),
});

export type ClassUsersResponse = z.infer<typeof ClassUsersResponseSchema>;
