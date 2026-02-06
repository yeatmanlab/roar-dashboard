import { z } from 'zod';
import { PaginationQuerySchema, createPaginatedResponseSchema, createSortQuerySchema } from './query';
import { MeSchema, UserTypeSchema } from '../me/schema';

export const USER_ROLE_VALUES = [
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
] as const;
export const UserRoleSchema = z.enum(USER_ROLE_VALUES);

export const USER_AUTH_PROVIDER_VALUES = ['password', 'google', 'oidc.clever', 'oidc.classlink', 'oidc.nycps'] as const;
export const UserAuthProviderSchema = z.array(z.enum(USER_AUTH_PROVIDER_VALUES));

export const USER_STATUS_FRL_VALUES = ['Free', 'Reduced', 'Paid'] as const;
export const UserStatusFrlSchema = z.enum(USER_STATUS_FRL_VALUES);

export const USER_GRADE_VALUES = [
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
] as const;
export const UserGradeSchema = z.enum(USER_GRADE_VALUES);

export const USER_SCHOOL_LEVEL_VALUES = ['early_childhood', 'elementary', 'middle', 'high', 'postsecondary'] as const;
export const UserSchoolLevelSchema = z.enum(USER_SCHOOL_LEVEL_VALUES);

// Extracted out for clarity (PII), based on run demographics table
export const UserDemographicSchema = z.object({
  statusEll: z.string().nullable(),
  statusFrl: UserStatusFrlSchema.nullable(),
  statusIep: z.string().nullable(),
  gender: z.string().nullable(),
  race: z.array(z.string()).nullable(),
  hispanicEthnicity: z.boolean().nullable(),
  homeLanguage: z.string().nullable(),
  grade: UserGradeSchema.nullable(),
  schoolLevel: UserSchoolLevelSchema.nullable(),
});

// TODO: should this include nameMiddle?
export const UserBaseSchema = z.object({
  id: z.string().uuid(),
  assessmentPid: z.string(),
  authProvider: UserAuthProviderSchema,
  authId: z.string().nullable(), // TODO: there's a todo about whether this is nullable on drawSQL
  username: z.string().nullable(),
  email: z.string().email().nullable(),
  dob: z.string().datetime().nullable(),
  studentId: z.string().nullable(),
  sisId: z.string().nullable(),
  stateId: z.string().nullable(),
  localId: z.string().nullable(),
});

export const UserSchema = UserBaseSchema.merge(MeSchema) // Includes id, nameFirst, nameLast, and userType
  .merge(UserDemographicSchema);

// TODO: which fields to sort?
export const USERS_SORT_FIELDS = ['name.last', 'username', 'grade', 'enrollmentStart'] as const;
export const UsersSortFields = {
  NAME_LAST: 'name.last',
  USERNAME: 'username',
  GRADE: 'grade',
  ENROLLMENT_START: 'enrollmentStart',
} as const satisfies Record<string, (typeof USERS_SORT_FIELDS)[number]>;

export const UsersQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(USERS_SORT_FIELDS, 'name.last'),
).extend({
  active: z.boolean().default(true),
  role: UserRoleSchema.optional(),
  userType: UserTypeSchema.optional(),
  grade: UserGradeSchema.optional(),
});

export type UsersQuery = z.infer<typeof UsersQuerySchema>;

export const UsersResponseSchema = createPaginatedResponseSchema(UserSchema);
export type UsersResponse = z.infer<typeof UsersResponseSchema>;
