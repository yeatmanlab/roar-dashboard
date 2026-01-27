import { faker } from '@faker-js/faker';
import { eq, sql } from 'drizzle-orm';
import { getTestDbClient } from '../db';
import {
  users,
  orgs,
  classes,
  groups,
  administrations,
  userOrgs,
  userClasses,
  userGroups,
  administrationOrgs,
  administrationClasses,
  administrationGroups,
} from '../../db/schema';
import type {
  User,
  Org,
  Class,
  Group,
  Administration,
  UserOrg,
  UserClass,
  UserGroup,
  AdministrationOrg,
  AdministrationClass,
  AdministrationGroup,
} from '../../db/schema';
import type { UserRole } from '../../enums/user-role.enum';

/**
 * Base Fixture for Integration Tests
 *
 * Represents a realistic org hierarchy with users at various levels and roles.
 * Seed once per test file with `beforeAll`, then reference fixture properties.
 *
 * Hierarchy Structure:
 * ```
 *   district
 *   ├── schoolA
 *   │   └── classInSchoolA
 *   └── schoolB
 *       └── classInSchoolB
 *
 *   group (standalone, no hierarchy)
 * ```
 *
 * @example
 * ```typescript
 * let fixture: BaseFixture;
 * beforeAll(async () => { fixture = await seedBaseFixture(); });
 *
 * it('test', () => {
 *   expect(fixture.schoolAStudent.id).toBeDefined();
 * });
 * ```
 */
export interface BaseFixture {
  // ═══════════════════════════════════════════════════════════════
  // ORGANIZATION HIERARCHY
  // ═══════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════════════════════

  /** Administrator at district level */
  districtAdmin: User;
  /** Administrator at School A */
  schoolAAdmin: User;
  /** Teacher at School A (org-level assignment) */
  schoolATeacher: User;
  /** Student at School A (org assignment) */
  schoolAStudent: User;
  /** Student at School B (for cross-branch tests) */
  schoolBStudent: User;
  /** Student in Class A (class assignment) */
  classAStudent: User;
  /** Teacher in Class A (class assignment) */
  classATeacher: User;
  /** Student in group */
  groupStudent: User;
  /** User with no assignments (edge case) */
  unassignedUser: User;
  /** User assigned to multiple orgs (deduplication tests) */
  multiAssignedUser: User;

  // ═══════════════════════════════════════════════════════════════
  // ADMINISTRATIONS
  // ═══════════════════════════════════════════════════════════════

  /** Administration assigned to district (visible to all in district hierarchy) */
  adminAtDistrict: Administration;
  /** Administration assigned to School A only */
  adminAtSchoolA: Administration;
  /** Administration assigned to School B only */
  adminAtSchoolB: Administration;
  /** Administration assigned to Class A only */
  adminAtClassA: Administration;
  /** Administration assigned to group only */
  adminAtGroup: Administration;

  // ═══════════════════════════════════════════════════════════════
  // USER ASSIGNMENTS (for reference)
  // ═══════════════════════════════════════════════════════════════

  userOrgAssignments: UserOrg[];
  userClassAssignments: UserClass[];
  userGroupAssignments: UserGroup[];

  // ═══════════════════════════════════════════════════════════════
  // ADMINISTRATION ASSIGNMENTS (for reference)
  // ═══════════════════════════════════════════════════════════════

  administrationOrgAssignments: AdministrationOrg[];
  administrationClassAssignments: AdministrationClass[];
  administrationGroupAssignments: AdministrationGroup[];
}

/**
 * Generate a valid ltree path segment from org type and UUID.
 * Format: {org_type}_{uuid} with hyphens replaced by underscores.
 */
function toLtreeSegment(orgType: string, id: string): string {
  return `${orgType}_${id.replace(/-/g, '_')}`;
}

/**
 * Create a user with minimal required fields.
 */
