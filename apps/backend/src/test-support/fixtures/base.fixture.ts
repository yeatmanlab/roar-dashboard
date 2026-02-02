/**
 * Base Fixture for Integration Tests
 *
 * Provides a comprehensive, realistic test dataset that can be seeded once
 * and shared across multiple tests in a file. This approach is optimal for
 * read-heavy tests (like authorization queries) that don't mutate data.
 *
 * @example
 * ```typescript
 * import { seedBaseFixture, type BaseFixture } from '../test-support/fixtures';
 *
 * describe('MyRepository (integration)', () => {
 *   let fixture: BaseFixture;
 *
 *   beforeAll(async () => {
 *     fixture = await seedBaseFixture();
 *   });
 *
 *   it('user in school sees admin at district', async () => {
 *     const results = await repo.query({ userId: fixture.schoolAStudent.id });
 *     expect(results).toContain(fixture.adminAtDistrict.id);
 *   });
 * });
 * ```
 */
import type { Org, Class, Group, User, Administration } from '../../db/schema';
import { OrgType } from '../../enums/org-type.enum';
import { UserRole } from '../../enums/user-role.enum';
import { OrgFactory } from '../factories/org.factory';
import { ClassFactory } from '../factories/class.factory';
import { GroupFactory } from '../factories/group.factory';
import { UserFactory } from '../factories/user.factory';
import { AdministrationFactory } from '../factories/administration.factory';
import { UserOrgFactory } from '../factories/user-org.factory';
import { UserClassFactory } from '../factories/user-class.factory';
import { UserGroupFactory } from '../factories/user-group.factory';
import { AdministrationOrgFactory } from '../factories/administration-org.factory';
import { AdministrationClassFactory } from '../factories/administration-class.factory';
import { AdministrationGroupFactory } from '../factories/administration-group.factory';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Base fixture containing a realistic org hierarchy with users and administrations.
 *
 * Hierarchy structure:
 * ```
 * district (District A)
 * ├── schoolA
 * │   └── classInSchoolA
 * └── schoolB
 *     └── classInSchoolB
 *
 * districtB (District B - separate branch for cross-district isolation tests)
 * └── schoolInDistrictB
 *     └── classInDistrictB
 *
 * group (standalone, no hierarchy)
 * ```
 *
 * User assignments:
 * - districtAdmin: administrator at district level
 * - schoolAAdmin: administrator at School A
 * - schoolATeacher: teacher at School A (org level)
 * - schoolAStudent: student at School A (org level)
 * - schoolBStudent: student at School B (for cross-branch tests)
 * - classAStudent: student in classInSchoolA (class level)
 * - classATeacher: teacher in classInSchoolA (class level)
 * - groupStudent: student in standalone group
 * - unassignedUser: user with no assignments (edge case)
 * - multiAssignedUser: user assigned to both district AND schoolA (deduplication tests)
 * - districtBStudent: student in districtB (for cross-district isolation tests)
 *
 * Administration assignments:
 * - adminAtDistrict: visible to all users in district hierarchy
 * - adminAtSchoolA: visible only to users in School A subtree
 * - adminAtSchoolB: visible only to users in School B subtree
 * - adminAtClassA: visible only to users in classInSchoolA
 * - adminAtGroup: visible only to users in the standalone group
 * - adminAtDistrictB: visible only to users in districtB branch
 */
export interface BaseFixture {
  // ═══════════════════════════════════════════════════════════════════════════
  // ORGANIZATION HIERARCHY
  // ═══════════════════════════════════════════════════════════════════════════

  /** Root district org */
  district: Org;

  /** School A - child of district */
  schoolA: Org;

  /** School B - sibling of School A (for cross-branch tests) */
  schoolB: Org;

  /** Class in School A */
  classInSchoolA: Class;

  /** Class in School B */
  classInSchoolB: Class;

  /** Standalone group (no org hierarchy) */
  group: Group;

  // ─────────────────────────────────────────────────────────────────────────────
  // District B Branch (separate hierarchy for cross-district isolation tests)
  // ─────────────────────────────────────────────────────────────────────────────

  /** District B - separate root district (sibling to district, for isolation tests) */
  districtB: Org;

  /** School in District B */
  schoolInDistrictB: Org;

  /** Class in School in District B */
  classInDistrictB: Class;

  // ═══════════════════════════════════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Administrator at district level */
  districtAdmin: User;

  /** Administrator at School A */
  schoolAAdmin: User;

  /** Teacher at School A (org assignment) */
  schoolATeacher: User;

