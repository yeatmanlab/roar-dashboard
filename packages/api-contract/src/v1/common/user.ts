import { z } from 'zod';
import { PaginationQuerySchema, createPaginatedResponseSchema, createSortQuerySchema } from './query';
import { UserTypeSchema } from '../me/schema';

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
]);
export type UserGrade = z.infer<typeof UserGradeSchema>;

export const USER_SCHOOL_LEVEL_VALUES = ['early_childhood', 'elementary', 'middle', 'high', 'postsecondary'] as const;
export const UserSchoolLevelSchema = z.enum(USER_SCHOOL_LEVEL_VALUES);

// Extracted out for clarity (PII), based on run demographics table
const UserDemographicSchema = z.object({
  statusEll: z.string().nullable(),
  statusFrl: UserStatusFrlSchema.nullable(),
  statusIep: z.string().nullable(),
  gender: z.string().nullable(),
  race: z.array(z.string()).nullable(),
  hispanicEthnicity: z.boolean().nullable(),
  homeLanguage: z.string().nullable(),
  grade: UserGradeSchema.nullable(),
  schoolLevel: UserSchoolLevelSchema.nullable(),
  dob: z.string().datetime().nullable(),
});

const UserIdentiferSchema = z.object({
  studentId: z.string().nullable(),
  sisId: z.string().nullable(),
  stateId: z.string().nullable(),
  localId: z.string().nullable(),
})

export const UserBaseSchema = z.object({
  id: z.string().uuid(),
  assessmentPid: z.string(),
  authProvider: UserAuthProviderSchema,
  authId: z.string().nullable(),
  nameFirst: z.string().nullable(),
  nameLast: z.string().nullable(),
  username: z.string().nullable(),
  email: z.string().email().nullable(),
  userType: UserTypeSchema,
});

export const UserSchema = UserBaseSchema.merge(UserDemographicSchema).merge(UserIdentiferSchema);

// TODO: which fields to sort?
export const USERS_SORT_FIELDS = ['name.last', 'username', 'grade', 'enrollmentStart'] as const;
export type UserSortField = (typeof USERS_SORT_FIELDS)[number];
export const UsersSortFields = {
  NAME_LAST: 'name.last',
  USERNAME: 'username',
  GRADE: 'grade',
  ENROLLMENT_START: 'enrollmentStart',
} as const satisfies Record<string, UserSortField>;

const UserQueryFilterSchema = z.object({
  active: z.boolean().optional(),
  role: UserRoleSchema.optional(),
  userType: UserTypeSchema.optional(),
  grade: UserGradeSchema.optional(),
});

export type UserQueryFilters = z.infer<typeof UserQueryFilterSchema>;

export const UsersQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(USERS_SORT_FIELDS, 'name.last'),
).merge(UserQueryFilterSchema);

export type UsersQuery = z.infer<typeof UsersQuerySchema>;

export const UsersResponseSchema = createPaginatedResponseSchema(UserSchema);
export type UsersResponse = z.infer<typeof UsersResponseSchema>;
