import { z } from 'zod';
import { UsersResponseSchema } from '../common/user';

export const ClassUsersResponseSchema = UsersResponseSchema.extend({
  classId: z.string().uuid(),
});

export type ClassUsersResponse = z.infer<typeof ClassUsersResponseSchema>;
