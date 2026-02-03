/**
 * Base Fixture for Integration Tests
 *
 * Provides a comprehensive, realistic test dataset that is automatically
 * seeded before each test file via `vitest.setup.ts`. The setup truncates
 * all tables and re-seeds the base fixture per file for isolation.
 *
 * **Test Isolation:**
 * The fixture is seeded once per test file in `beforeAll`. Tests must treat
 * the fixture as **read-only**. To add data for a specific scenario, use
 * factories to create additional entities — they will be cleaned up when
 * the next test file truncates all tables.
 *
 * @example
 * ```typescript
 * import { baseFixture } from '../test-support/fixtures';
 * import { UserFactory } from '../test-support/factories/user.factory';
 * import { UserOrgFactory } from '../test-support/factories/user-org.factory';
 *
 * describe('MyRepository (integration)', () => {
 *   // Use pre-seeded data directly
 *   it('returns administrations for a school-level user', async () => {
 *     const ids = await repo.getAccessibleAdministrationIds(baseFixture.schoolAStudent.id);
 *     expect(ids).toContain(baseFixture.administrationAssignedToDistrict.id);
 *     expect(ids).toContain(baseFixture.administrationAssignedToSchoolA.id);
 *   });
 *
 *   // Append custom data when the base fixture isn't enough
 *   it('handles a user assigned to multiple schools', async () => {
 *     const crossSchoolUser = await UserFactory.create({ nameFirst: 'Cross' });
 *     await UserOrgFactory.create({ userId: crossSchoolUser.id, orgId: baseFixture.schoolA.id });
 *     await UserOrgFactory.create({ userId: crossSchoolUser.id, orgId: baseFixture.schoolB.id });
 *
 *     const ids = await repo.getAccessibleAdministrationIds(crossSchoolUser.id);
 *     expect(ids).toContain(baseFixture.administrationAssignedToSchoolA.id);
 *     expect(ids).toContain(baseFixture.administrationAssignedToSchoolB.id);
 *   });
 * });
 * ```
 */
import type { Org, Class, Group, User, Administration } from '../../db/schema';
import { OrgType } from '../../enums/org-type.enum';
import { UserRole } from '../../enums/user-role.enum';
import { UserType } from '../../enums/user-type.enum';
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
 * - administrationAssignedToDistrict: visible to all users in district hierarchy
 * - administrationAssignedToSchoolA: visible only to users in School A subtree
 * - administrationAssignedToSchoolB: visible only to users in School B subtree
 * - administrationAssignedToClassA: visible only to users in classInSchoolA
 * - administrationAssignedToGroup: visible only to users in the standalone group
 * - administrationAssignedToDistrictB: visible only to users in districtB branch
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
  administrationAssignedToDistrict: Administration;

  /** Administration assigned to School A only */
  administrationAssignedToSchoolA: Administration;

  /** Administration assigned to School B only */
  administrationAssignedToSchoolB: Administration;

  /** Administration assigned to classInSchoolA only */
  administrationAssignedToClassA: Administration;

  /** Administration assigned to standalone group only */
  administrationAssignedToGroup: Administration;

  /** Administration assigned to districtB (visible only to users in districtB branch) */
  administrationAssignedToDistrictB: Administration;
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
 * **Important**: Called automatically by vitest.setup.ts in `beforeAll`.
 * Tests should treat the returned fixture as read-only.
 *
 * @returns The seeded fixture with all entities
 */
