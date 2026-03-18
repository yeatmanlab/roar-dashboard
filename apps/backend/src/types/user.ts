import type { EnrolledUsersSortFieldType, UserRole, GradeFilter, SortOrder } from '@roar-dashboard/api-contract';
import type { User } from '../db/schema';

export interface ListEnrolledUsersOptions {
  page: number;
  perPage: number;
  orderBy?: { field: EnrolledUsersSortFieldType; direction: SortOrder };
  grade?: GradeFilter;
  role?: UserRole;
}

export type EnrolledUserEntity = User & { role: UserRole; enrollmentStart: Date };