  /** Student at School A (org assignment) */
  schoolAStudent: User;

  /** Student at School B (for cross-branch tests) */
  schoolBStudent: User;

  /** Student in classInSchoolA (class assignment) */
  classAStudent: User;

  /** Teacher in classInSchoolA (class assignment) */
  classATeacher: User;

  /** Student in standalone group */
  groupStudent: User;

  /** User with no assignments (edge case) */
  unassignedUser: User;

  /** User assigned to multiple orgs - district AND schoolA (deduplication tests) */
  multiAssignedUser: User;

  /** Student in districtB (for cross-district isolation tests) */
  districtBStudent: User;

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMINISTRATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Administration assigned to district (visible to all in hierarchy) */
  adminAtDistrict: Administration;

  /** Administration assigned to School A only */
  adminAtSchoolA: Administration;

  /** Administration assigned to School B only */
  adminAtSchoolB: Administration;

  /** Administration assigned to classInSchoolA only */
  adminAtClassA: Administration;

  /** Administration assigned to standalone group only */
  adminAtGroup: Administration;

  /** Administration assigned to districtB (visible only to users in districtB branch) */
  adminAtDistrictB: Administration;
}

// ═══════════════════════════════════════════════════════════════════════════
// Seeding Function
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Seeds a comprehensive base fixture for integration tests.
 *
 * Creates a realistic org hierarchy with users at various levels and
 * administrations assigned at different points. Designed to cover all
 * common authorization scenarios.
 *
 * **Important**: This function should be called once per test file in
 * `beforeAll`. Tests should treat the fixture as read-only.
 *
 * @returns The seeded fixture with all entities
 */