export async function seedBaseFixture(): Promise<BaseFixture> {
  // ═══════════════════════════════════════════════════════════════════════════
  // Step 1: Create Org Hierarchy
  // Orgs must be sequential — children depend on parent IDs.
  // ═══════════════════════════════════════════════════════════════════════════

  const district = await OrgFactory.create({
    name: 'Test District',
    orgType: OrgType.DISTRICT,
  });

  const districtB = await OrgFactory.create({
    name: 'Test District B',
    orgType: OrgType.DISTRICT,
  });

  const [schoolA, schoolB, schoolInDistrictB] = await Promise.all([
    OrgFactory.create({ name: 'Test School A', orgType: OrgType.SCHOOL, parentOrgId: district.id }),
    OrgFactory.create({ name: 'Test School B', orgType: OrgType.SCHOOL, parentOrgId: district.id }),
    OrgFactory.create({ name: 'Test School in District B', orgType: OrgType.SCHOOL, parentOrgId: districtB.id }),
  ]);

  const [classInSchoolA, classInSchoolB, classInDistrictB, group] = await Promise.all([
    ClassFactory.create({ name: 'Test Class A', schoolId: schoolA.id, districtId: district.id }),
    ClassFactory.create({ name: 'Test Class B', schoolId: schoolB.id, districtId: district.id }),
    ClassFactory.create({ name: 'Test Class in District B', schoolId: schoolInDistrictB.id, districtId: districtB.id }),
    GroupFactory.create({ name: 'Test Group' }),
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 2: Create Users
  // ═══════════════════════════════════════════════════════════════════════════

  const [
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
  ] = await Promise.all([
    UserFactory.create({ nameFirst: 'District', nameLast: 'Admin', userType: UserType.ADMIN }),
    UserFactory.create({ nameFirst: 'SchoolA', nameLast: 'Admin', userType: UserType.ADMIN }),
    UserFactory.create({ nameFirst: 'SchoolA', nameLast: 'Teacher', userType: UserType.EDUCATOR }),
    UserFactory.create({ nameFirst: 'SchoolA', nameLast: 'Student', userType: UserType.STUDENT }),
    UserFactory.create({ nameFirst: 'SchoolB', nameLast: 'Student', userType: UserType.STUDENT }),
    UserFactory.create({ nameFirst: 'ClassA', nameLast: 'Student', userType: UserType.STUDENT }),
    UserFactory.create({ nameFirst: 'ClassA', nameLast: 'Teacher', userType: UserType.EDUCATOR }),
    UserFactory.create({ nameFirst: 'Group', nameLast: 'Student', userType: UserType.STUDENT }),
    UserFactory.create({ nameFirst: 'Unassigned', nameLast: 'User', userType: UserType.STUDENT }),
    UserFactory.create({ nameFirst: 'Multi', nameLast: 'Assigned', userType: UserType.ADMIN }),
    UserFactory.create({ nameFirst: 'DistrictB', nameLast: 'Student', userType: UserType.STUDENT }),
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 3: Assign Users to Orgs/Classes/Groups
  // ═══════════════════════════════════════════════════════════════════════════

  await Promise.all([
    // Org assignments
    UserOrgFactory.create({ userId: districtAdmin.id, orgId: district.id, role: UserRole.ADMINISTRATOR }),
    UserOrgFactory.create({ userId: schoolAAdmin.id, orgId: schoolA.id, role: UserRole.ADMINISTRATOR }),
    UserOrgFactory.create({ userId: schoolATeacher.id, orgId: schoolA.id, role: UserRole.TEACHER }),
    UserOrgFactory.create({ userId: schoolAStudent.id, orgId: schoolA.id, role: UserRole.STUDENT }),
    UserOrgFactory.create({ userId: schoolBStudent.id, orgId: schoolB.id, role: UserRole.STUDENT }),
    // Class assignments
    UserClassFactory.create({ userId: classAStudent.id, classId: classInSchoolA.id, role: UserRole.STUDENT }),
    UserClassFactory.create({ userId: classATeacher.id, classId: classInSchoolA.id, role: UserRole.TEACHER }),
    // Group assignments
    UserGroupFactory.create({ userId: groupStudent.id, groupId: group.id, role: UserRole.STUDENT }),
    // Multi-assigned user: assigned to both district AND schoolA
    UserOrgFactory.create({ userId: multiAssignedUser.id, orgId: district.id, role: UserRole.ADMINISTRATOR }),
    UserOrgFactory.create({ userId: multiAssignedUser.id, orgId: schoolA.id, role: UserRole.TEACHER }),
    // District B user (for cross-district isolation tests)
    UserOrgFactory.create({ userId: districtBStudent.id, orgId: districtB.id, role: UserRole.STUDENT }),
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 4: Create Administrations
  // ═══════════════════════════════════════════════════════════════════════════

  const [
    administrationAssignedToDistrict,
    administrationAssignedToSchoolA,
    administrationAssignedToSchoolB,
    administrationAssignedToClassA,
    administrationAssignedToGroup,
    administrationAssignedToDistrictB,
  ] = await Promise.all([
    AdministrationFactory.create({ name: 'District Administration', createdBy: districtAdmin.id }),
    AdministrationFactory.create({ name: 'School A Administration', createdBy: schoolAAdmin.id }),
    AdministrationFactory.create({ name: 'School B Administration', createdBy: districtAdmin.id }),
    AdministrationFactory.create({ name: 'Class A Administration', createdBy: classATeacher.id }),
    AdministrationFactory.create({ name: 'Group Administration', createdBy: districtAdmin.id }),
    AdministrationFactory.create({ name: 'District B Administration', createdBy: districtBStudent.id }),
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 5: Assign Administrations to Orgs/Classes/Groups
  // ═══════════════════════════════════════════════════════════════════════════

  await Promise.all([
    AdministrationOrgFactory.create({ administrationId: administrationAssignedToDistrict.id, orgId: district.id }),
    AdministrationOrgFactory.create({ administrationId: administrationAssignedToSchoolA.id, orgId: schoolA.id }),
    AdministrationOrgFactory.create({ administrationId: administrationAssignedToSchoolB.id, orgId: schoolB.id }),
    AdministrationClassFactory.create({
      administrationId: administrationAssignedToClassA.id,
      classId: classInSchoolA.id,
    }),
    AdministrationGroupFactory.create({ administrationId: administrationAssignedToGroup.id, groupId: group.id }),
    AdministrationOrgFactory.create({ administrationId: administrationAssignedToDistrictB.id, orgId: districtB.id }),
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Validate & Return
  // ═══════════════════════════════════════════════════════════════════════════

  const fixture: BaseFixture = {
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
    administrationAssignedToDistrict,
    administrationAssignedToSchoolA,
    administrationAssignedToSchoolB,
    administrationAssignedToClassA,
    administrationAssignedToGroup,
    administrationAssignedToDistrictB,
  };

  const missing = Object.entries(fixture)
    .filter(([, value]) => !value?.id)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Base fixture seeding failed. Missing entities: ${missing.join(', ')}`);
  }

  return fixture;
}
