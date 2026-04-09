import type { EnrolledUsersSortFieldType, UserRole, GradeFilter, SortOrder } from '@roar-dashboard/api-contract';
import type { User } from '../db/schema';

// Export types for repo and service usage
export type { EnrolledUsersQuery, EnrolledUsersSortFieldType } from '@roar-dashboard/api-contract';

export interface ListEnrolledUsersOptions {
  page: number;
  perPage: number;
  orderBy?: { field: EnrolledUsersSortFieldType; direction: SortOrder };
  grade?: GradeFilter;
  role?: UserRole;
}
// TODO: Change EnrolledUserEntity to return roles array instead of single role and remove enrollmentStart
export type EnrolledUserEntity = User & { role: UserRole; enrollmentStart: Date };
export type EnrolledOrgUserEntity = User & { roles: UserRole[] };
