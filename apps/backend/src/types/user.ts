import type {
  EnrolledUserDemographics,
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
  EnrolledUserDemographics,
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
  /**
   * When true, the repository additionally selects the demographic columns
   * (userType, statusEll/Frl/Iep, race, hispanicEthnicity, homeLanguage) and
   * attaches them as `demographics` on each returned entity. Defaults to false
   * so the base list query stays lean — see `?embed=demographics`.
   */
  embedDemographics?: boolean;
}

export interface ListEnrolledFamilyUsersOptions extends BaseListEnrolledUsersOptions {
  role?: UserFamilyRole;
}

/**
 * The demographic data attached to an enrolled-user entity when the
 * `demographics` embed is resolved. Mirrors the contract's
 * `EnrolledUserDemographics` shape.
 */
export type EnrolledUserDemographicsEntity = EnrolledUserDemographics;

/**
 * The base `users` columns the enrolled-user list always selects and the
 * controller transform always reads. The demographic columns are deliberately
 * NOT part of this set — they're fetched only when `?embed=demographics` is
 * requested (see `ListEnrolledUsersOptions.embedDemographics` and
 * `buildEnrolledUserSelection`). Keeping the type honest about which columns
 * the default query fetches prevents the demographic PII from being read
 * unintentionally.
 */
export type EnrolledUserBaseColumn =
  | 'id'
  | 'assessmentPid'
  | 'nameFirst'
  | 'nameLast'
  | 'username'
  | 'email'
  | 'gender'
  | 'grade'
  | 'dob'
  | 'studentId'
  | 'sisId'
  | 'stateId'
  | 'localId';

export type EnrolledUserBase = Pick<User, EnrolledUserBaseColumn>;

export type EnrolledUserEntity = EnrolledUserBase & {
  roles: UserRole[];
  // Populated only when the demographics embed is requested; absent otherwise.
  demographics?: EnrolledUserDemographicsEntity;
};
export type EnrolledFamilyUserEntity = User & { roles: UserFamilyRole[] };