export async function seedBaseFixture(): Promise<BaseFixture> {
  // ═══════════════════════════════════════════════════════════════════════════
  // Step 1: Create Org Hierarchy
  // ═══════════════════════════════════════════════════════════════════════════

  const district = await OrgFactory.create({
    name: 'Test District',
    orgType: OrgType.DISTRICT,
  });

  const schoolA = await OrgFactory.create({
    name: 'Test School A',
    orgType: OrgType.SCHOOL,
    parentOrgId: district.id,
  });

  const schoolB = await OrgFactory.create({
    name: 'Test School B',
    orgType: OrgType.SCHOOL,
    parentOrgId: district.id,
  });

  const classInSchoolA = await ClassFactory.create({
    name: 'Test Class A',
    schoolId: schoolA.id,
    districtId: district.id,
  });

  const classInSchoolB = await ClassFactory.create({
    name: 'Test Class B',
    schoolId: schoolB.id,
    districtId: district.id,
  });

  const group = await GroupFactory.create({
    name: 'Test Group',
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // District B Branch (separate hierarchy for cross-district isolation tests)
  // ─────────────────────────────────────────────────────────────────────────────

  const districtB = await OrgFactory.create({
    name: 'Test District B',
    orgType: OrgType.DISTRICT,
  });

  const schoolInDistrictB = await OrgFactory.create({
    name: 'Test School in District B',
    orgType: OrgType.SCHOOL,
    parentOrgId: districtB.id,
  });

  const classInDistrictB = await ClassFactory.create({
    name: 'Test Class in District B',
    schoolId: schoolInDistrictB.id,
    districtId: districtB.id,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 2: Create Users
  // ═══════════════════════════════════════════════════════════════════════════

  const districtAdmin = await UserFactory.create({ nameFirst: 'District', nameLast: 'Admin' });
  const schoolAAdmin = await UserFactory.create({ nameFirst: 'SchoolA', nameLast: 'Admin' });
  const schoolATeacher = await UserFactory.create({ nameFirst: 'SchoolA', nameLast: 'Teacher' });
  const schoolAStudent = await UserFactory.create({ nameFirst: 'SchoolA', nameLast: 'Student' });
  const schoolBStudent = await UserFactory.create({ nameFirst: 'SchoolB', nameLast: 'Student' });
  const classAStudent = await UserFactory.create({ nameFirst: 'ClassA', nameLast: 'Student' });
  const classATeacher = await UserFactory.create({ nameFirst: 'ClassA', nameLast: 'Teacher' });
  const groupStudent = await UserFactory.create({ nameFirst: 'Group', nameLast: 'Student' });
  const unassignedUser = await UserFactory.create({ nameFirst: 'Unassigned', nameLast: 'User' });
  const multiAssignedUser = await UserFactory.create({ nameFirst: 'Multi', nameLast: 'Assigned' });
  const districtBStudent = await UserFactory.create({ nameFirst: 'DistrictB', nameLast: 'Student' });

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 3: Assign Users to Orgs/Classes/Groups
  // ═══════════════════════════════════════════════════════════════════════════

  // Org assignments
  await UserOrgFactory.create({ userId: districtAdmin.id, orgId: district.id, role: UserRole.ADMINISTRATOR });
  await UserOrgFactory.create({ userId: schoolAAdmin.id, orgId: schoolA.id, role: UserRole.ADMINISTRATOR });
  await UserOrgFactory.create({ userId: schoolATeacher.id, orgId: schoolA.id, role: UserRole.TEACHER });
  await UserOrgFactory.create({ userId: schoolAStudent.id, orgId: schoolA.id, role: UserRole.STUDENT });
  await UserOrgFactory.create({ userId: schoolBStudent.id, orgId: schoolB.id, role: UserRole.STUDENT });

  // Class assignments
  await UserClassFactory.create({ userId: classAStudent.id, classId: classInSchoolA.id, role: UserRole.STUDENT });
  await UserClassFactory.create({ userId: classATeacher.id, classId: classInSchoolA.id, role: UserRole.TEACHER });

  // Group assignments
  await UserGroupFactory.create({ userId: groupStudent.id, groupId: group.id, role: UserRole.STUDENT });

  // Multi-assigned user: assigned to both district AND schoolA
  await UserOrgFactory.create({ userId: multiAssignedUser.id, orgId: district.id, role: UserRole.ADMINISTRATOR });
  await UserOrgFactory.create({ userId: multiAssignedUser.id, orgId: schoolA.id, role: UserRole.TEACHER });

  // District B user (for cross-district isolation tests)
  await UserOrgFactory.create({ userId: districtBStudent.id, orgId: districtB.id, role: UserRole.STUDENT });

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 4: Create Administrations
  // ═══════════════════════════════════════════════════════════════════════════

  const adminAtDistrict = await AdministrationFactory.create({
    name: 'District Administration',
    createdBy: districtAdmin.id,
  });

  const adminAtSchoolA = await AdministrationFactory.create({
    name: 'School A Administration',
    createdBy: schoolAAdmin.id,
  });

  const adminAtSchoolB = await AdministrationFactory.create({
    name: 'School B Administration',
    createdBy: districtAdmin.id, // District admin creates for school B
  });

  const adminAtClassA = await AdministrationFactory.create({
    name: 'Class A Administration',
    createdBy: classATeacher.id,
  });

  const adminAtGroup = await AdministrationFactory.create({
    name: 'Group Administration',
    createdBy: districtAdmin.id,
  });

  const adminAtDistrictB = await AdministrationFactory.create({
    name: 'District B Administration',
    createdBy: districtBStudent.id, // District B student creates (for simplicity)
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 5: Assign Administrations to Orgs/Classes/Groups
  // ═══════════════════════════════════════════════════════════════════════════

  await AdministrationOrgFactory.create({ administrationId: adminAtDistrict.id, orgId: district.id });
  await AdministrationOrgFactory.create({ administrationId: adminAtSchoolA.id, orgId: schoolA.id });
  await AdministrationOrgFactory.create({ administrationId: adminAtSchoolB.id, orgId: schoolB.id });
  await AdministrationClassFactory.create({ administrationId: adminAtClassA.id, classId: classInSchoolA.id });
  await AdministrationGroupFactory.create({ administrationId: adminAtGroup.id, groupId: group.id });
  await AdministrationOrgFactory.create({ administrationId: adminAtDistrictB.id, orgId: districtB.id });

  // ═══════════════════════════════════════════════════════════════════════════
  // Return Complete Fixture
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // Orgs (District A branch)
    district,
    schoolA,
    schoolB,
    classInSchoolA,
    classInSchoolB,
    group,

    // Orgs (District B branch - for cross-district isolation tests)
    districtB,
    schoolInDistrictB,
    classInDistrictB,

    // Users
    districtAdmin,
    schoolAAdmin,
    schoolATeacher,
    schoolAStudent,
    schoolBStudent,
    classAStudent,
    classATeacher,
    groupStudent,
    unassignedUser,
    multiAssignedUser,
    districtBStudent,

    // Administrations
    adminAtDistrict,
    adminAtSchoolA,
    adminAtSchoolB,
    adminAtClassA,
    adminAtGroup,
    adminAtDistrictB,
  };
}
