import { z } from 'zod';
import { PaginationQuerySchema, createPaginatedResponseSchema, createSortQuerySchema } from './query';

export const UserRoleSchema = z.enum([
  'administrator',
  'aide',
  'counselor',
  'district_administrator',
  'guardian',
  'parent',
  'platform_admin',
  'principal',
  'proctor',
  'relative',
  'site_administrator',
  'student',
  'system_administrator',
  'teacher',
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserGradeSchema = z.enum([
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  'PreKindergarten',
  'TransitionalKindergarten',
  'Kindergarten',
  'InfantToddler',
  'Preschool',
  'PostGraduate',
  'Ungraded',
  'Other',
  '',
]);

/**
 * Schema for the authentication provider of a user
 */
export const AuthProviderSchema = z.enum(['password', 'google', 'oidc.clever', 'oidc.classlink', 'oidc.nycps']);

/**
 * Schema for user type
 */
export const UserTypeSchema = z.enum(['student', 'educator', 'caregiver', 'admin']);

export type UserGrade = z.infer<typeof UserGradeSchema>;

const UserDemographicSchema = z.object({
  gender: z.string().nullable(),
  grade: UserGradeSchema.nullable(),
  dob: z.string().date().nullable(),
});

const UserIdentifierSchema = z.object({
  studentId: z.string().nullable(),
  sisId: z.string().nullable(),
  stateId: z.string().nullable(),
  localId: z.string().nullable(),
});

export const UserBaseSchema = z.object({
  id: z.string().uuid(),
  assessmentPid: z.string().nullable(),
  nameFirst: z.string().nullable(),
  nameLast: z.string().nullable(),
  username: z.string().nullable(),
  email: z.string().email().nullable(),
});

export const UserSchema = UserBaseSchema.merge(UserDemographicSchema).merge(UserIdentifierSchema);

export const EnrolledUserSchema = UserSchema.extend({
  roles: z.array(UserRoleSchema),
});
export type EnrolledUser = z.infer<typeof EnrolledUserSchema>;

export const ENROLLED_USERS_SORT_FIELDS = ['nameLast', 'username', 'grade'] as const;
export type EnrolledUsersSortFieldType = (typeof ENROLLED_USERS_SORT_FIELDS)[number];

export const GradeFilterSchema = z
  .string()
  .trim()
  .transform((v) => v.split(',').map((g) => g.trim()))
  .superRefine((v, ctx) => {
    if (v.some((grade) => !UserGradeSchema.safeParse(grade).success)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid grade value',
      });
    }
  })
  .pipe(z.array(UserGradeSchema))
  .optional();

export type GradeFilter = z.infer<typeof GradeFilterSchema>;

export const EnrolledUsersBaseQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(ENROLLED_USERS_SORT_FIELDS, 'nameLast'),
).extend({
  grade: GradeFilterSchema,
});

export const EnrolledUsersQuerySchema = EnrolledUsersBaseQuerySchema.extend({
  role: UserRoleSchema.optional(),
});

export type EnrolledUsersQuery = z.infer<typeof EnrolledUsersQuerySchema>;

export const EnrolledUsersResponseSchema = createPaginatedResponseSchema(EnrolledUserSchema);
export type EnrolledUsersResponse = z.infer<typeof EnrolledUsersResponseSchema>;

/**
 * Schema for school levels
 */
export const SchoolLevelSchema = z.enum(['early_childhood', 'elementary', 'middle', 'high', 'postsecondary']);

/**
 * Schema for class types following the OneRoster specification.
 */
export const ClassTypeSchema = z.enum(['homeroom', 'scheduled', 'other']);

/**
 * Schema for free/reduced lunch status
 */
export const FreeReducedLunchStatusSchema = z.enum(['Free', 'Reduced', 'Paid']);

// Export types for individual schemas
export type AuthProvider = z.infer<typeof AuthProviderSchema>;
export type UserType = z.infer<typeof UserTypeSchema>;
export type Grade = z.infer<typeof UserGradeSchema>;
export type SchoolLevel = z.infer<typeof SchoolLevelSchema>;
export type ClassType = z.infer<typeof ClassTypeSchema>;
export type FreeReducedLunchStatus = z.infer<typeof FreeReducedLunchStatusSchema>;
