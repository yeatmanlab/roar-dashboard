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
import type { Org, Class, Group, User, Administration, Task, TaskVariant } from '../../db/schema';
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
import { TaskFactory } from '../factories/task.factory';
import { TaskVariantFactory } from '../factories/task-variant.factory';
import { AdministrationTaskVariantFactory } from '../factories/administration-task-variant.factory';

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
 * - districtBAdmin: administrator at districtB (for cross-district isolation tests)
 * - districtBStudent: student in districtB (for cross-district isolation tests)
 *
 * Enrollment boundary test users:
 * - expiredEnrollmentStudent: student at School A with expired enrollment (enrollment date tests)
 * - futureEnrollmentStudent: student at School A with future enrollment (enrollment date tests)
 * - expiredClassStudent: student in classInSchoolA with expired enrollment (enrollment date tests)
 * - futureGroupStudent: student in group with future enrollment (enrollment date tests)
 *
 * Demographic test users (for task variant eligibility filtering):
 * - grade5Student: grade 5 student in district (sees variantForGrade5 and variantForAllGrades)
 * - grade3Student: grade 3 student in district (sees variantForGrade3 and variantForAllGrades)
 * - grade5EllStudent: grade 5 ELL student in district (variantOptionalForEll is optional for them)
 *
 * Tasks and Task Variants (assigned to administrationAssignedToDistrict):
 * - task: base task for testing
 * - variantForAllGrades: no conditions (assigned to all students)
 * - variantForGrade5: assigned only to grade 5 students
 * - variantForGrade3: assigned only to grade 3 students
 * - variantOptionalForEll: optional for ELL students
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

  /** Administrator at districtB (for cross-district isolation tests) */
  districtBAdmin: User;

  /** Student in districtB (for cross-district isolation tests) */
  districtBStudent: User;

  // ─────────────────────────────────────────────────────────────────────────────
  // Enrollment Boundary Test Users
  // ─────────────────────────────────────────────────────────────────────────────

  /** Student at School A with expired enrollment (enrollmentEnd in the past) */
  expiredEnrollmentStudent: User;

  /** Student at School A with future enrollment (enrollmentStart in the future) */
  futureEnrollmentStudent: User;

  /** Student in classInSchoolA with expired enrollment */
  expiredClassStudent: User;

  /** Student in group with future enrollment */
  futureGroupStudent: User;

  // ─────────────────────────────────────────────────────────────────────────────
  // Demographic Test Users (for task variant eligibility filtering)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Grade 5 student in district (sees variantForGrade5 and variantForAllGrades) */
  grade5Student: User;

  /** Grade 3 student in district (sees variantForGrade3 and variantForAllGrades) */
  grade3Student: User;

  /** Grade 5 ELL student in district (variantOptionalForEll is optional for them) */
  grade5EllStudent: User;

  // ═══════════════════════════════════════════════════════════════════════════
  // TASKS & TASK VARIANTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Base task for testing task variant endpoints */
  task: Task;

  /** Variant assigned to all grades (no conditions) - orderIndex: 0 */
  variantForAllGrades: TaskVariant;

  /** Variant assigned only to grade 5 students - orderIndex: 1 */
  variantForGrade5: TaskVariant;

  /** Variant assigned only to grade 3 students - orderIndex: 2 */
  variantForGrade3: TaskVariant;

  /** Variant that is optional for ELL students - orderIndex: 3 */
  variantOptionalForEll: TaskVariant;

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
    districtBAdmin,
    districtBStudent,
    // Enrollment boundary test users
    expiredEnrollmentStudent,
    futureEnrollmentStudent,
    expiredClassStudent,
    futureGroupStudent,
    // Demographic test users
    grade5Student,
    grade3Student,
    grade5EllStudent,
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
    UserFactory.create({ nameFirst: 'DistrictB', nameLast: 'Admin', userType: UserType.ADMIN }),
    UserFactory.create({ nameFirst: 'DistrictB', nameLast: 'Student', userType: UserType.STUDENT }),
    // Enrollment boundary test users
    UserFactory.create({ nameFirst: 'Expired', nameLast: 'OrgStudent', userType: UserType.STUDENT }),
    UserFactory.create({ nameFirst: 'Future', nameLast: 'OrgStudent', userType: UserType.STUDENT }),
    UserFactory.create({ nameFirst: 'Expired', nameLast: 'ClassStudent', userType: UserType.STUDENT }),
    UserFactory.create({ nameFirst: 'Future', nameLast: 'GroupStudent', userType: UserType.STUDENT }),
    // Demographic test users (for task variant eligibility filtering)
    UserFactory.create({ nameFirst: 'Grade5', nameLast: 'Student', userType: UserType.STUDENT, grade: '5' }),
    UserFactory.create({ nameFirst: 'Grade3', nameLast: 'Student', userType: UserType.STUDENT, grade: '3' }),
    UserFactory.create({
      nameFirst: 'Grade5Ell',
      nameLast: 'Student',
      userType: UserType.STUDENT,
      grade: '5',
      statusEll: 'active',
    }),
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 3: Assign Users to Orgs/Classes/Groups
  // ═══════════════════════════════════════════════════════════════════════════

  // Enrollment date helpers
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await Promise.all([
    // Org assignments (active enrollments - default enrollmentStart=now, enrollmentEnd=null)
    UserOrgFactory.create({ userId: districtAdmin.id, orgId: district.id, role: UserRole.ADMINISTRATOR }),
    UserOrgFactory.create({ userId: schoolAAdmin.id, orgId: schoolA.id, role: UserRole.ADMINISTRATOR }),
    UserOrgFactory.create({ userId: schoolATeacher.id, orgId: schoolA.id, role: UserRole.TEACHER }),
    UserOrgFactory.create({ userId: schoolAStudent.id, orgId: schoolA.id, role: UserRole.STUDENT }),
    UserOrgFactory.create({ userId: schoolBStudent.id, orgId: schoolB.id, role: UserRole.STUDENT }),
    // Class assignments (active enrollments)
    UserClassFactory.create({ userId: classAStudent.id, classId: classInSchoolA.id, role: UserRole.STUDENT }),
    UserClassFactory.create({ userId: classATeacher.id, classId: classInSchoolA.id, role: UserRole.TEACHER }),
    // Group assignments (active enrollments)
    UserGroupFactory.create({ userId: groupStudent.id, groupId: group.id, role: UserRole.STUDENT }),
    // Multi-assigned user: assigned to both district AND schoolA
    UserOrgFactory.create({ userId: multiAssignedUser.id, orgId: district.id, role: UserRole.ADMINISTRATOR }),
    UserOrgFactory.create({ userId: multiAssignedUser.id, orgId: schoolA.id, role: UserRole.TEACHER }),
    // District B users (for cross-district isolation tests)
    UserOrgFactory.create({ userId: districtBAdmin.id, orgId: districtB.id, role: UserRole.ADMINISTRATOR }),
    UserOrgFactory.create({ userId: districtBStudent.id, orgId: districtB.id, role: UserRole.STUDENT }),

    // ─────────────────────────────────────────────────────────────────────────────
    // Enrollment boundary test users
    // ─────────────────────────────────────────────────────────────────────────────

    // Expired org enrollment: started 30 days ago, ended 7 days ago
    UserOrgFactory.create({
      userId: expiredEnrollmentStudent.id,
      orgId: schoolA.id,
      role: UserRole.STUDENT,
      enrollmentStart: thirtyDaysAgo,
      enrollmentEnd: sevenDaysAgo,
    }),
    // Future org enrollment: starts 7 days from now
    UserOrgFactory.create({
      userId: futureEnrollmentStudent.id,
      orgId: schoolA.id,
      role: UserRole.STUDENT,
      enrollmentStart: sevenDaysFromNow,
      enrollmentEnd: thirtyDaysFromNow,
    }),
    // Expired class enrollment: started 30 days ago, ended 7 days ago
    UserClassFactory.create({
      userId: expiredClassStudent.id,
      classId: classInSchoolA.id,
      role: UserRole.STUDENT,
      enrollmentStart: thirtyDaysAgo,
      enrollmentEnd: sevenDaysAgo,
    }),
    // Future group enrollment: starts 7 days from now
    UserGroupFactory.create({
      userId: futureGroupStudent.id,
      groupId: group.id,
      role: UserRole.STUDENT,
      enrollmentStart: sevenDaysFromNow,
      enrollmentEnd: thirtyDaysFromNow,
    }),

    // ─────────────────────────────────────────────────────────────────────────────
    // Demographic test users (for task variant eligibility filtering)
    // ─────────────────────────────────────────────────────────────────────────────

    UserOrgFactory.create({ userId: grade5Student.id, orgId: district.id, role: UserRole.STUDENT }),
    UserOrgFactory.create({ userId: grade3Student.id, orgId: district.id, role: UserRole.STUDENT }),
    UserOrgFactory.create({ userId: grade5EllStudent.id, orgId: district.id, role: UserRole.STUDENT }),
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
    AdministrationFactory.create({ name: 'District B Administration', createdBy: districtBAdmin.id }),
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
  // Step 6: Create Tasks & Task Variants
  // ═══════════════════════════════════════════════════════════════════════════

  const task = await TaskFactory.create({ name: 'Base Fixture Task' });

  const [variantForAllGrades, variantForGrade5, variantForGrade3, variantOptionalForEll] = await Promise.all([
    TaskVariantFactory.create({ taskId: task.id, name: 'Variant For All Grades' }),
    TaskVariantFactory.create({ taskId: task.id, name: 'Variant For Grade 5' }),
    TaskVariantFactory.create({ taskId: task.id, name: 'Variant For Grade 3' }),
    TaskVariantFactory.create({ taskId: task.id, name: 'Variant Optional For ELL' }),
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 7: Assign Task Variants to District Administration
  // ═══════════════════════════════════════════════════════════════════════════

  await Promise.all([
    // No conditions - assigned to all students
    AdministrationTaskVariantFactory.create({
      administrationId: administrationAssignedToDistrict.id,
      taskVariantId: variantForAllGrades.id,
      orderIndex: 0,
    }),
    // assigned_if: grade 5 only
    AdministrationTaskVariantFactory.create({
      administrationId: administrationAssignedToDistrict.id,
      taskVariantId: variantForGrade5.id,
      orderIndex: 1,
      conditionsAssignment: { field: 'studentData.grade', op: 'EQUAL', value: 5 },
    }),
    // assigned_if: grade 3 only
    AdministrationTaskVariantFactory.create({
      administrationId: administrationAssignedToDistrict.id,
      taskVariantId: variantForGrade3.id,
      orderIndex: 2,
      conditionsAssignment: { field: 'studentData.grade', op: 'EQUAL', value: 3 },
    }),
    // optional_if: ELL students (assigned to all, optional for ELL)
    AdministrationTaskVariantFactory.create({
      administrationId: administrationAssignedToDistrict.id,
      taskVariantId: variantOptionalForEll.id,
      orderIndex: 3,
      conditionsRequirements: { field: 'studentData.statusEll', op: 'EQUAL', value: 'active' },
    }),
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
    districtBAdmin,
    districtBStudent,

    // Enrollment boundary test users
    expiredEnrollmentStudent,
    futureEnrollmentStudent,
    expiredClassStudent,
    futureGroupStudent,

    // Demographic test users
    grade5Student,
    grade3Student,
    grade5EllStudent,

    // Tasks & Task Variants
    task,
    variantForAllGrades,
    variantForGrade5,
    variantForGrade3,
    variantOptionalForEll,

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
