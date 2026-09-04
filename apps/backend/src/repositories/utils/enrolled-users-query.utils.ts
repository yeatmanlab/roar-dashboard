import { SQL, inArray, eq, Column } from 'drizzle-orm';
import type { EnrolledUsersSortFieldType } from '@roar-platform/api-contract';
import { users, userClasses, userGroups, userOrgs, userFamilies } from '../../db/schema';
import { isActiveRoster } from './enrollment.utils';
import type {
  EnrolledUserBase,
  EnrolledUserDemographicsEntity,
  ListEnrolledUsersOptions,
  ListEnrolledFamilyUsersOptions,
} from '../../types/user';

export const ENROLLED_USERS_SORT_COLUMNS: Record<EnrolledUsersSortFieldType, Column> = {
  nameLast: users.nameLast,
  username: users.username,
  grade: users.grade,
};

/**
 * The base `users` columns every enrolled-user list query selects. Defined once
 * here so all four org repositories (district, school, class, group) share the
 * exact same lean column set instead of each spelling out `select({ user: users })`,
 * which would always fetch every column — including demographic PII.
 */
const ENROLLED_USER_BASE_COLUMNS = {
  id: users.id,
  assessmentPid: users.assessmentPid,
  nameFirst: users.nameFirst,
  nameLast: users.nameLast,
  username: users.username,
  email: users.email,
  gender: users.gender,
  grade: users.grade,
  dob: users.dob,
  studentId: users.studentId,
  sisId: users.sisId,
  stateId: users.stateId,
  localId: users.localId,
} as const satisfies Record<keyof EnrolledUserBase, Column>;

/**
 * The demographic `users` columns selected only when the `demographics` embed
 * is requested. Kept separate from the base columns so the default list query
 * never fetches student PII (race, ethnicity, ELL/IEP/FRL status, home language).
 * Field names mirror the contract's `EnrolledUserDemographics` shape.
 */
const ENROLLED_USER_DEMOGRAPHIC_COLUMNS = {
  userType: users.userType,
  statusEll: users.statusEll,
  statusFrl: users.statusFrl,
  statusIep: users.statusIep,
  race: users.race,
  hispanicEthnicity: users.hispanicEthnicity,
  homeLanguage: users.homeLanguage,
} as const satisfies Record<keyof EnrolledUserDemographicsEntity, Column>;

/**
 * Builds the Drizzle column selection for an enrolled-user data query.
 *
 * Always includes the lean base columns under `user`. When `embedDemographics`
 * is true, it additionally selects the demographic columns under `demographics`
 * — so the SQL only ever fetches PII columns when the caller explicitly opts in
 * via `?embed=demographics`. The caller is responsible for adding the role
 * aggregation (`roles`) to the returned object before running the query.
 *
 * @param embedDemographics - Whether to include the demographic columns
 * @returns A column-selection object for `db.select(...)`
 */
export const buildEnrolledUserSelection = (embedDemographics: boolean) => ({
  user: ENROLLED_USER_BASE_COLUMNS,
  ...(embedDemographics && { demographics: ENROLLED_USER_DEMOGRAPHIC_COLUMNS }),
});

/**
 * Assembles an `EnrolledUserEntity`-shaped object from a data-query row and its
 * resolved roles. Attaches `demographics` only when the row carries it (i.e.
 * the demographics embed was selected), keeping the field absent otherwise so
 * the controller transform can omit it from the lean response.
 *
 * @param row - A row from a query built with `buildEnrolledUserSelection`
 * @param roles - The resolved roles for the user
 * @returns The mapped enrolled-user entity
 */
export const mapEnrolledUserRow = <TRole>(
  row: { user: EnrolledUserBase; demographics?: EnrolledUserDemographicsEntity },
  roles: TRole[],
): EnrolledUserBase & { roles: TRole[]; demographics?: EnrolledUserDemographicsEntity } => ({
  ...row.user,
  roles,
  ...(row.demographics && { demographics: row.demographics }),
});

export enum UserJunctionTable {
  USER_GROUPS = 'userGroups',
  USER_CLASSES = 'userClasses',
  USER_ORGS = 'userOrgs',
  USER_FAMILIES = 'userFamilies',
}

/** Map of junction table types to their corresponding table schemas */
const TABLE_MAP = {
  [UserJunctionTable.USER_GROUPS]: userGroups,
  [UserJunctionTable.USER_CLASSES]: userClasses,
  [UserJunctionTable.USER_ORGS]: userOrgs,
  [UserJunctionTable.USER_FAMILIES]: userFamilies,
} as const;

export const getEnrolledUsersFilterConditions = (
  options: ListEnrolledUsersOptions | ListEnrolledFamilyUsersOptions,
  junctionTable: UserJunctionTable,
): SQL[] => {
  const { grade, role } = options;
  const conditions: SQL[] = [];

  // Always exclude rostering-ended users (#1742). Applied at the query
  // composition layer so every consumer of `getEnrolledUsersFilterConditions`
  // — district, school, class, group, family user-list endpoints — gets
  // the same hard boundary. There is no opt-in flag to include them.
  conditions.push(isActiveRoster(users));

  if (grade?.length) {
    conditions.push(inArray(users.grade, grade));
  }

  if (role) {
    conditions.push(eq(TABLE_MAP[junctionTable].role, role));
  }

  return conditions;
};
