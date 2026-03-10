import { z } from 'zod';
import { PaginationQuerySchema, createPaginatedResponseSchema, createSortQuerySchema } from './query';

export const UserRoleSchema = z.enum([
  'administrator',
  'aide',
  'counselor',
  'district_administrator',
  'guardian',
  'parent',
  'principal',
  'proctor',
  'relative',
  'site_administrator',
  'student',
  'system_administrator',
  'teacher',
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserAuthProviderSchema = z.array(
  z.enum(['password', 'google', 'oidc.clever', 'oidc.classlink', 'oidc.nycps']),
);
export type UserAuthProvider = z.infer<typeof UserAuthProviderSchema>;

export const UserStatusFrlSchema = z.enum(['Free', 'Reduced', 'Paid']);
export type UserStatusFrl = z.infer<typeof UserStatusFrlSchema>;

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
export type UserGrade = z.infer<typeof UserGradeSchema>;

export const USER_SCHOOL_LEVEL_VALUES = ['early_childhood', 'elementary', 'middle', 'high', 'postsecondary'] as const;
export const UserSchoolLevelSchema = z.enum(USER_SCHOOL_LEVEL_VALUES);

const UserDemographicSchema = z.object({
  gender: z.string().nullable(),
  grade: UserGradeSchema.nullable(),
  dob: z.string().datetime().nullable(),
});

const UserIdentiferSchema = z.object({
  studentId: z.string().nullable(),
  sisId: z.string().nullable(),
  stateId: z.string().nullable(),
  localId: z.string().nullable(),
});

export const UserBaseSchema = z.object({
  id: z.string().uuid(),
  assessmentPid: z.string(),
  nameFirst: z.string().nullable(),
  nameLast: z.string().nullable(),
  username: z.string().nullable(),
  email: z.string().email().nullable(),
});

export const UserSchema = UserBaseSchema.merge(UserDemographicSchema).merge(UserIdentiferSchema);
export const EnrolledUserSchema = UserSchema.extend({
  role: UserRoleSchema,
  enrollmentStart: z.string().datetime(),
});
export type EnrolledUser = z.infer<typeof EnrolledUserSchema>;

export const ENROLLED_USERS_SORT_FIELDS = ['nameLast', 'username', 'grade'] as const;
export type EnrolledUsersSortFieldType = (typeof ENROLLED_USERS_SORT_FIELDS)[number];

export const GradeFilterSchema = z
  .string()
  .trim()
  .transform((v) => v.split(',').map((g) => g.trim()))
  .pipe(z.array(UserGradeSchema))
  .optional();

export const EnrolledUsersQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(ENROLLED_USERS_SORT_FIELDS, 'nameLast'),
).extend({
  role: UserRoleSchema.optional(),
  grade: z.string().optional(),
});

export type EnrolledUsersQuery = z.infer<typeof EnrolledUsersQuerySchema>;

export const EnrolledUsersResponseSchema = createPaginatedResponseSchema(EnrolledUserSchema);
export type EnrolledUsersResponse = z.infer<typeof EnrolledUsersResponseSchema>;
