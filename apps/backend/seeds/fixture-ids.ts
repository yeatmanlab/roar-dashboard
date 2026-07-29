/**
 * Deterministic IDs for the dev fixture.
 *
 * Extracted from `fixture.ts` so scripts that need a fixture ID — `task-seed.ts`
 * assigning a variant to the fixture administration, for one — don't pull in the
 * factory graph and its DB client side effects just to read a UUID.
 */

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
  // Holds only real, launchable assessments — see `administrationLaunch` in fixture.ts.
  administrationLaunch: '30000000-0000-4000-a000-000000000007',

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
