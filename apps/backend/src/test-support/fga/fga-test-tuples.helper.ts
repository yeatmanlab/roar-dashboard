/**
 * FGA Test Tuple Helpers
 *
 * Thin wrappers for writing FGA tuples for factory-created data in individual tests.
 * Used when a test creates additional records (beyond baseFixture) that need
 * FGA tuples to pass authorization checks.
 */
import { FgaClient } from '../../clients/fga.client';
import type { UserRole } from '../../enums/user-role.enum';
import {
  administrationDistrictTuple,
  administrationSchoolTuple,
  administrationClassTuple,
  administrationGroupTuple,
  districtMembershipTuple,
  schoolMembershipTuple,
  groupMembershipTuple,
  familyMembershipTuple,
} from '../../services/authorization/helpers/fga-tuples';
import type { UserFamilyRole } from '../../enums/user-family-role.enum';
import { FgaType } from '../../services/authorization/fga-constants';

type EntityType = typeof FgaType.DISTRICT | typeof FgaType.SCHOOL | typeof FgaType.CLASS | typeof FgaType.GROUP;

const administrationTupleBuilders = {
  [FgaType.DISTRICT]: administrationDistrictTuple,
  [FgaType.SCHOOL]: administrationSchoolTuple,
  [FgaType.CLASS]: administrationClassTuple,
  [FgaType.GROUP]: administrationGroupTuple,
} as const;

/**
 * Write an FGA administration assignment tuple for a factory-created administration.
 *
 * @param administrationId - The administration ID
 * @param entityId - The org/class/group ID the administration is assigned to
 * @param entityType - The type of entity ('district', 'school', 'class', 'group')
 */
export async function writeFgaAdministrationAssignment(
  administrationId: string,
  entityId: string,
  entityType: EntityType,
): Promise<void> {
  const client = FgaClient.getClient();
  await client.writeTuples([administrationTupleBuilders[entityType](administrationId, entityId)]);
}

/**
 * Write an FGA org membership tuple for a factory-created user-org enrollment.
 *
 * @param userId - The user ID
 * @param orgId - The org ID
 * @param role - The user's role at this org
 * @param orgType - 'district' or 'school'
 */
export async function writeFgaOrgMembership(
  userId: string,
  orgId: string,
  role: UserRole,
  orgType: typeof FgaType.DISTRICT | typeof FgaType.SCHOOL,
): Promise<void> {
  const client = FgaClient.getClient();
  const builder = orgType === FgaType.DISTRICT ? districtMembershipTuple : schoolMembershipTuple;
  await client.writeTuples([builder(userId, orgId, role, null, null)]);
}

/**
 * Write an FGA group membership tuple for a factory-created user-group enrollment.
 *
 * @param userId - The user ID
 * @param groupId - The group ID
 * @param role - The user's role in this group
 */
export async function writeFgaGroupMembership(userId: string, groupId: string, role: UserRole): Promise<void> {
  const client = FgaClient.getClient();
  await client.writeTuples([groupMembershipTuple(userId, groupId, role, null, null)]);
}

/**
 * Write an FGA family membership tuple for a factory-created user-family enrollment.
 *
 * @param userId - The user ID
 * @param familyId - The family ID
 * @param role - The user's role in the family ('parent' or 'child')
 * @param joinedOn - When the family membership began, or null for unknown
 * @param leftOn - When the family membership ended, or null for indefinite
 */
export async function writeFgaFamilyMembership(
  userId: string,
  familyId: string,
  role: UserFamilyRole,
  joinedOn: Date,
  leftOn: Date | null,
): Promise<void> {
  const client = FgaClient.getClient();
  await client.writeTuples([familyMembershipTuple(userId, familyId, role, joinedOn, leftOn)]);
}