function createUserData(overrides: Partial<User> = {}): Omit<User, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    assessmentPid: faker.string.alphanumeric(12),
    authProvider: ['password'],
    authId: faker.string.uuid(),
    nameFirst: faker.person.firstName(),
    nameMiddle: null,
    nameLast: faker.person.lastName(),
    username: faker.internet.username(),
    email: faker.internet.email(),
    userType: 'student',
    dob: null,
    grade: null,
    schoolLevel: null,
    statusEll: null,
    statusFrl: null,
    statusIep: null,
    studentId: null,
    sisId: null,
    stateId: null,
    localId: null,
    gender: null,
    race: null,
    hispanicEthnicity: null,
    homeLanguage: null,
    excludeFromResearch: false,
    isSuperAdmin: false,
    ...overrides,
  };
}

/**
 * Seed the base fixture data into the test database.
 *
 * This function creates a realistic test scenario with:
 * - A district → school → class hierarchy
 * - Users at various levels with different roles
 * - Administrations assigned at different hierarchy levels
 */
export async function seedBaseFixture(): Promise<BaseFixture> {
  const db = getTestDbClient();
  const enrollmentStart = new Date('2024-01-01');
  const dateStart = new Date('2024-06-01');
  const dateEnd = new Date('2025-06-01');

  // ═══════════════════════════════════════════════════════════════
  // USERS - Create first (no dependencies)
  // ═══════════════════════════════════════════════════════════════

  const userRows = await db
    .insert(users)
    .values([
      createUserData({ userType: 'admin' }), // districtAdmin
      createUserData({ userType: 'admin' }), // schoolAAdmin
      createUserData({ userType: 'educator' }), // schoolATeacher
      createUserData({ userType: 'student' }), // schoolAStudent
      createUserData({ userType: 'student' }), // schoolBStudent
      createUserData({ userType: 'student' }), // classAStudent
      createUserData({ userType: 'educator' }), // classATeacher
      createUserData({ userType: 'student' }), // groupStudent
      createUserData({ userType: 'student' }), // unassignedUser
      createUserData({ userType: 'admin' }), // multiAssignedUser
    ])
    .returning();

  const districtAdmin = userRows[0]!;
  const schoolAAdmin = userRows[1]!;
  const schoolATeacher = userRows[2]!;
  const schoolAStudent = userRows[3]!;
  const schoolBStudent = userRows[4]!;
  const classAStudent = userRows[5]!;
  const classATeacher = userRows[6]!;
  const groupStudent = userRows[7]!;
  const unassignedUser = userRows[8]!;
  const multiAssignedUser = userRows[9]!;

  // ═══════════════════════════════════════════════════════════════
  // ORGS - Create hierarchy
  // ═══════════════════════════════════════════════════════════════

  // Create district first
  const districtRows = await db
    .insert(orgs)
    .values({
      name: 'Test District',
      abbreviation: 'TSTDST',
      orgType: 'district',
      path: 'placeholder', // Will be set by trigger, but must provide a value
    })
    .returning();
  const district = districtRows[0]!;

  // Update district path (trigger should handle this, but set explicitly for safety)
  const districtPath = toLtreeSegment('district', district.id);
  await db.execute(sql`UPDATE app.orgs SET path = ${districtPath}::ltree WHERE id = ${district.id}`);

  const schoolARows = await db
    .insert(orgs)
    .values({
      name: 'School A',
      abbreviation: 'SCHLA',
      orgType: 'school',
      parentOrgId: district.id,
      path: 'placeholder',
    })
    .returning();
  const schoolA = schoolARows[0]!;

  // Set school A path
  const schoolALtreePath = `${districtPath}.${toLtreeSegment('school', schoolA.id)}`;
  await db.execute(sql`UPDATE app.orgs SET path = ${schoolALtreePath}::ltree WHERE id = ${schoolA.id}`);

  const schoolBRows = await db
    .insert(orgs)
    .values({
      name: 'School B',
      abbreviation: 'SCHLB',
      orgType: 'school',
      parentOrgId: district.id,
      path: 'placeholder',
    })
    .returning();
  const schoolB = schoolBRows[0]!;

  // Set school B path
  const schoolBLtreePath = `${districtPath}.${toLtreeSegment('school', schoolB.id)}`;
  await db.execute(sql`UPDATE app.orgs SET path = ${schoolBLtreePath}::ltree WHERE id = ${schoolB.id}`);

  // Refresh orgs to get updated paths
  const updatedDistrictRows = await db.select().from(orgs).where(eq(orgs.id, district.id));
  const updatedDistrict = updatedDistrictRows[0]!;
  const updatedSchoolARows = await db.select().from(orgs).where(eq(orgs.id, schoolA.id));
  const updatedSchoolA = updatedSchoolARows[0]!;
  const updatedSchoolBRows = await db.select().from(orgs).where(eq(orgs.id, schoolB.id));
  const updatedSchoolB = updatedSchoolBRows[0]!;

  // ═══════════════════════════════════════════════════════════════
  // CLASSES
  // ═══════════════════════════════════════════════════════════════

  const classInSchoolARows = await db
    .insert(classes)
    .values({
      name: 'Class A - Reading 101',
      schoolId: updatedSchoolA.id,
      districtId: updatedDistrict.id,
      classType: 'scheduled',
      orgPath: 'placeholder',
    })
    .returning();
  const classInSchoolA = classInSchoolARows[0]!;

  // Set class A orgPath to match school A's path
  await db.execute(sql`UPDATE app.classes SET org_path = ${schoolALtreePath}::ltree WHERE id = ${classInSchoolA.id}`);

  const classInSchoolBRows = await db
    .insert(classes)
    .values({
      name: 'Class B - Math 101',
      schoolId: updatedSchoolB.id,
      districtId: updatedDistrict.id,
      classType: 'scheduled',
      orgPath: 'placeholder',
    })
    .returning();
  const classInSchoolB = classInSchoolBRows[0]!;

  // Set class B orgPath to match school B's path
  await db.execute(sql`UPDATE app.classes SET org_path = ${schoolBLtreePath}::ltree WHERE id = ${classInSchoolB.id}`);

  // Refresh classes to get updated paths
  const updatedClassInSchoolARows = await db.select().from(classes).where(eq(classes.id, classInSchoolA.id));
  const updatedClassInSchoolA = updatedClassInSchoolARows[0]!;
  const updatedClassInSchoolBRows = await db.select().from(classes).where(eq(classes.id, classInSchoolB.id));
  const updatedClassInSchoolB = updatedClassInSchoolBRows[0]!;

  // ═══════════════════════════════════════════════════════════════
  // GROUPS (standalone, no hierarchy)
  // ═══════════════════════════════════════════════════════════════

  const groupRows = await db
    .insert(groups)
    .values({
      name: 'Test Group',
      abbreviation: 'TSTGRP',
      groupType: 'cohort',
    })
    .returning();
  const group = groupRows[0]!;

  // ═══════════════════════════════════════════════════════════════
  // ADMINISTRATIONS - Create with different users as creators
  // ═══════════════════════════════════════════════════════════════

  const administrationRows = await db
    .insert(administrations)
    .values([
      {
        name: 'District-Wide Assessment',
        namePublic: 'District Assessment',
        description: 'Assessment assigned at district level',
        dateStart,
        dateEnd,
        isOrdered: false,
        createdBy: districtAdmin.id,
      },
      {
        name: 'School A Assessment',
        namePublic: 'School A Assessment',
        description: 'Assessment assigned at School A',
        dateStart,
        dateEnd,
        isOrdered: false,
        createdBy: schoolAAdmin.id,
      },
      {
        name: 'School B Assessment',
        namePublic: 'School B Assessment',
        description: 'Assessment assigned at School B',
        dateStart,
        dateEnd,
        isOrdered: false,
        createdBy: districtAdmin.id,
      },
      {
        name: 'Class A Assessment',
        namePublic: 'Class A Assessment',
        description: 'Assessment assigned at Class A',
        dateStart,
        dateEnd,
        isOrdered: false,
        createdBy: classATeacher.id,
      },
      {
        name: 'Group Assessment',
        namePublic: 'Group Assessment',
        description: 'Assessment assigned to group',
        dateStart,
        dateEnd,
        isOrdered: false,
        createdBy: districtAdmin.id,
      },
    ])
    .returning();

  const adminAtDistrict = administrationRows[0]!;
  const adminAtSchoolA = administrationRows[1]!;
  const adminAtSchoolB = administrationRows[2]!;
  const adminAtClassA = administrationRows[3]!;
  const adminAtGroup = administrationRows[4]!;

  // ═══════════════════════════════════════════════════════════════
  // USER ASSIGNMENTS - Assign users to orgs/classes/groups
  // ═══════════════════════════════════════════════════════════════

  const userOrgAssignments = await db
    .insert(userOrgs)
    .values([
      // District-level users
      {
        userId: districtAdmin.id,
        orgId: updatedDistrict.id,
        role: 'administrator' as UserRole,
        enrollmentStart,
      },
      // School A users
      {
        userId: schoolAAdmin.id,
        orgId: updatedSchoolA.id,
        role: 'administrator' as UserRole,
        enrollmentStart,
      },
      {
        userId: schoolATeacher.id,
        orgId: updatedSchoolA.id,
        role: 'teacher' as UserRole,
        enrollmentStart,
      },
      {
        userId: schoolAStudent.id,
        orgId: updatedSchoolA.id,
        role: 'student' as UserRole,
        enrollmentStart,
      },
      // School B users
      {
        userId: schoolBStudent.id,
        orgId: updatedSchoolB.id,
        role: 'student' as UserRole,
        enrollmentStart,
      },
      // Multi-assigned user (both district and school A)
      {
        userId: multiAssignedUser.id,
        orgId: updatedDistrict.id,
        role: 'administrator' as UserRole,
        enrollmentStart,
      },
      {
        userId: multiAssignedUser.id,
        orgId: updatedSchoolA.id,
        role: 'administrator' as UserRole,
        enrollmentStart,
      },
    ])
    .returning();

  const userClassAssignments = await db
    .insert(userClasses)
    .values([
      // Class A users
      {
        userId: classAStudent.id,
        classId: updatedClassInSchoolA.id,
        role: 'student' as UserRole,
        enrollmentStart,
      },
      {
        userId: classATeacher.id,
        classId: updatedClassInSchoolA.id,
        role: 'teacher' as UserRole,
        enrollmentStart,
      },
    ])
    .returning();

  const userGroupAssignments = await db
    .insert(userGroups)
    .values([
      {
        userId: groupStudent.id,
        groupId: group.id,
        role: 'student' as UserRole,
        enrollmentStart,
      },
    ])
    .returning();

  // ═══════════════════════════════════════════════════════════════
  // ADMINISTRATION ASSIGNMENTS
  // ═══════════════════════════════════════════════════════════════

  const administrationOrgAssignments = await db
    .insert(administrationOrgs)
    .values([
      { administrationId: adminAtDistrict.id, orgId: updatedDistrict.id },
      { administrationId: adminAtSchoolA.id, orgId: updatedSchoolA.id },
      { administrationId: adminAtSchoolB.id, orgId: updatedSchoolB.id },
    ])
    .returning();

  const administrationClassAssignments = await db
    .insert(administrationClasses)
    .values([{ administrationId: adminAtClassA.id, classId: updatedClassInSchoolA.id }])
    .returning();

  const administrationGroupAssignments = await db
    .insert(administrationGroups)
    .values([{ administrationId: adminAtGroup.id, groupId: group.id }])
    .returning();

  return {
    // Orgs
    district: updatedDistrict,
    schoolA: updatedSchoolA,
    schoolB: updatedSchoolB,
    classInSchoolA: updatedClassInSchoolA,
    classInSchoolB: updatedClassInSchoolB,
    group,

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

    // Administrations
    adminAtDistrict,
    adminAtSchoolA,
    adminAtSchoolB,
    adminAtClassA,
    adminAtGroup,

    // Assignments (for reference)
    userOrgAssignments,
    userClassAssignments,
    userGroupAssignments,
    administrationOrgAssignments,
    administrationClassAssignments,
    administrationGroupAssignments,
  };
}
