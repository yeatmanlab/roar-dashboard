/**
 * Tests the custom `findByAuthId`, `getUserEntityMemberships`,
 * `createWithMemberships`, `findClassParentSchool`, and `existsByUniqueFields` methods,
 * plus light coverage of inherited BaseRepository methods against the real `users` table.
 *
 * Thorough BaseRepository CRUD coverage is in base.repository.integration.test.ts.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { UserFactory } from '../test-support/factories/user.factory';
import { UserOrgFactory } from '../test-support/factories/user-org.factory';
import { OrgFactory } from '../test-support/factories/org.factory';
import { ClassFactory } from '../test-support/factories/class.factory';
import { UserClassFactory } from '../test-support/factories/user-class.factory';
import { UserGroupFactory } from '../test-support/factories/user-group.factory';
import { GroupFactory } from '../test-support/factories/group.factory';
import { FamilyFactory } from '../test-support/factories/family.factory';
import { UserFamilyFactory } from '../test-support/factories/user-family.factory';
import { UserRole } from '../enums/user-role.enum';
import { OrgType } from '../enums/org-type.enum';
import { EntityType } from '../types/entity-type';
import { UserType } from '../enums/user-type.enum';
import { AuthProvider } from '../enums/auth-provider.enum';
import { UserRepository } from './user.repository';

describe('UserRepository', () => {
  let repository: UserRepository;

  beforeAll(() => {
    repository = new UserRepository();
  });

  describe('findByAuthId', () => {
    it('returns user when found by authId', async () => {
      const result = await repository.findByAuthId(baseFixture.districtAdmin.authId!);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.districtAdmin.id);
      expect(result!.authId).toBe(baseFixture.districtAdmin.authId);
    });

    it('returns null for nonexistent authId', async () => {
      const result = await repository.findByAuthId('nonexistent-auth-id-xyz');

      expect(result).toBeNull();
    });
  });

  describe('getById', () => {
    it('returns user', async () => {
      const result = await repository.getById({ id: baseFixture.schoolAStudent.id });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.schoolAStudent.id);
    });
  });

  describe('create (inherited)', () => {
    it('creates user', async () => {
      const userData = UserFactory.build();
      const result = await repository.create({ data: userData });

      expect(result).not.toBeNull();
      expect(result.id).toBeDefined();
    });
  });

  describe('getUserEntityMemberships', () => {
    it('returns org memberships with mapped entity types', async () => {
      // districtAdmin has a district-level org membership via baseFixture
      const result = await repository.getUserEntityMemberships(baseFixture.districtAdmin.id);

      const orgMemberships = result.filter((m) => m.entityType === 'district' || m.entityType === 'school');
      expect(orgMemberships.length).toBeGreaterThan(0);

      // Verify the district membership is present
      const districtMembership = result.find((m) => m.entityId === baseFixture.district.id);
      expect(districtMembership).toBeDefined();
      expect(districtMembership!.entityType).toBe('district');
    });

    it('returns class memberships', async () => {
      // classAStudent has a direct class membership via baseFixture
      const result = await repository.getUserEntityMemberships(baseFixture.classAStudent.id);

      const classMemberships = result.filter((m) => m.entityType === 'class');
      expect(classMemberships.length).toBeGreaterThan(0);

      const classMembership = result.find((m) => m.entityId === baseFixture.classInSchoolA.id);
      expect(classMembership).toBeDefined();
      expect(classMembership!.entityType).toBe('class');
    });

    it('returns group memberships', async () => {
      // groupStudent has a group membership via baseFixture
      const result = await repository.getUserEntityMemberships(baseFixture.groupStudent.id);

      const groupMemberships = result.filter((m) => m.entityType === 'group');
      expect(groupMemberships.length).toBeGreaterThan(0);
    });

    it('returns family memberships', async () => {
      const parent = await UserFactory.create({ dob: '1985-01-01' });
      const family = await FamilyFactory.create();
      await UserFamilyFactory.create({ userId: parent.id, familyId: family.id, role: 'parent' });

      const result = await repository.getUserEntityMemberships(parent.id);

      const familyMemberships = result.filter((m) => m.entityType === 'family');
      expect(familyMemberships).toHaveLength(1);
      expect(familyMemberships[0]!.entityId).toBe(family.id);
    });

    it('returns memberships across all entity types for multi-assigned user', async () => {
      const user = await UserFactory.create();
      const family = await FamilyFactory.create();

      await UserOrgFactory.create({
        userId: user.id,
        orgId: baseFixture.district.id,
        role: UserRole.ADMINISTRATOR,
      });
      await UserClassFactory.create({
        userId: user.id,
        classId: baseFixture.classInSchoolA.id,
        role: UserRole.TEACHER,
      });
      await UserFamilyFactory.create({ userId: user.id, familyId: family.id, role: 'parent' });

      const result = await repository.getUserEntityMemberships(user.id);

      const entityTypes = new Set(result.map((m) => m.entityType));
      expect(entityTypes.has('district')).toBe(true);
      expect(entityTypes.has('class')).toBe(true);
      expect(entityTypes.has('family')).toBe(true);
    });

    it('returns empty array for user with no active memberships', async () => {
      // unassignedUser has no junction table entries
      const result = await repository.getUserEntityMemberships(baseFixture.unassignedUser.id);

      expect(result).toHaveLength(0);
    });

    it('excludes expired enrollments', async () => {
      const result = await repository.getUserEntityMemberships(baseFixture.expiredEnrollmentStudent.id);

      // Expired enrollment student's enrollments are past endDate — should be excluded
      // by isEnrollmentActive filter
      const districtMembership = result.find((m) => m.entityId === baseFixture.district.id);
      expect(districtMembership).toBeUndefined();
    });

    it('excludes future enrollments', async () => {
      const result = await repository.getUserEntityMemberships(baseFixture.futureEnrollmentStudent.id);

      // Future enrollment student's enrollments haven't started yet — should be excluded
      const districtMembership = result.find((m) => m.entityId === baseFixture.district.id);
      expect(districtMembership).toBeUndefined();
    });
  });

  describe('hasPlatformAdminRole', () => {
    it('returns true for an active platform_admin org membership', async () => {
      const user = await UserFactory.create();
      await UserOrgFactory.create({
        userId: user.id,
        orgId: baseFixture.district.id,
        role: UserRole.PLATFORM_ADMIN,
      });

      const result = await repository.hasPlatformAdminRole(user.id);

      expect(result).toBe(true);
    });

    it('returns true for an active platform_admin group membership', async () => {
      const user = await UserFactory.create();
      await UserGroupFactory.create({
        userId: user.id,
        groupId: baseFixture.group.id,
        role: UserRole.PLATFORM_ADMIN,
      });

      const result = await repository.hasPlatformAdminRole(user.id);

      expect(result).toBe(true);
    });

    it('returns false for a user holding only non-platform-admin roles', async () => {
      const user = await UserFactory.create();
      await UserOrgFactory.create({
        userId: user.id,
        orgId: baseFixture.district.id,
        role: UserRole.ADMINISTRATOR,
      });

      const result = await repository.hasPlatformAdminRole(user.id);

      expect(result).toBe(false);
    });

    it('returns false when the platform_admin enrollment has expired', async () => {
      const user = await UserFactory.create();
      await UserOrgFactory.create({
        userId: user.id,
        orgId: baseFixture.district.id,
        role: UserRole.PLATFORM_ADMIN,
        enrollmentStart: new Date('2020-01-01T00:00:00Z'),
        enrollmentEnd: new Date('2021-01-01T00:00:00Z'),
      });

      const result = await repository.hasPlatformAdminRole(user.id);

      expect(result).toBe(false);
    });

    it('returns false when the platform_admin enrollment is in the future', async () => {
      const user = await UserFactory.create();
      await UserOrgFactory.create({
        userId: user.id,
        orgId: baseFixture.district.id,
        role: UserRole.PLATFORM_ADMIN,
        enrollmentStart: new Date('2999-01-01T00:00:00Z'),
        enrollmentEnd: new Date('3000-01-01T00:00:00Z'),
      });

      const result = await repository.hasPlatformAdminRole(user.id);

      expect(result).toBe(false);
    });

    it('returns false when the platform_admin group enrollment has expired', async () => {
      const user = await UserFactory.create();
      await UserGroupFactory.create({
        userId: user.id,
        groupId: baseFixture.group.id,
        role: UserRole.PLATFORM_ADMIN,
        enrollmentStart: new Date('2020-01-01T00:00:00Z'),
        enrollmentEnd: new Date('2021-01-01T00:00:00Z'),
      });

      const result = await repository.hasPlatformAdminRole(user.id);

      expect(result).toBe(false);
    });

    it('returns false when the platform_admin org is rostered out', async () => {
      const user = await UserFactory.create();
      const rosteredOutOrg = await OrgFactory.create({ rosteringEnded: new Date('2021-01-01T00:00:00Z') });
      await UserOrgFactory.create({
        userId: user.id,
        orgId: rosteredOutOrg.id,
        role: UserRole.PLATFORM_ADMIN,
      });

      const result = await repository.hasPlatformAdminRole(user.id);

      expect(result).toBe(false);
    });

    it('returns false when the platform_admin group is rostered out', async () => {
      const user = await UserFactory.create();
      const rosteredOutGroup = await GroupFactory.create({ rosteringEnded: new Date('2021-01-01T00:00:00Z') });
      await UserGroupFactory.create({
        userId: user.id,
        groupId: rosteredOutGroup.id,
        role: UserRole.PLATFORM_ADMIN,
      });

      const result = await repository.hasPlatformAdminRole(user.id);

      expect(result).toBe(false);
    });

    it('returns false for a user with no memberships at all', async () => {
      const result = await repository.hasPlatformAdminRole(baseFixture.unassignedUser.id);

      expect(result).toBe(false);
    });
  });

  describe('findByEmails', () => {
    it('returns users matching the emails, case-insensitively', async () => {
      const user = await UserFactory.create({ email: 'Found.User@example.org' });

      const result = await repository.findByEmails(['found.user@EXAMPLE.org', 'missing@example.org']);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(user.id);
    });

    it('returns an empty array for empty input', async () => {
      expect(await repository.findByEmails([])).toEqual([]);
    });
  });

  describe('endAllOrgEnrollments', () => {
    /**
     * Read a user_groups row's raw enrollmentEnd. No repository method exposes it — the membership
     * getters are all active-only — and these tests assert on the stamped date itself.
     */
    const readGroupEnrollmentEnd = async (userId: string, groupId: string) => {
      const { CoreDbClient } = await import('../db/clients');
      const { userGroups } = await import('../db/schema');
      const { and, eq } = await import('drizzle-orm');

      const [row] = await CoreDbClient.select({ enrollmentEnd: userGroups.enrollmentEnd })
        .from(userGroups)
        .where(and(eq(userGroups.userId, userId), eq(userGroups.groupId, groupId)));
      return row?.enrollmentEnd ?? null;
    };

    it('ends every active org, class, and group enrollment but leaves the family membership active', async () => {
      const user = await UserFactory.create();
      const family = await FamilyFactory.create();
      const group = await GroupFactory.create();
      await UserOrgFactory.create({ userId: user.id, orgId: baseFixture.district.id, role: UserRole.ADMINISTRATOR });
      await UserGroupFactory.create({ userId: user.id, groupId: group.id, role: UserRole.STUDENT });
      await UserClassFactory.create({
        userId: user.id,
        classId: baseFixture.classInSchoolA.id,
        role: UserRole.TEACHER,
      });
      await UserFamilyFactory.create({ userId: user.id, familyId: family.id, role: 'parent' });

      expect(await repository.getUserEntityMemberships(user.id)).not.toHaveLength(0);

      await repository.endAllOrgEnrollments(user.id);

      expect(await repository.getActiveMembershipsWithRoles(user.id)).toEqual([
        { entityType: EntityType.FAMILY, entityId: family.id, role: 'parent' },
      ]);
    });

    it('is a no-op for a user with no enrollments', async () => {
      const user = await UserFactory.create();

      await expect(repository.endAllOrgEnrollments(user.id)).resolves.toBeUndefined();
      expect(await repository.getUserEntityMemberships(user.id)).toHaveLength(0);
    });

    it('ends a row whose enrollmentEnd is in the future', async () => {
      // Active per isEnrollmentActive, but not open-ended — matching only `enrollmentEnd IS NULL`
      // left it in place, and the FGA backfill would re-derive a currently-valid grant from it.
      const user = await UserFactory.create();
      const group = await GroupFactory.create();
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await UserGroupFactory.create({
        userId: user.id,
        groupId: group.id,
        role: UserRole.STUDENT,
        enrollmentEnd: nextWeek,
      });
      expect(await repository.getActiveMembershipsWithRoles(user.id)).toHaveLength(1);

      await repository.endAllOrgEnrollments(user.id);

      expect(await repository.getActiveMembershipsWithRoles(user.id)).toHaveLength(0);
    });

    it('ends a row whose enrollmentStart is in the future', async () => {
      // Not active yet, so it would have become active after the unenroll.
      const user = await UserFactory.create();
      const group = await GroupFactory.create();
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await UserGroupFactory.create({
        userId: user.id,
        groupId: group.id,
        role: UserRole.STUDENT,
        enrollmentStart: nextWeek,
      });

      await repository.endAllOrgEnrollments(user.id);

      // Stamped with an end date now, so the future start can never open a window.
      expect(await repository.getActiveMembershipsWithRoles(user.id)).toHaveLength(0);
      expect(await readGroupEnrollmentEnd(user.id, group.id)).not.toBeNull();
    });

    it('preserves the original end date on an already-ended row', async () => {
      const user = await UserFactory.create();
      const group = await GroupFactory.create();
      const lastYear = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      await UserGroupFactory.create({
        userId: user.id,
        groupId: group.id,
        role: UserRole.STUDENT,
        enrollmentEnd: lastYear,
      });

      await repository.endAllOrgEnrollments(user.id);

      expect((await readGroupEnrollmentEnd(user.id, group.id))?.getTime()).toBe(lastYear.getTime());
    });
  });

  describe('getActiveMembershipsWithRoles', () => {
    it('returns active memberships with their roles', async () => {
      const user = await UserFactory.create();
      await UserOrgFactory.create({ userId: user.id, orgId: baseFixture.district.id, role: UserRole.ADMINISTRATOR });

      const result = await repository.getActiveMembershipsWithRoles(user.id);

      const districtMembership = result.find((m) => m.entityId === baseFixture.district.id);
      expect(districtMembership).toMatchObject({ entityType: 'district', role: UserRole.ADMINISTRATOR });
    });

    it('excludes ended enrollments', async () => {
      const user = await UserFactory.create();
      await UserOrgFactory.create({ userId: user.id, orgId: baseFixture.district.id, role: UserRole.ADMINISTRATOR });
      await repository.endAllOrgEnrollments(user.id);

      expect(await repository.getActiveMembershipsWithRoles(user.id)).toHaveLength(0);
    });
  });

  describe('archiveUser', () => {
    it('stamps rosteringEnded on the user', async () => {
      const user = await UserFactory.create();
      expect((await repository.getById({ id: user.id }))!.rosteringEnded).toBeNull();

      await repository.archiveUser(user.id);

      expect((await repository.getById({ id: user.id }))!.rosteringEnded).not.toBeNull();
    });
  });

  describe('reconcileMemberships', () => {
    it('ends removed, adds new, and leaves unchanged memberships (per provided type)', async () => {
      const user = await UserFactory.create();
      const groupKept = await GroupFactory.create();
      const groupRemoved = await GroupFactory.create();
      const groupAdded = await GroupFactory.create();
      await UserGroupFactory.create({ userId: user.id, groupId: groupKept.id, role: UserRole.STUDENT });
      await UserGroupFactory.create({ userId: user.id, groupId: groupRemoved.id, role: UserRole.STUDENT });

      const current = await repository.getActiveMembershipsWithRoles(user.id);
      const desired = [
        { entityType: EntityType.GROUP, entityId: groupKept.id, role: 'student' },
        { entityType: EntityType.GROUP, entityId: groupAdded.id, role: 'student' },
      ];

      const result = await repository.runTransaction({
        fn: (tx) => repository.reconcileMemberships(user.id, desired, current, tx),
      });

      expect(result.removed.map((m) => m.entityId)).toEqual([groupRemoved.id]);
      expect(result.added.map((m) => m.entityId)).toEqual([groupAdded.id]);

      const afterIds = (await repository.getActiveMembershipsWithRoles(user.id)).map((m) => m.entityId);
      expect(afterIds).toEqual(expect.arrayContaining([groupKept.id, groupAdded.id]));
      expect(afterIds).not.toContain(groupRemoved.id);
    });

    it('reactivates a previously-ended membership via upsert', async () => {
      const user = await UserFactory.create();
      const group = await GroupFactory.create();
      await UserGroupFactory.create({ userId: user.id, groupId: group.id, role: UserRole.STUDENT });
      await repository.endAllOrgEnrollments(user.id);
      expect(await repository.getActiveMembershipsWithRoles(user.id)).toHaveLength(0);

      const desired = [{ entityType: EntityType.GROUP, entityId: group.id, role: 'student' }];
      await repository.runTransaction({
        fn: (tx) => repository.reconcileMemberships(user.id, desired, [], tx),
      });

      expect(await repository.getActiveMembershipsWithRoles(user.id)).toHaveLength(1);
    });

    it('reconciles family memberships via the joinedOn/leftOn columns', async () => {
      // Families use joinedOn/leftOn (not enrollmentStart/enrollmentEnd), so exercise that branch of
      // endMembershipRow and upsertMembershipRow directly.
      const user = await UserFactory.create();
      const familyKept = await FamilyFactory.create();
      const familyRemoved = await FamilyFactory.create();
      const familyAdded = await FamilyFactory.create();
      await UserFamilyFactory.create({ userId: user.id, familyId: familyKept.id, role: 'parent' });
      await UserFamilyFactory.create({ userId: user.id, familyId: familyRemoved.id, role: 'parent' });

      const current = await repository.getActiveMembershipsWithRoles(user.id);
      const desired = [
        { entityType: EntityType.FAMILY, entityId: familyKept.id, role: 'parent' },
        { entityType: EntityType.FAMILY, entityId: familyAdded.id, role: 'parent' },
      ];

      const result = await repository.runTransaction({
        fn: (tx) => repository.reconcileMemberships(user.id, desired, current, tx),
      });

      expect(result.removed.map((m) => m.entityId)).toEqual([familyRemoved.id]);
      expect(result.added.map((m) => m.entityId)).toEqual([familyAdded.id]);

      const afterIds = (await repository.getActiveMembershipsWithRoles(user.id)).map((m) => m.entityId);
      expect(afterIds).toEqual(expect.arrayContaining([familyKept.id, familyAdded.id]));
      expect(afterIds).not.toContain(familyRemoved.id);
    });
  });

  describe('findClassParentSchool', () => {
    it('returns the parent school id for a class that exists', async () => {
      const result = await repository.findClassParentSchool(baseFixture.classInSchoolA.id);

      expect(result).toBe(baseFixture.schoolA.id);
    });

    it('returns null for a non-existent class id', async () => {
      const result = await repository.findClassParentSchool('00000000-0000-0000-0000-000000000000');

      expect(result).toBeNull();
    });
  });

  describe('resolveDeclaredEntities', () => {
    const NO_IDS = { districts: [], schools: [], classes: [], groups: [] };
    const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

    it('resolves parent district for schools and parent school/district for classes', async () => {
      const result = await repository.resolveDeclaredEntities({
        ...NO_IDS,
        schools: [baseFixture.schoolA.id, baseFixture.schoolB.id],
        classes: [baseFixture.classInSchoolA.id],
      });

      expect(result.schools.get(baseFixture.schoolA.id)).toEqual({ districtId: baseFixture.district.id });
      expect(result.schools.get(baseFixture.schoolB.id)).toEqual({ districtId: baseFixture.district.id });
      expect(result.classes.get(baseFixture.classInSchoolA.id)).toEqual({
        schoolId: baseFixture.schoolA.id,
        districtId: baseFixture.district.id,
      });
    });

    it('resolves districts and groups as existence-only sets', async () => {
      const result = await repository.resolveDeclaredEntities({
        ...NO_IDS,
        districts: [baseFixture.district.id],
        groups: [baseFixture.group.id],
      });

      expect(result.districts.has(baseFixture.district.id)).toBe(true);
      expect(result.groups.has(baseFixture.group.id)).toBe(true);
    });

    it('resolves orgs across separate district branches independently', async () => {
      const result = await repository.resolveDeclaredEntities({
        ...NO_IDS,
        classes: [baseFixture.classInDistrictB.id],
      });

      expect(result.classes.get(baseFixture.classInDistrictB.id)).toMatchObject({
        districtId: baseFixture.districtB.id,
      });
    });

    it('omits a district id passed in the schools list, and vice versa (wrong org type)', async () => {
      const asSchool = await repository.resolveDeclaredEntities({ ...NO_IDS, schools: [baseFixture.district.id] });
      expect(asSchool.schools.size).toBe(0);

      const asDistrict = await repository.resolveDeclaredEntities({ ...NO_IDS, districts: [baseFixture.schoolA.id] });
      expect(asDistrict.districts.size).toBe(0);
    });

    it('omits a rostered-out school', async () => {
      const school = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        parentOrgId: baseFixture.district.id,
        rosteringEnded: new Date(),
      });

      const result = await repository.resolveDeclaredEntities({ ...NO_IDS, schools: [school.id] });

      expect(result.schools.has(school.id)).toBe(false);
    });

    it('omits a rostered-out class', async () => {
      const cls = await ClassFactory.create({
        schoolId: baseFixture.schoolA.id,
        districtId: baseFixture.district.id,
        rosteringEnded: new Date(),
      });

      const result = await repository.resolveDeclaredEntities({ ...NO_IDS, classes: [cls.id] });

      expect(result.classes.has(cls.id)).toBe(false);
    });

    it('omits a rostered-out group', async () => {
      const group = await GroupFactory.create({ rosteringEnded: new Date() });

      const result = await repository.resolveDeclaredEntities({ ...NO_IDS, groups: [group.id] });

      expect(result.groups.has(group.id)).toBe(false);
    });

    it('omits unknown ids and returns empty results when given no ids', async () => {
      const unknown = await repository.resolveDeclaredEntities({
        districts: [UNKNOWN_ID],
        schools: [UNKNOWN_ID],
        classes: [UNKNOWN_ID],
        groups: [UNKNOWN_ID],
      });
      expect(unknown.districts.size).toBe(0);
      expect(unknown.schools.size).toBe(0);
      expect(unknown.classes.size).toBe(0);
      expect(unknown.groups.size).toBe(0);

      const empty = await repository.resolveDeclaredEntities(NO_IDS);
      expect(empty.districts.size).toBe(0);
      expect(empty.schools.size).toBe(0);
      expect(empty.classes.size).toBe(0);
      expect(empty.groups.size).toBe(0);
    });
  });

  describe('existsByUniqueFields', () => {
    it('returns true when email matches an existing user', async () => {
      const result = await repository.existsByUniqueFields({
        email: baseFixture.districtAdmin.email!,
      });

      expect(result).toBe(true);
    });

    it('returns true when the assessmentPid matches an existing user', async () => {
      const result = await repository.existsByUniqueFields({
        assessmentPid: baseFixture.districtAdmin.assessmentPid!,
      });

      expect(result).toBe(true);
    });

    it('returns false when no fields match any user', async () => {
      const result = await repository.existsByUniqueFields({
        email: 'nobody@example.com',
        assessmentPid: 'nonexistent-pid',
      });

      expect(result).toBe(false);
    });

    it('returns false when called with no fields', async () => {
      const result = await repository.existsByUniqueFields({});

      expect(result).toBe(false);
    });
  });

  describe('createWithMemberships', () => {
    const enrollmentStart = new Date('2025-01-01T00:00:00Z');

    it('creates user row and org memberships atomically', async () => {
      const email = `create-with-orgs-${Date.now()}@example.com`;

      const result = await repository.runTransaction({
        fn: (tx) =>
          repository.createWithMemberships(
            {
              email,
              assessmentPid: `pid-${email}`,
              authId: `firebase-uid-${email}`,
              authProvider: [AuthProvider.PASSWORD],
              nameFirst: 'Test',
              nameLast: 'User',
              userType: UserType.STUDENT,
            },
            [{ orgId: baseFixture.district.id, role: UserRole.STUDENT as UserRole, enrollmentStart }],
            [],
            [],
            tx,
          ),
      });

      expect(result.id).toBeDefined();

      const created = await repository.getById({ id: result.id });
      expect(created).not.toBeNull();
      expect(created!.email).toBe(email);

      const memberships = await repository.getUserEntityMemberships(result.id);
      const districtMembership = memberships.find((m) => m.entityId === baseFixture.district.id);
      expect(districtMembership).toBeDefined();
    });

    it('creates user row and class, group memberships', async () => {
      const email = `create-multi-${Date.now()}@example.com`;
      const group = await GroupFactory.create();

      const result = await repository.runTransaction({
        fn: (tx) =>
          repository.createWithMemberships(
            {
              email,
              assessmentPid: `pid-${email}`,
              authProvider: [AuthProvider.PASSWORD],
              nameFirst: 'Multi',
              nameLast: 'Member',
              userType: UserType.STUDENT,
            },
            [],
            [{ classId: baseFixture.classInSchoolA.id, role: UserRole.STUDENT as UserRole, enrollmentStart }],
            [{ groupId: group.id, role: UserRole.STUDENT as UserRole, enrollmentStart }],
            tx,
          ),
      });

      expect(result.id).toBeDefined();

      const memberships = await repository.getUserEntityMemberships(result.id);
      const classMembership = memberships.find((m) => m.entityId === baseFixture.classInSchoolA.id);
      const groupMembership = memberships.find((m) => m.entityId === group.id);

      expect(classMembership).toBeDefined();
      expect(groupMembership).toBeDefined();
    });

    it('creates user row with org, class, and group memberships atomically', async () => {
      const email = `create-all-types-${Date.now()}@example.com`;
      const group = await GroupFactory.create();

      const result = await repository.runTransaction({
        fn: (tx) =>
          repository.createWithMemberships(
            {
              email,
              assessmentPid: `pid-${email}`,
              authProvider: [AuthProvider.PASSWORD],
              nameFirst: 'All',
              nameLast: 'Types',
              userType: UserType.STUDENT,
            },
            [{ orgId: baseFixture.district.id, role: UserRole.STUDENT as UserRole, enrollmentStart }],
            [{ classId: baseFixture.classInSchoolA.id, role: UserRole.STUDENT as UserRole, enrollmentStart }],
            [{ groupId: group.id, role: UserRole.STUDENT as UserRole, enrollmentStart }],
            tx,
          ),
      });

      expect(result.id).toBeDefined();

      const memberships = await repository.getUserEntityMemberships(result.id);
      const entityTypes = new Set(memberships.map((m) => m.entityType));
      expect(entityTypes.has('district')).toBe(true);
      expect(entityTypes.has('class')).toBe(true);
      expect(entityTypes.has('group')).toBe(true);
      // Family membership is written by FamilyRepository, never by this method.
      expect(entityTypes.has('family')).toBe(false);
    });

    it('rolls back the entire transaction when a membership entityId is invalid', async () => {
      const email = `rollback-test-${Date.now()}@example.com`;

      await expect(
        repository.runTransaction({
          fn: (tx) =>
            repository.createWithMemberships(
              {
                email,
                assessmentPid: `pid-${email}`,
                authProvider: [AuthProvider.PASSWORD],
                nameFirst: 'Rollback',
                nameLast: 'Test',
                userType: UserType.STUDENT,
              },
              [{ orgId: '00000000-0000-0000-0000-000000000099', role: UserRole.STUDENT as UserRole, enrollmentStart }],
              [],
              [],
              tx,
            ),
        }),
      ).rejects.toThrow();

      // The user row must NOT exist — transaction rolled back
      const [row] = await (
        await import('../db/clients')
      ).CoreDbClient.select()
        .from((await import('../db/schema')).users)
        .where((await import('drizzle-orm')).eq((await import('../db/schema')).users.email, email));

      expect(row).toBeUndefined();
    });

    it('throws on duplicate email (unique constraint)', async () => {
      const email = baseFixture.districtAdmin.email!;

      await expect(
        repository.runTransaction({
          fn: (tx) =>
            repository.createWithMemberships(
              {
                email,
                assessmentPid: `pid-unique-${Date.now()}`,
                authProvider: [AuthProvider.PASSWORD],
                nameFirst: 'Dup',
                nameLast: 'Email',
                userType: UserType.STUDENT,
              },
              [],
              [],
              [],
              tx,
            ),
        }),
      ).rejects.toThrow();
    });
  });
});
