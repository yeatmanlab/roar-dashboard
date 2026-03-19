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
 * TODO: This may need to be split into separate schemas for different PII permission levels
 */
export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  assessmentPid: z.string().min(1).max(255),
  authProvider: z.array(AuthProviderSchema).nullable(),
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
  isSuperAdmin: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;
