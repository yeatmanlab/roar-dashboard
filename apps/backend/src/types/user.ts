import type { EnrolledUsersSortFieldType, UserRole, GradeFilter, SortOrder } from '@roar-dashboard/api-contract';
import type { User } from '../db/schema';

// Export types for repo and service usage
export type { EnrolledUser, EnrolledUsersQuery, EnrolledUsersSortFieldType } from '@roar-dashboard/api-contract';

export interface ListEnrolledUsersOptions {
  page: number;
  perPage: number;
  orderBy?: { field: EnrolledUsersSortFieldType; direction: SortOrder };
  grade?: GradeFilter;
  role?: UserRole;
}
export type EnrolledUserEntity = User & { roles: UserRole[] };
