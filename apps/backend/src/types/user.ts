import type {
  EnrolledUsersSortFieldType,
  UserRole,
  UserFamilyRole,
  GradeFilter,
  SortOrder,
} from '@roar-dashboard/api-contract';
import type { User } from '../db/schema';

// Export types for repo and service usage
export type {
  EnrolledUser
  EnrolledFamilyUsersQuery,
  EnrolledUsersQuery,
  EnrolledUsersSortFieldType,
} from '@roar-dashboard/api-contract';

interface BaseListEnrolledUsersOptions {
  page: number;
  perPage: number;
  orderBy?: { field: EnrolledUsersSortFieldType; direction: SortOrder };
  grade?: GradeFilter;
}

export interface ListEnrolledUsersOptions extends BaseListEnrolledUsersOptions {
  role?: UserRole;
}

export interface ListEnrolledFamilyUsersOptions extends BaseListEnrolledUsersOptions {
  role?: UserFamilyRole;
}

// TODO: Change EnrolledUserEntity to return roles array instead of single role and remove enrollmentStart
// ISSUE: https://github.com/yeatmanlab/roar-project-management/issues/1734
export type EnrolledUserEntity = User & { role: UserRole; enrollmentStart: Date };
export type EnrolledFamilyUserEntity = User & { roles: UserFamilyRole[] };
