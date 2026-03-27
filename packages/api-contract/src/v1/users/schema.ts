import { z } from 'zod';
import {
  AuthProviderSchema,
  UserTypeSchema,
  UserGradeSchema,
  SchoolLevelSchema,
  FreeReducedLunchStatusSchema,
} from '../common/user';

/**
 * Response schema for GET /users/:userId
 * Returns user profile information
 *
 * Security note: isSuperAdmin is only included when the requesting user is a super admin.
 * Non-super admins will not see this field for security reasons.
 *
 * TODO: Consider scoping PII fields based on the user's permissions
 * ISSUE: https://github.com/yeatmanlab/roar-project-management/issues/1706
 */
export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  assessmentPid: z.string().nullable(),
  authProvider: z.array(AuthProviderSchema),
  nameFirst: z.string().nullable(),
  nameMiddle: z.string().nullable(),
  nameLast: z.string().nullable(),
  username: z.string().nullable(),
  email: z.string().email().nullable(),
  userType: UserTypeSchema,
  dob: z.string().date().nullable(),
  grade: UserGradeSchema.nullable(),
  schoolLevel: SchoolLevelSchema.nullable(),
  statusEll: z.string().nullable(),
  statusFrl: FreeReducedLunchStatusSchema.nullable(),
  statusIep: z.string().nullable(),
  studentId: z.string().nullable(),
  sisId: z.string().nullable(),
  stateId: z.string().nullable(),
  localId: z.string().nullable(),
  gender: z.string().nullable(),
  race: z.string().nullable(),
  hispanicEthnicity: z.boolean().nullable(),
  homeLanguage: z.string().nullable(),
  isSuperAdmin: z.boolean().optional(), // Only visible to super admins
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;
