/**
 * Deterministic dev fixture for local development and Cypress e2e.
 *
 * Unlike `baseFixture` (which generates random UUIDs per boot), this fixture
 * uses hardcoded UUIDs with group prefixes so entity types are identifiable
 * by sight:
 *
 * - `1xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` — organizations
 * - `2xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` — users
 * - `3xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` — administrations
 * - `4xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` — tasks and variants
 * - `5xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` — groups, classes
 * - `6xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` — agreements
 *
 * Consumed by the seed script (`seeds/index.ts`), not by the integration
 * test suite. Integration tests use `baseFixture` with random IDs.
 */
import type { BaseFixture } from '../src/test-support/fixtures/base.fixture';
import { OrgType } from '../src/enums/org-type.enum';
import { UserRole } from '../src/enums/user-role.enum';
import { UserType } from '../src/enums/user-type.enum';
import { SCORE_TYPE, SCORE_DOMAIN, SCORE_NAME, ASSESSMENT_STAGE } from '../src/constants/run-scores';
import { OrgFactory } from '../src/test-support/factories/org.factory';
import { ClassFactory } from '../src/test-support/factories/class.factory';
import { GroupFactory } from '../src/test-support/factories/group.factory';
import { UserFactory } from '../src/test-support/factories/user.factory';
import { AdministrationFactory } from '../src/test-support/factories/administration.factory';
import { UserOrgFactory } from '../src/test-support/factories/user-org.factory';
import { UserClassFactory } from '../src/test-support/factories/user-class.factory';
import { UserGroupFactory } from '../src/test-support/factories/user-group.factory';
import { AdministrationOrgFactory } from '../src/test-support/factories/administration-org.factory';
import { AdministrationClassFactory } from '../src/test-support/factories/administration-class.factory';
import { AdministrationGroupFactory } from '../src/test-support/factories/administration-group.factory';
import { TaskFactory } from '../src/test-support/factories/task.factory';
import { TaskVariantFactory } from '../src/test-support/factories/task-variant.factory';
import { AdministrationTaskVariantFactory } from '../src/test-support/factories/administration-task-variant.factory';
import { AgreementFactory } from '../src/test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../src/test-support/factories/agreement-version.factory';
import { AdministrationAgreementFactory } from '../src/test-support/factories/administration-agreement.factory';
import { RunFactory } from '../src/test-support/factories/run.factory';
import { RunScoreFactory } from '../src/test-support/factories/run-score.factory';
import { AssessmentDbClient } from '../src/db/clients';
import { runTrials } from '../src/db/schema/assessment';
import { logger } from '../src/logger';

// ═══════════════════════════════════════════════════════════════════════════
// Deterministic IDs
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hardcoded UUIDs for all dev fixture entities. The first hex digit of each
 * UUID encodes the entity type, making it easy to spot what kind of entity
 * a UUID refers to in logs, browser dev tools, and Cypress output.
 */
