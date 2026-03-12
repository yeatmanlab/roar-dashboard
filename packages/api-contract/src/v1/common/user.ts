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
  assessmentPid: z.string(),
  nameFirst: z.string().nullable(),
  nameLast: z.string().nullable(),
  username: z.string().nullable(),
  email: z.string().email().nullable(),
});

export const UserSchema = UserBaseSchema.merge(UserDemographicSchema).merge(UserIdentifierSchema);
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

export const EnrolledUsersQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(ENROLLED_USERS_SORT_FIELDS, 'nameLast'),
).extend({
  role: UserRoleSchema.optional(),
  grade: GradeFilterSchema,
});

export type EnrolledUsersQuery = z.infer<typeof EnrolledUsersQuerySchema>;

export const EnrolledUsersResponseSchema = createPaginatedResponseSchema(EnrolledUserSchema);
export type EnrolledUsersResponse = z.infer<typeof EnrolledUsersResponseSchema>;
