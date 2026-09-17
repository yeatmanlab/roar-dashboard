import type { EnrolledUsersSortFieldType, SortOrder } from '@roar-platform/api-contract';
import type { User } from '../db/schema';
import type { Grade } from '../enums/grade.enum';
import type { UserRole } from '../enums/user-role.enum';
import type { UserFamilyRole } from '../enums/user-family-role.enum';

/*
 * Transport query shapes, re-exported for the service layer's enrolled-user endpoints.
 * These are the last api-contract types this module hands out — everything else below is
 * backend-owned. Removing them belongs to the service-layer decoupling work, not here.
 */
/* eslint-disable no-restricted-imports */
export type { EnrolledFamilyUsersQuery, EnrolledUsersQuery } from '@roar-platform/api-contract';
/* eslint-enable no-restricted-imports */

export type { EnrolledUsersSortFieldType } from '@roar-platform/api-contract';

interface BaseListEnrolledUsersOptions {
  page: number;
  perPage: number;
  orderBy?: { field: EnrolledUsersSortFieldType; direction: SortOrder };
  /** Grades to filter on. The contract parses `?grade=1,2,3` into this array. */
  grade?: Grade[] | undefined;
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
 * The `users` columns holding demographic PII, attached to an enrolled-user entity when
 * the `demographics` embed is resolved.
 *
 * Derived from the schema rather than mirroring the contract's `EnrolledUserDemographics`,
 * so this type and the column map in `buildEnrolledUserSelection` are pinned to the same
 * source. `userType` is `.notNull()` in the DB; every other column is nullable.
 */
export type EnrolledUserDemographicsColumn =
  | 'userType'
  | 'statusEll'
  | 'statusFrl'
  | 'statusIep'
  | 'race'
  | 'hispanicEthnicity'
  | 'homeLanguage';

export type EnrolledUserDemographicsEntity = Pick<User, EnrolledUserDemographicsColumn>;

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

/**
 * A single active entity membership of a user, enriched for the memberships read
 * endpoint: each row carries the member's `role`, and class rows carry the parent
 * `schoolId` / `districtId` (a student has no school-level row of their own — their
 * school is the parent of their class).
 */
export type UserMembershipDetail =
  | { entityType: 'district' | 'school' | 'group'; entityId: string; role: UserRole }
  | { entityType: 'class'; entityId: string; role: UserRole; schoolId?: string; districtId?: string }
  | { entityType: 'family'; entityId: string; role: UserFamilyRole };