export const DEV_IDS = {
  // ── Organizations (1xxx) ──────────────────────────────────────────────
  district: '10000000-0000-4000-a000-000000000001',
  districtB: '10000000-0000-4000-a000-000000000002',
  schoolA: '10000000-0000-4000-a000-000000000011',
  schoolB: '10000000-0000-4000-a000-000000000012',
  schoolC: '10000000-0000-4000-a000-000000000013',
  schoolInDistrictB: '10000000-0000-4000-a000-000000000021',

  // ── Classes & Groups (5xxx) ───────────────────────────────────────────
  classInSchoolA: '50000000-0000-4000-a000-000000000001',
  classInSchoolB: '50000000-0000-4000-a000-000000000002',
  classInSchoolC: '50000000-0000-4000-a000-000000000003',
  classInDistrictB: '50000000-0000-4000-a000-000000000004',
  group: '50000000-0000-4000-a000-000000000010',

  // ── Users (2xxx) ──────────────────────────────────────────────────────
  superAdmin: '20000000-0000-4000-a000-000000000001',
  superAdminAuth: '20000000-0000-4000-b000-000000000001',
  districtAdmin: '20000000-0000-4000-a000-000000000002',
  districtAdminAuth: '20000000-0000-4000-b000-000000000002',
  schoolAAdmin: '20000000-0000-4000-a000-000000000003',
  schoolAAdminAuth: '20000000-0000-4000-b000-000000000003',
  schoolAPrincipal: '20000000-0000-4000-a000-000000000004',
  schoolAPrincipalAuth: '20000000-0000-4000-b000-000000000004',
  schoolATeacher: '20000000-0000-4000-a000-000000000005',
  schoolATeacherAuth: '20000000-0000-4000-b000-000000000005',
  schoolAStudent: '20000000-0000-4000-a000-000000000006',
  schoolAStudentAuth: '20000000-0000-4000-b000-000000000006',
  schoolBStudent: '20000000-0000-4000-a000-000000000007',
  schoolBStudentAuth: '20000000-0000-4000-b000-000000000007',
  classAStudent: '20000000-0000-4000-a000-000000000008',
  classAStudentAuth: '20000000-0000-4000-b000-000000000008',
  classATeacher: '20000000-0000-4000-a000-000000000009',
  classATeacherAuth: '20000000-0000-4000-b000-000000000009',
  groupStudent: '20000000-0000-4000-a000-000000000010',
  groupStudentAuth: '20000000-0000-4000-b000-000000000010',
  unassignedUser: '20000000-0000-4000-a000-000000000011',
  unassignedUserAuth: '20000000-0000-4000-b000-000000000011',
  multiAssignedUser: '20000000-0000-4000-a000-000000000012',
  multiAssignedUserAuth: '20000000-0000-4000-b000-000000000012',
  districtBAdmin: '20000000-0000-4000-a000-000000000013',
  districtBAdminAuth: '20000000-0000-4000-b000-000000000013',
  districtBStudent: '20000000-0000-4000-a000-000000000014',
  districtBStudentAuth: '20000000-0000-4000-b000-000000000014',
  // Enrollment boundary users
  expiredEnrollmentStudent: '20000000-0000-4000-a000-000000000020',
  expiredEnrollmentStudentAuth: '20000000-0000-4000-b000-000000000020',
  futureEnrollmentStudent: '20000000-0000-4000-a000-000000000021',
  futureEnrollmentStudentAuth: '20000000-0000-4000-b000-000000000021',
  expiredClassStudent: '20000000-0000-4000-a000-000000000022',
  expiredClassStudentAuth: '20000000-0000-4000-b000-000000000022',
  futureGroupStudent: '20000000-0000-4000-a000-000000000023',
  futureGroupStudentAuth: '20000000-0000-4000-b000-000000000023',
  // Demographic users
  grade5Student: '20000000-0000-4000-a000-000000000030',
  grade5StudentAuth: '20000000-0000-4000-b000-000000000030',
  grade3Student: '20000000-0000-4000-a000-000000000031',
  grade3StudentAuth: '20000000-0000-4000-b000-000000000031',
  grade5EllStudent: '20000000-0000-4000-a000-000000000032',
  grade5EllStudentAuth: '20000000-0000-4000-b000-000000000032',
  // Extra students for assessment activity (District B)
  cedarStudentA: '20000000-0000-4000-a000-000000000040',
  cedarStudentAAuth: '20000000-0000-4000-b000-000000000040',
  cedarStudentB: '20000000-0000-4000-a000-000000000041',
  cedarStudentBAuth: '20000000-0000-4000-b000-000000000041',
  cedarStudentC: '20000000-0000-4000-a000-000000000042',
  cedarStudentCAuth: '20000000-0000-4000-b000-000000000042',

  // ── Administrations (3xxx) ────────────────────────────────────────────
  administrationDistrict: '30000000-0000-4000-a000-000000000001',
  administrationSchoolA: '30000000-0000-4000-a000-000000000002',
  administrationSchoolB: '30000000-0000-4000-a000-000000000003',
  administrationClassA: '30000000-0000-4000-a000-000000000004',
  administrationGroup: '30000000-0000-4000-a000-000000000005',
  administrationDistrictB: '30000000-0000-4000-a000-000000000006',

  // ── Tasks & Variants (4xxx) ───────────────────────────────────────────
  taskWord: '40000000-0000-4000-a000-000000000001',
  taskSentence: '40000000-0000-4000-a000-000000000002',
  taskPhoneme: '40000000-0000-4000-a000-000000000003',
  taskLetter: '40000000-0000-4000-a000-000000000004',
  taskMorphology: '40000000-0000-4000-a000-000000000005',
  taskSyntax: '40000000-0000-4000-a000-000000000006',
  taskInference: '40000000-0000-4000-a000-000000000007',
  variantAllGrades: '40000000-0000-4000-a000-000000000101',
  variantGrade5: '40000000-0000-4000-a000-000000000102',
  variantGrade3: '40000000-0000-4000-a000-000000000103',
  variantOptionalEll: '40000000-0000-4000-a000-000000000104',
  variantTask2: '40000000-0000-4000-a000-000000000105',
  variantTask2Grade5Ell: '40000000-0000-4000-a000-000000000106',
  variantPhoneme: '40000000-0000-4000-a000-000000000201',
  variantLetter: '40000000-0000-4000-a000-000000000202',
  variantMorphology: '40000000-0000-4000-a000-000000000203',
  variantSyntax: '40000000-0000-4000-a000-000000000204',
  variantInference: '40000000-0000-4000-a000-000000000205',

  // ── Agreements (6xxx) ─────────────────────────────────────────────────
  consentAgreement: '60000000-0000-4000-a000-000000000001',
  assentAgreement: '60000000-0000-4000-a000-000000000002',
  consentVersion: '60000000-0000-4000-a000-000000000011',
  assentVersion: '60000000-0000-4000-a000-000000000012',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Dev Users — deterministic credentials for login
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Shared password for all dev fixture users.
 * Only valid against the local Firebase Auth emulator — never use in deployed environments.
 */
export const DEV_PASSWORD = 'password';

/**
 * Credential map for each user in the dev fixture. Keys match the
 * `CYPRESS_FIXTURE_USER_KEYS` in the seed script so Cypress specs can
 * look up any user by logical name.
 */
export const DEV_USERS = {
  superAdmin: {
    id: DEV_IDS.superAdmin,
    authId: DEV_IDS.superAdminAuth,
    email: 'super-admin@test.local',
    nameFirst: 'Super',
    nameLast: 'Admin',
    userType: UserType.ADMIN,
  },
  districtAdmin: {
    id: DEV_IDS.districtAdmin,
    authId: DEV_IDS.districtAdminAuth,
    email: 'district-admin@test.local',
    nameFirst: 'District',
    nameLast: 'Admin',
    userType: UserType.ADMIN,
  },
  schoolAAdmin: {
    id: DEV_IDS.schoolAAdmin,
    authId: DEV_IDS.schoolAAdminAuth,
    email: 'school-a-admin@test.local',
    nameFirst: 'School A',
    nameLast: 'Admin',
    userType: UserType.ADMIN,
  },
  schoolATeacher: {
    id: DEV_IDS.schoolATeacher,
    authId: DEV_IDS.schoolATeacherAuth,
    email: 'school-a-teacher@test.local',
    nameFirst: 'School A',
    nameLast: 'Teacher',
    userType: UserType.EDUCATOR,
  },
  schoolAStudent: {
    id: DEV_IDS.schoolAStudent,
    authId: DEV_IDS.schoolAStudentAuth,
    email: 'school-a-student@test.local',
    nameFirst: 'School A',
    nameLast: 'Student',
    userType: UserType.STUDENT,
  },
  classATeacher: {
    id: DEV_IDS.classATeacher,
    authId: DEV_IDS.classATeacherAuth,
    email: 'class-a-teacher@test.local',
    nameFirst: 'Class A',
    nameLast: 'Teacher',
    userType: UserType.EDUCATOR,
  },
  classAStudent: {
    id: DEV_IDS.classAStudent,
    authId: DEV_IDS.classAStudentAuth,
    email: 'class-a-student@test.local',
    nameFirst: 'Class A',
    nameLast: 'Student',
    userType: UserType.STUDENT,
  },
  groupStudent: {
    id: DEV_IDS.groupStudent,
    authId: DEV_IDS.groupStudentAuth,
    email: 'group-student@test.local',
    nameFirst: 'Group',
    nameLast: 'Student',
    userType: UserType.STUDENT,
  },
  districtBAdmin: {
    id: DEV_IDS.districtBAdmin,
    authId: DEV_IDS.districtBAdminAuth,
    email: 'district-b-admin@test.local',
    nameFirst: 'District B',
    nameLast: 'Admin',
    userType: UserType.ADMIN,
  },
} as const;

/** All user keys exposed in the Cypress fixture file. */
export const DEV_FIXTURE_USER_KEYS = Object.keys(DEV_USERS) as ReadonlyArray<keyof typeof DEV_USERS>;

// ═══════════════════════════════════════════════════════════════════════════
// Seeding Function
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Seeds the deterministic dev fixture into the database.
 *
 * Replicates the full baseFixture org hierarchy, users, administrations,
 * tasks, and variants — plus the local-dev extras from the seed script
 * (agreements, expanded task catalog, and assessment activity).
 *
 * All entities use hardcoded IDs from `DEV_IDS` so they are stable across
 * re-seeds and predictable in Cypress specs.
 *
 * @returns The seeded fixture conforming to the BaseFixture interface
 */
export async function seedDevFixture(): Promise<BaseFixture> {
  // ═══════════════════════════════════════════════════════════════════════
  // Step 1: Create Org Hierarchy
  // ═══════════════════════════════════════════════════════════════════════

  const district = await OrgFactory.create({
    id: DEV_IDS.district,
    name: 'Maple Grove Unified District',
    orgType: OrgType.DISTRICT,
  });

  const districtB = await OrgFactory.create({
    id: DEV_IDS.districtB,
    name: 'Cedar Falls Unified District',
    orgType: OrgType.DISTRICT,
  });

  const [schoolA, schoolB, schoolInDistrictB, schoolC] = await Promise.all([
    OrgFactory.create({
      id: DEV_IDS.schoolA,
      name: 'Maple Grove Elementary (School A)',
      orgType: OrgType.SCHOOL,
      parentOrgId: district.id,
    }),
    OrgFactory.create({
      id: DEV_IDS.schoolB,
      name: 'Birch Street Elementary (School B)',
      orgType: OrgType.SCHOOL,
      parentOrgId: district.id,
    }),
    OrgFactory.create({
      id: DEV_IDS.schoolInDistrictB,
      name: 'Cedar Falls Elementary',
      orgType: OrgType.SCHOOL,
      parentOrgId: districtB.id,
    }),
    OrgFactory.create({
      id: DEV_IDS.schoolC,
      name: 'Maple Grove West Elementary (School C)',
      orgType: OrgType.SCHOOL,
      parentOrgId: district.id,
    }),
  ]);

  const [classInSchoolA, classInSchoolB, classInDistrictB, classInSchoolC, group] = await Promise.all([
    ClassFactory.create({
      id: DEV_IDS.classInSchoolA,
      name: 'Maple Grove Elem — Grade 3 (Class A)',
      schoolId: schoolA.id,
      districtId: district.id,
    }),
    ClassFactory.create({
      id: DEV_IDS.classInSchoolB,
      name: 'Birch Street Elem — Grade 4 (Class B)',
      schoolId: schoolB.id,
      districtId: district.id,
    }),
    ClassFactory.create({
      id: DEV_IDS.classInDistrictB,
      name: 'Cedar Falls Elem — Grade 5',
      schoolId: schoolInDistrictB.id,
      districtId: districtB.id,
    }),
    ClassFactory.create({
      id: DEV_IDS.classInSchoolC,
      name: 'Maple Grove West Elem — Demographics (Class C)',
      schoolId: schoolC.id,
      districtId: district.id,
    }),
    GroupFactory.create({ id: DEV_IDS.group, name: 'Maple Grove Summer Reading (Group)' }),
  ]);

  // ═══════════════════════════════════════════════════════════════════════
  // Step 2: Create Users
  // ═══════════════════════════════════════════════════════════════════════

  const [
    superAdmin,
    districtAdmin,
    schoolAAdmin,
    schoolAPrincipal,
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
    expiredEnrollmentStudent,
    futureEnrollmentStudent,
    expiredClassStudent,
    futureGroupStudent,
    grade5Student,
    grade3Student,
    grade5EllStudent,
  ] = await Promise.all([
    UserFactory.create({
      id: DEV_IDS.superAdmin,
      authId: DEV_IDS.superAdminAuth,
      nameFirst: 'Super',
      nameLast: 'Admin',
      userType: UserType.ADMIN,
      isSuperAdmin: true,
    }),
    UserFactory.create({
      id: DEV_IDS.districtAdmin,
      authId: DEV_IDS.districtAdminAuth,
      nameFirst: 'District',
      nameLast: 'Admin',
      userType: UserType.ADMIN,
    }),
    UserFactory.create({
      id: DEV_IDS.schoolAAdmin,
      authId: DEV_IDS.schoolAAdminAuth,
      nameFirst: 'School A',
      nameLast: 'Admin',
      userType: UserType.ADMIN,
    }),
    UserFactory.create({
      id: DEV_IDS.schoolAPrincipal,
      authId: DEV_IDS.schoolAPrincipalAuth,
      nameFirst: 'School A',
      nameLast: 'Principal',
      userType: UserType.ADMIN,
    }),
    UserFactory.create({
      id: DEV_IDS.schoolATeacher,
      authId: DEV_IDS.schoolATeacherAuth,
      nameFirst: 'School A',
      nameLast: 'Teacher',
      userType: UserType.EDUCATOR,
    }),
    UserFactory.create({
      id: DEV_IDS.schoolAStudent,
      authId: DEV_IDS.schoolAStudentAuth,
      nameFirst: 'School A',
      nameLast: 'Student',
      userType: UserType.STUDENT,
    }),
    UserFactory.create({
      id: DEV_IDS.schoolBStudent,
      authId: DEV_IDS.schoolBStudentAuth,
      nameFirst: 'School B',
      nameLast: 'Student',
      userType: UserType.STUDENT,
    }),
    UserFactory.create({
      id: DEV_IDS.classAStudent,
      authId: DEV_IDS.classAStudentAuth,
      nameFirst: 'Class A',
      nameLast: 'Student',
      userType: UserType.STUDENT,
    }),
    UserFactory.create({
      id: DEV_IDS.classATeacher,
      authId: DEV_IDS.classATeacherAuth,
      nameFirst: 'Class A',
      nameLast: 'Teacher',
      userType: UserType.EDUCATOR,
    }),
    UserFactory.create({
      id: DEV_IDS.groupStudent,
      authId: DEV_IDS.groupStudentAuth,
      nameFirst: 'Group',
      nameLast: 'Student',
      userType: UserType.STUDENT,
    }),
    UserFactory.create({
      id: DEV_IDS.unassignedUser,
      authId: DEV_IDS.unassignedUserAuth,
      nameFirst: 'Unassigned',
      nameLast: 'User',
      userType: UserType.STUDENT,
    }),
    UserFactory.create({
      id: DEV_IDS.multiAssignedUser,
      authId: DEV_IDS.multiAssignedUserAuth,
      nameFirst: 'Multi-Org',
      nameLast: 'Admin',
      userType: UserType.ADMIN,
    }),
    UserFactory.create({
      id: DEV_IDS.districtBAdmin,
      authId: DEV_IDS.districtBAdminAuth,
      nameFirst: 'District B',
      nameLast: 'Admin',
      userType: UserType.ADMIN,
    }),
    UserFactory.create({
      id: DEV_IDS.districtBStudent,
      authId: DEV_IDS.districtBStudentAuth,
      nameFirst: 'District B',
      nameLast: 'Student',
      userType: UserType.STUDENT,
    }),
    UserFactory.create({
      id: DEV_IDS.expiredEnrollmentStudent,
      authId: DEV_IDS.expiredEnrollmentStudentAuth,
      nameFirst: 'Expired Org',
      nameLast: 'Student',
      userType: UserType.STUDENT,
    }),
    UserFactory.create({
      id: DEV_IDS.futureEnrollmentStudent,
      authId: DEV_IDS.futureEnrollmentStudentAuth,
      nameFirst: 'Future Org',
      nameLast: 'Student',
      userType: UserType.STUDENT,
    }),
    UserFactory.create({
      id: DEV_IDS.expiredClassStudent,
      authId: DEV_IDS.expiredClassStudentAuth,
      nameFirst: 'Expired Class',
      nameLast: 'Student',
      userType: UserType.STUDENT,
    }),
    UserFactory.create({
      id: DEV_IDS.futureGroupStudent,
      authId: DEV_IDS.futureGroupStudentAuth,
      nameFirst: 'Future Group',
      nameLast: 'Student',
      userType: UserType.STUDENT,
    }),
    UserFactory.create({
      id: DEV_IDS.grade5Student,
      authId: DEV_IDS.grade5StudentAuth,
      nameFirst: 'Grade 5',
      nameLast: 'Student',
      userType: UserType.STUDENT,
      grade: '5',
    }),
    UserFactory.create({
      id: DEV_IDS.grade3Student,
      authId: DEV_IDS.grade3StudentAuth,
      nameFirst: 'Grade 3',
      nameLast: 'Student',
      userType: UserType.STUDENT,
      grade: '3',
    }),
    UserFactory.create({
      id: DEV_IDS.grade5EllStudent,
      authId: DEV_IDS.grade5EllStudentAuth,
      nameFirst: 'Grade 5 ELL',
      nameLast: 'Student',
      userType: UserType.STUDENT,
      grade: '5',
      statusEll: 'active',
    }),
  ]);

  // ═══════════════════════════════════════════════════════════════════════
  // Step 3: Assign Users to Orgs/Classes/Groups
  // ═══════════════════════════════════════════════════════════════════════

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await Promise.all([
    // Org assignments
    UserOrgFactory.create({ userId: districtAdmin.id, orgId: district.id, role: UserRole.ADMINISTRATOR }),
    UserOrgFactory.create({ userId: schoolAAdmin.id, orgId: schoolA.id, role: UserRole.ADMINISTRATOR }),
    UserOrgFactory.create({ userId: schoolAPrincipal.id, orgId: schoolA.id, role: UserRole.PRINCIPAL }),
    UserOrgFactory.create({ userId: schoolATeacher.id, orgId: schoolA.id, role: UserRole.TEACHER }),
    // Class enrollments
    UserClassFactory.create({ userId: schoolAStudent.id, classId: classInSchoolA.id, role: UserRole.STUDENT }),
    UserClassFactory.create({ userId: schoolBStudent.id, classId: classInSchoolB.id, role: UserRole.STUDENT }),
    UserClassFactory.create({ userId: classAStudent.id, classId: classInSchoolA.id, role: UserRole.STUDENT }),
    UserClassFactory.create({ userId: classATeacher.id, classId: classInSchoolA.id, role: UserRole.TEACHER }),
    // Group assignments
    UserGroupFactory.create({ userId: groupStudent.id, groupId: group.id, role: UserRole.STUDENT }),
    // Multi-assigned user
    UserOrgFactory.create({ userId: multiAssignedUser.id, orgId: district.id, role: UserRole.ADMINISTRATOR }),
    UserOrgFactory.create({ userId: multiAssignedUser.id, orgId: schoolA.id, role: UserRole.TEACHER }),
    // District B users
    UserOrgFactory.create({ userId: districtBAdmin.id, orgId: districtB.id, role: UserRole.ADMINISTRATOR }),
    UserClassFactory.create({ userId: districtBStudent.id, classId: classInDistrictB.id, role: UserRole.STUDENT }),
    // Enrollment boundary users
    UserClassFactory.create({
      userId: expiredEnrollmentStudent.id,
      classId: classInSchoolA.id,
      role: UserRole.STUDENT,
      enrollmentStart: thirtyDaysAgo,
      enrollmentEnd: sevenDaysAgo,
    }),
    UserClassFactory.create({
      userId: futureEnrollmentStudent.id,
      classId: classInSchoolA.id,
      role: UserRole.STUDENT,
      enrollmentStart: sevenDaysFromNow,
      enrollmentEnd: thirtyDaysFromNow,
    }),
    UserClassFactory.create({
      userId: expiredClassStudent.id,
      classId: classInSchoolA.id,
      role: UserRole.STUDENT,
      enrollmentStart: thirtyDaysAgo,
      enrollmentEnd: sevenDaysAgo,
    }),
    UserGroupFactory.create({
      userId: futureGroupStudent.id,
      groupId: group.id,
      role: UserRole.STUDENT,
      enrollmentStart: sevenDaysFromNow,
      enrollmentEnd: thirtyDaysFromNow,
    }),
    // Demographic students
    UserClassFactory.create({ userId: grade5Student.id, classId: classInSchoolC.id, role: UserRole.STUDENT }),
    UserClassFactory.create({ userId: grade3Student.id, classId: classInSchoolC.id, role: UserRole.STUDENT }),
    UserClassFactory.create({ userId: grade5EllStudent.id, classId: classInSchoolC.id, role: UserRole.STUDENT }),
  ]);

  // ═══════════════════════════════════════════════════════════════════════
  // Step 4: Create Tasks & Task Variants (base + expanded catalog)
  // ═══════════════════════════════════════════════════════════════════════

  const [task, task2, phonemeTask, letterTask, morphologyTask, syntaxTask, inferenceTask] = await Promise.all([
    TaskFactory.create({ id: DEV_IDS.taskWord, name: 'Word' }),
    TaskFactory.create({ id: DEV_IDS.taskSentence, name: 'Sentence' }),
    TaskFactory.create({ id: DEV_IDS.taskPhoneme, name: 'Phoneme' }),
    TaskFactory.create({ id: DEV_IDS.taskLetter, name: 'Letter' }),
    TaskFactory.create({ id: DEV_IDS.taskMorphology, name: 'Morphology' }),
    TaskFactory.create({ id: DEV_IDS.taskSyntax, name: 'Syntax' }),
    TaskFactory.create({ id: DEV_IDS.taskInference, name: 'Inference' }),
  ]);

  const [
    variantForAllGrades,
    variantForGrade5,
    variantForGrade3,
    variantOptionalForEll,
    variantForTask2,
    variantForTask2Grade5OptionalEll,
    phonemeVariant,
    letterVariant,
    morphologyVariant,
    syntaxVariant,
    inferenceVariant,
  ] = await Promise.all([
    TaskVariantFactory.create({ id: DEV_IDS.variantAllGrades, taskId: task.id, name: 'Word — All Grades' }),
    TaskVariantFactory.create({ id: DEV_IDS.variantGrade5, taskId: task.id, name: 'Word — Grade 5' }),
    TaskVariantFactory.create({ id: DEV_IDS.variantGrade3, taskId: task.id, name: 'Word — Grade 3' }),
    TaskVariantFactory.create({ id: DEV_IDS.variantOptionalEll, taskId: task.id, name: 'Word — ELL (Optional)' }),
    TaskVariantFactory.create({ id: DEV_IDS.variantTask2, taskId: task2.id, name: 'Sentence — All Grades' }),
    TaskVariantFactory.create({
      id: DEV_IDS.variantTask2Grade5Ell,
      taskId: task2.id,
      name: 'Sentence — Grade 5, ELL Optional',
    }),
    TaskVariantFactory.create({ id: DEV_IDS.variantPhoneme, taskId: phonemeTask.id, name: 'Phoneme (Standard)' }),
    TaskVariantFactory.create({ id: DEV_IDS.variantLetter, taskId: letterTask.id, name: 'Letter (Standard)' }),
    TaskVariantFactory.create({
      id: DEV_IDS.variantMorphology,
      taskId: morphologyTask.id,
      name: 'Morphology (Standard)',
    }),
    TaskVariantFactory.create({ id: DEV_IDS.variantSyntax, taskId: syntaxTask.id, name: 'Syntax (Standard)' }),
    TaskVariantFactory.create({ id: DEV_IDS.variantInference, taskId: inferenceTask.id, name: 'Inference (Standard)' }),
  ]);

  // ═══════════════════════════════════════════════════════════════════════
  // Step 5: Create Administrations
  // ═══════════════════════════════════════════════════════════════════════

  const [
    administrationAssignedToDistrict,
    administrationAssignedToSchoolA,
    administrationAssignedToSchoolB,
    administrationAssignedToClassA,
    administrationAssignedToGroup,
    administrationAssignedToDistrictB,
  ] = await Promise.all([
    AdministrationFactory.create({
      id: DEV_IDS.administrationDistrict,
      name: 'Fall 2025 Universal Screener (District A)',
      namePublic: 'Fall 2025 Reading Screener',
      createdBy: districtAdmin.id,
    }),
    AdministrationFactory.create({
      id: DEV_IDS.administrationSchoolA,
      name: 'Winter Reading Benchmark (School A)',
      namePublic: 'Winter Reading Benchmark',
      createdBy: schoolAAdmin.id,
    }),
    AdministrationFactory.create({
      id: DEV_IDS.administrationSchoolB,
      name: 'Winter Reading Benchmark (School B)',
      namePublic: 'Winter Reading Benchmark',
      createdBy: districtAdmin.id,
    }),
    AdministrationFactory.create({
      id: DEV_IDS.administrationClassA,
      name: 'Grade 3 Progress Check (Class A)',
      namePublic: 'Grade 3 Progress Check',
      createdBy: classATeacher.id,
    }),
    AdministrationFactory.create({
      id: DEV_IDS.administrationGroup,
      name: 'Summer Reading Cohort Screener (Group)',
      namePublic: 'Summer Reading Screener',
      createdBy: districtAdmin.id,
    }),
    AdministrationFactory.create({
      id: DEV_IDS.administrationDistrictB,
      name: 'Fall 2025 Universal Screener (District B)',
      namePublic: 'Fall 2025 Reading Screener',
      createdBy: districtBAdmin.id,
    }),
  ]);

  // ═══════════════════════════════════════════════════════════════════════
  // Step 6: Assign Administrations to Orgs/Classes/Groups
  // ═══════════════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════
  // Step 7: Assign Task Variants to Administrations
  // ═══════════════════════════════════════════════════════════════════════

  // District administration — base variants with eligibility conditions
  await Promise.all([
    AdministrationTaskVariantFactory.create({
      administrationId: administrationAssignedToDistrict.id,
      taskVariantId: variantForAllGrades.id,
      orderIndex: 0,
    }),
    AdministrationTaskVariantFactory.create({
      administrationId: administrationAssignedToDistrict.id,
      taskVariantId: variantForGrade5.id,
      orderIndex: 1,
      conditionsAssignment: { field: 'studentData.grade', op: 'EQUAL', value: '5' },
    }),
    AdministrationTaskVariantFactory.create({
      administrationId: administrationAssignedToDistrict.id,
      taskVariantId: variantForGrade3.id,
      orderIndex: 2,
      conditionsAssignment: { field: 'studentData.grade', op: 'EQUAL', value: '3' },
    }),
    AdministrationTaskVariantFactory.create({
      administrationId: administrationAssignedToDistrict.id,
      taskVariantId: variantOptionalForEll.id,
      orderIndex: 3,
      conditionsRequirements: { field: 'studentData.statusEll', op: 'EQUAL', value: 'active' },
    }),
    AdministrationTaskVariantFactory.create({
      administrationId: administrationAssignedToDistrict.id,
      taskVariantId: variantForTask2.id,
      orderIndex: 4,
    }),
    AdministrationTaskVariantFactory.create({
      administrationId: administrationAssignedToDistrict.id,
      taskVariantId: variantForTask2Grade5OptionalEll.id,
      orderIndex: 5,
      conditionsAssignment: { field: 'studentData.grade', op: 'EQUAL', value: '5' },
      conditionsRequirements: { field: 'studentData.statusEll', op: 'EQUAL', value: 'active' },
    }),
  ]);

  // Non-district administrations — expanded catalog (local-dev extras)
  const localDevAssignments: Array<{ administrationId: string; taskVariantId: string }> = [
    // School A: Word, Phoneme, Letter
    { administrationId: administrationAssignedToSchoolA.id, taskVariantId: variantForAllGrades.id },
    { administrationId: administrationAssignedToSchoolA.id, taskVariantId: phonemeVariant.id },
    { administrationId: administrationAssignedToSchoolA.id, taskVariantId: letterVariant.id },
    // School B: Sentence, Morphology, Syntax
    { administrationId: administrationAssignedToSchoolB.id, taskVariantId: variantForTask2.id },
    { administrationId: administrationAssignedToSchoolB.id, taskVariantId: morphologyVariant.id },
    { administrationId: administrationAssignedToSchoolB.id, taskVariantId: syntaxVariant.id },
    // Class A: Word, Inference
    { administrationId: administrationAssignedToClassA.id, taskVariantId: variantForAllGrades.id },
    { administrationId: administrationAssignedToClassA.id, taskVariantId: inferenceVariant.id },
    // Group: Phoneme, Morphology
    { administrationId: administrationAssignedToGroup.id, taskVariantId: phonemeVariant.id },
    { administrationId: administrationAssignedToGroup.id, taskVariantId: morphologyVariant.id },
    // District B: Letter, Syntax, Inference
    { administrationId: administrationAssignedToDistrictB.id, taskVariantId: letterVariant.id },
    { administrationId: administrationAssignedToDistrictB.id, taskVariantId: syntaxVariant.id },
    { administrationId: administrationAssignedToDistrictB.id, taskVariantId: inferenceVariant.id },
  ];

  // Counter increments are synchronous inside .map() — all orderIndex values
  // are assigned before any factory promise starts executing, so there is no
  // race between concurrent creates for the same administration.
  const orderIndexByAdministration = new Map<string, number>();
  await Promise.all(
    localDevAssignments.map(({ administrationId, taskVariantId }) => {
      const orderIndex = orderIndexByAdministration.get(administrationId) ?? 0;
      orderIndexByAdministration.set(administrationId, orderIndex + 1);
      return AdministrationTaskVariantFactory.create({ administrationId, taskVariantId, orderIndex });
    }),
  );

  // ═══════════════════════════════════════════════════════════════════════
  // Step 8: Seed Agreements (local-dev extras)
  // ═══════════════════════════════════════════════════════════════════════

  const [consentAgreement, assentAgreement] = await Promise.all([
    AgreementFactory.create({ id: DEV_IDS.consentAgreement, name: 'Local Dev Consent', agreementType: 'consent' }),
    AgreementFactory.create({ id: DEV_IDS.assentAgreement, name: 'Local Dev Assent', agreementType: 'assent' }),
  ]);

  await Promise.all([
    AgreementVersionFactory.create(
      { id: DEV_IDS.consentVersion, locale: 'en-US', githubFilename: 'CONSENT.md' },
      { transient: { agreementId: consentAgreement.id } },
    ),
    AgreementVersionFactory.create(
      { id: DEV_IDS.assentVersion, locale: 'en-US', githubFilename: 'ASSENT.md' },
      { transient: { agreementId: assentAgreement.id } },
    ),
    AdministrationAgreementFactory.create(undefined, {
      transient: { administrationId: administrationAssignedToDistrict.id, agreementId: consentAgreement.id },
    }),
    AdministrationAgreementFactory.create(undefined, {
      transient: { administrationId: administrationAssignedToDistrict.id, agreementId: assentAgreement.id },
    }),
  ]);

  // ═══════════════════════════════════════════════════════════════════════
  // Step 9: Seed Assessment Activity (runs, scores, trials)
  // ═══════════════════════════════════════════════════════════════════════

  try {
    // Extra students for District B (so completion bars light up)
    const [cedarStudentA, cedarStudentB, cedarStudentC] = await Promise.all([
      UserFactory.create({
        id: DEV_IDS.cedarStudentA,
        authId: DEV_IDS.cedarStudentAAuth,
        nameFirst: 'Cedar Grade 5',
        nameLast: 'Student One',
        userType: UserType.STUDENT,
      }),
      UserFactory.create({
        id: DEV_IDS.cedarStudentB,
        authId: DEV_IDS.cedarStudentBAuth,
        nameFirst: 'Cedar Grade 5',
        nameLast: 'Student Two',
        userType: UserType.STUDENT,
      }),
      UserFactory.create({
        id: DEV_IDS.cedarStudentC,
        authId: DEV_IDS.cedarStudentCAuth,
        nameFirst: 'Cedar Grade 5',
        nameLast: 'Student Three',
        userType: UserType.STUDENT,
      }),
    ]);

    await Promise.all([
      UserClassFactory.create({ userId: cedarStudentA.id, classId: classInDistrictB.id, role: UserRole.STUDENT }),
      UserClassFactory.create({ userId: cedarStudentB.id, classId: classInDistrictB.id, role: UserRole.STUDENT }),
      UserClassFactory.create({ userId: cedarStudentC.id, classId: classInDistrictB.id, role: UserRole.STUDENT }),
    ]);

    const seededRunAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const seedRun = async (
      userId: string,
      variant: { taskId: string; taskVariantId: string },
      administrationId: string,
      completed: boolean,
    ): Promise<void> => {
      const run = await RunFactory.create({
        userId,
        taskId: variant.taskId,
        taskVariantId: variant.taskVariantId,
        administrationId,
        useForReporting: true,
        completedAt: completed ? seededRunAt : null,
      });
      if (!completed) return;
      await Promise.all([
        RunScoreFactory.create({
          runId: run.id,
          type: SCORE_TYPE.RAW,
          domain: SCORE_DOMAIN.COMPOSITE,
          name: SCORE_NAME.THETA_SE_RAW,
          value: (Math.random() * 2 - 1).toFixed(3),
          assessmentStage: ASSESSMENT_STAGE.TEST,
        }),
        RunScoreFactory.create({
          runId: run.id,
          type: SCORE_TYPE.RAW,
          domain: SCORE_DOMAIN.COMPOSITE,
          name: SCORE_NAME.NUM_ATTEMPTED,
          value: String(20 + Math.floor(Math.random() * 20)),
          assessmentStage: ASSESSMENT_STAGE.TEST,
        }),
        AssessmentDbClient.insert(runTrials).values([
          {
            runId: run.id,
            assessmentStage: ASSESSMENT_STAGE.TEST,
            trialIndex: 0,
            correct: 1,
            stimulus: 'cat',
            response: 'cat',
            responseTimeMs: 820,
          },
          {
            runId: run.id,
            assessmentStage: ASSESSMENT_STAGE.TEST,
            trialIndex: 1,
            correct: 0,
            stimulus: 'dog',
            response: 'dig',
            responseTimeMs: 1110,
          },
        ]),
      ]);
    };

    const activityPlan: Array<{
      administrationId: string;
      variants: Array<{ taskId: string; taskVariantId: string }>;
      completed: string[];
      started: string[];
    }> = [
      {
        administrationId: administrationAssignedToDistrict.id,
        variants: [
          { taskId: task.id, taskVariantId: variantForAllGrades.id },
          { taskId: task2.id, taskVariantId: variantForTask2.id },
        ],
        completed: [schoolAStudent.id, grade5Student.id],
        started: [classAStudent.id, grade3Student.id],
      },
      {
        administrationId: administrationAssignedToSchoolA.id,
        variants: [
          { taskId: task.id, taskVariantId: variantForAllGrades.id },
          { taskId: phonemeTask.id, taskVariantId: phonemeVariant.id },
          { taskId: letterTask.id, taskVariantId: letterVariant.id },
        ],
        completed: [schoolAStudent.id],
        started: [classAStudent.id],
      },
      {
        administrationId: administrationAssignedToSchoolB.id,
        variants: [
          { taskId: task2.id, taskVariantId: variantForTask2.id },
          { taskId: morphologyTask.id, taskVariantId: morphologyVariant.id },
          { taskId: syntaxTask.id, taskVariantId: syntaxVariant.id },
        ],
        completed: [schoolBStudent.id],
        started: [],
      },
      {
        administrationId: administrationAssignedToClassA.id,
        variants: [
          { taskId: task.id, taskVariantId: variantForAllGrades.id },
          { taskId: inferenceTask.id, taskVariantId: inferenceVariant.id },
        ],
        completed: [classAStudent.id],
        started: [],
      },
      {
        administrationId: administrationAssignedToGroup.id,
        variants: [
          { taskId: phonemeTask.id, taskVariantId: phonemeVariant.id },
          { taskId: morphologyTask.id, taskVariantId: morphologyVariant.id },
        ],
        completed: [groupStudent.id],
        started: [],
      },
      {
        administrationId: administrationAssignedToDistrictB.id,
        variants: [
          { taskId: letterTask.id, taskVariantId: letterVariant.id },
          { taskId: syntaxTask.id, taskVariantId: syntaxVariant.id },
          { taskId: inferenceTask.id, taskVariantId: inferenceVariant.id },
        ],
        completed: [cedarStudentA.id, districtBStudent.id],
        started: [cedarStudentB.id, cedarStudentC.id],
      },
    ];

    for (const plan of activityPlan) {
      await Promise.all([
        ...plan.completed.flatMap((userId) =>
          plan.variants.map((variant) => seedRun(userId, variant, plan.administrationId, true)),
        ),
        ...plan.started.flatMap((userId) =>
          plan.variants.map((variant) => seedRun(userId, variant, plan.administrationId, false)),
        ),
      ]);
    }
  } catch (err) {
    logger.warn(
      { err },
      '[dev-fixture] Assessment activity seeding failed (non-fatal); completion bars may stay empty',
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Return BaseFixture-compatible object
  // ═══════════════════════════════════════════════════════════════════════

  return {
    district,
    schoolA,
    schoolB,
    schoolC,
    classInSchoolA,
    classInSchoolB,
    classInSchoolC,
    group,
    districtB,
    schoolInDistrictB,
    classInDistrictB,
    superAdmin,
    districtAdmin,
    schoolAAdmin,
    schoolAPrincipal,
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
    expiredEnrollmentStudent,
    futureEnrollmentStudent,
    expiredClassStudent,
    futureGroupStudent,
    grade5Student,
    grade3Student,
    grade5EllStudent,
    task,
    task2,
    variantForAllGrades,
    variantForGrade5,
    variantForGrade3,
    variantOptionalForEll,
    variantForTask2,
    variantForTask2Grade5OptionalEll,
    administrationAssignedToDistrict,
    administrationAssignedToSchoolA,
    administrationAssignedToSchoolB,
    administrationAssignedToClassA,
    administrationAssignedToGroup,
    administrationAssignedToDistrictB,
  };
}
