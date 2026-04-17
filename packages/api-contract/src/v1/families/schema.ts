import { z } from 'zod';
import { createPaginatedResponseSchema } from '../common/query';
import { UserBaseSchema, EnrolledUsersBaseQuerySchema } from '../common/user';

export const UserFamilyRoleSchema = z.enum(['parent', 'child']);

export type UserFamilyRole = z.infer<typeof UserFamilyRoleSchema>;

export const EnrolledFamilyUserSchema = UserBaseSchema.extend({
  roles: z.array(UserFamilyRoleSchema),
});

export type EnrolledFamilyUser = z.infer<typeof EnrolledFamilyUserSchema>;

export const EnrolledFamilyUsersQuerySchema = EnrolledUsersBaseQuerySchema.extend({
  role: UserFamilyRoleSchema.optional(),
});

export type EnrolledFamilyUsersQuery = z.infer<typeof EnrolledFamilyUsersQuerySchema>;

export const EnrolledFamilyUsersResponseSchema = createPaginatedResponseSchema(EnrolledFamilyUserSchema);
export type EnrolledFamilyUsersResponse = z.infer<typeof EnrolledFamilyUsersResponseSchema>;
