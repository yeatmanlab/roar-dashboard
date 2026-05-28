import type {
  EnrolledUsersSortFieldType,
  UserRole,
  UserFamilyRole,
  GradeFilter,
  SortOrder,
} from '@roar-platform/api-contract';
import type { User } from '../db/schema';

// Export types for repo and service usage
export type {
  EnrolledUser,
  EnrolledFamilyUser,
  EnrolledFamilyUsersQuery,
  EnrolledUsersQuery,
  EnrolledUsersSortFieldType,
} from '@roar-platform/api-contract';

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

export type EnrolledUserEntity = User & { roles: UserRole[] };
export type EnrolledFamilyUserEntity = User & { roles: UserFamilyRole[] };
