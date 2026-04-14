/**
 * Route integration tests for /v1/groups endpoints.
 *
 * Tests the full HTTP lifecycle: middleware → controller → service → repository → DB.
 * Only Firebase token verification is mocked — everything else runs for real.

 * Authorization is tested by permission tier (resolved via OpenFGA):
 *   - superAdmin:  isSuperAdmin=true (bypasses all access control)
 *   - siteAdmin:   site_administrator → 403
 *   - admin:       administrator → 403
 *   - educator:    teacher → 403
 *   - student:     student → 403
 *   - caregiver:   guardian → 403
 *
 * The invitation code endpoint is restricted to super admins only.
 *
 * Each endpoint section follows the structure:
 *   1. Authorization — one spec per tier with status + content assertions
 *   2. Error cases — 401 unauthenticated, 404 not found
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type express from 'express';
import { CoreDbClient } from '../db/clients';
import { invitationCodes } from '../db/schema';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { UserRole } from '../enums/user-role.enum';
import {
  createTestApp,
  createRouteHelper,
  createTierUsers,
  createGroupTierUsers,
} from '../test-support/route-test.helper';
import type { TierUsers } from '../test-support/route-test.helper';
import { baseFixture } from '../test-support/fixtures';
import { UserFactory } from '../test-support/factories/user.factory';
import { GroupFactory } from '../test-support/factories/group.factory';
import { UserGroupFactory } from '../test-support/factories/user-group.factory';
import { UserType } from '../enums/user-type.enum';
import type { EnrolledUser } from '@roar-dashboard/api-contract';

// ═══════════════════════════════════════════════════════════════════════════
// Test setup
// ═══════════════════════════════════════════════════════════════════════════

let app: express.Application;
let expectRoute: ReturnType<typeof createRouteHelper>;
let tiers: TierUsers;
let userGroupTiers: TierUsers;

/** Group ID with a seeded invitation code for happy-path tests. */
let testGroupId: string;
let testUserGroupId: string;

beforeAll(async () => {
  // Route modules must be imported dynamically — they instantiate services at
  // import time, which capture CoreDbClient by value. This must happen after
  // vitest.setup.ts initializes the DB pools.
  const { registerGroupsRoutes } = await import('./groups');
  app = createTestApp(registerGroupsRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);

  const testUserGroup = await GroupFactory.create({ name: 'Test User Group' });
  testUserGroupId = testUserGroup.id;
  userGroupTiers = await createGroupTierUsers(testUserGroupId);

  // Seed a valid invitation code on the fixture group for happy-path tests
  testGroupId = baseFixture.group.id;
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await CoreDbClient.insert(invitationCodes).values({
    groupId: testGroupId,
    code: 'ROUTE-TEST-CODE',
    validFrom: yesterday,
    validTo: null,
  });

  // Re-sync FGA tuples to pick up tier users and group memberships created above
  const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');
  await syncFgaTuplesFromPostgres();
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/groups/:groupId/invitation-code
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/groups/:groupId/invitation-code', () => {
  const path = () => `/v1/groups/${testGroupId}/invitation-code`;

  describe('authorization', () => {
    it('superAdmin tier can retrieve the invitation code', async () => {
      const res = await expectRoute('GET', path()).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.groupId).toBe(testGroupId);
      expect(res.body.data.code).toBe('ROUTE-TEST-CODE');
    });

    it('siteAdmin tier is forbidden from retrieving invitation codes', async () => {
      const res = await expectRoute('GET', path()).as(tiers.siteAdmin).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('admin tier is forbidden from retrieving invitation codes', async () => {
      const res = await expectRoute('GET', path()).as(tiers.admin).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('educator tier is forbidden from retrieving invitation codes', async () => {
      const res = await expectRoute('GET', path()).as(tiers.educator).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('student tier is forbidden from retrieving invitation codes', async () => {
      const res = await expectRoute('GET', path()).as(tiers.student).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier is forbidden from retrieving invitation codes', async () => {
      const res = await expectRoute('GET', path()).as(tiers.caregiver).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', path()).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 when group has no valid invitation code', async () => {
      // Use a group with no invitation codes seeded — create a fresh group via the factory
      const { GroupFactory } = await import('../test-support/factories/group.factory');
      const emptyGroup = await GroupFactory.create({ name: 'No Codes Group' });

      const res = await expectRoute('GET', `/v1/groups/${emptyGroup.id}/invitation-code`)
        .as(tiers.superAdmin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/groups/:groupId/users
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/groups/:groupId/users', () => {
  const testUserGroupParam = () => testUserGroupId;
  const testUserGroupPath = () => `/v1/groups/${testUserGroupParam()}/users`;

  describe('authorization', () => {
    it('superAdmin tier can list users in a group', async () => {
      await UserGroupFactory.create({
        userId: baseFixture.expiredEnrollmentStudent.id,
        groupId: testUserGroupId,
        role: UserRole.STUDENT,
        enrollmentStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        enrollmentEnd: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });

      await UserGroupFactory.create({
        userId: baseFixture.groupStudent.id,
        groupId: testUserGroupId,
        role: UserRole.STUDENT,
      });

      const res = await expectRoute('GET', testUserGroupPath()).as(userGroupTiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toBeDefined();

      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      // Super admin sees all active users in the group
      expect(userIds).toContain(baseFixture.groupStudent.id);
      // Expired enrollment should not be included
      expect(userIds).not.toContain(baseFixture.expiredEnrollmentStudent.id);
    });

    const tierConfigs = [
      { name: 'siteAdmin', getTier: () => userGroupTiers.siteAdmin },
      { name: 'admin', getTier: () => userGroupTiers.admin },
      { name: 'educator', getTier: () => userGroupTiers.educator },
    ];

    tierConfigs.forEach(({ name: tierName, getTier }) => {
      it(`${tierName} tier can list users in a group`, async () => {
        const tier = getTier(); // Get the actual tier at runtime
        const res = await expectRoute('GET', testUserGroupPath()).as(tier).toReturn(200);

        expect(res.body.data.items).toBeInstanceOf(Array);
        expect(res.body.data.items.length).toBeGreaterThan(0);
      });
    });

    const forbiddenTierConfigs = [
      { name: 'student', getTier: () => userGroupTiers.student },
      { name: 'caregiver', getTier: () => userGroupTiers.caregiver },
    ];

    forbiddenTierConfigs.forEach(({ name: tierName, getTier }) => {
      it(`${tierName} tier is forbidden from listing users in groups`, async () => {
        const tier = getTier();
        const res = await expectRoute('GET', testUserGroupPath()).as(tier).toReturn(403);

        expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
      });
    });
  });

  describe('query parameters', () => {
    // Test group with multiple users of different grades and roles
    let filterTestGroup: Awaited<ReturnType<typeof GroupFactory.create>>;

    beforeAll(async () => {
      // Create a dedicated group for filter tests
      filterTestGroup = await GroupFactory.create({ name: 'Filter Test Group' });

      // Create users with specific grades and enroll them
      const usersToCreate = [
        { grade: '5' as const, role: UserRole.STUDENT },
        { grade: '5' as const, role: UserRole.STUDENT },
        { grade: '3' as const, role: UserRole.STUDENT },
        { grade: '7' as const, role: UserRole.STUDENT },
        { grade: null, role: UserRole.ADMINISTRATOR },
      ];

      const createdUsers = await Promise.all(
        usersToCreate.map(({ grade }) =>
          UserFactory.create({ userType: grade ? UserType.STUDENT : UserType.ADMIN, grade }),
        ),
      );

      await Promise.all(
        createdUsers.map((user, i) =>
          UserGroupFactory.create({ userId: user.id, groupId: filterTestGroup.id, role: usersToCreate[i]!.role }),
        ),
      );
    });

    const filterPath = () => `/v1/groups/${filterTestGroup.id}/users`;

    it('filters users by role parameter', async () => {
      const res = await expectRoute('GET', `${filterPath()}?role=student`).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      res.body.data.items.forEach((user: EnrolledUser) => {
        expect(user.roles).toContain('student');
      });
    });

    it('filters users by single grade parameter', async () => {
      const res = await expectRoute('GET', `${filterPath()}?grade=5`).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      res.body.data.items.forEach((user: EnrolledUser) => {
        expect(user.grade).toBe('5');
      });
    });

    it('filters users by multiple grades with comma-separated values', async () => {
      const res = await expectRoute('GET', `${filterPath()}?grade=3,7`).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      res.body.data.items.forEach((user: EnrolledUser) => {
        expect(['3', '7']).toContain(user.grade);
      });
    });

    it('combines role and grade filters', async () => {
      const res = await expectRoute('GET', `${filterPath()}?role=student&grade=5`).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      res.body.data.items.forEach((user: EnrolledUser) => {
        expect(user.roles).toContain('student');
        expect(user.grade).toBe('5');
      });
    });

    it('returns empty array when no users match filter', async () => {
      const res = await expectRoute('GET', `${filterPath()}?grade=12`).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items).toHaveLength(0);
    });

    it('supports pagination with page and perPage parameters', async () => {
      const paginationGroup = await GroupFactory.create({ name: 'Pagination Group' });

      await Promise.all([
        UserGroupFactory.create({
          userId: userGroupTiers.student.id,
          groupId: filterTestGroup.id,
          role: UserRole.STUDENT,
        }),
        UserGroupFactory.create({
          userId: userGroupTiers.admin.id,
          groupId: paginationGroup.id,
          role: UserRole.ADMINISTRATOR,
        }),
      ]);

      // Re-sync FGA so the admin's membership on the new group is recognized
      const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');
      await syncFgaTuplesFromPostgres();

      const res = await expectRoute('GET', `/v1/groups/${paginationGroup.id}/users?page=1&perPage=1`)
        .as(userGroupTiers.admin)
        .toReturn(200);

      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.perPage).toBe(2);
      expect(res.body.data.pagination.totalItems).toBeGreaterThan(0);
      expect(res.body.data.pagination.totalPages).toBeGreaterThan(0);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', testUserGroupPath()).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 403 when user does not have access to group', async () => {
      const res = await expectRoute('GET', testUserGroupPath()).as(tiers.admin).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 403 when user is admin of a different group', async () => {
      const groupB = await GroupFactory.create({ name: 'Isolated Group B' });
      const isolatedUser = await UserFactory.create({
        nameFirst: 'Isolated',
        nameLast: 'Admin',
        email: 'isolated-admin@example.com',
      });
      await UserGroupFactory.create({
        userId: isolatedUser.id,
        groupId: groupB.id,
        role: UserRole.ADMINISTRATOR,
      });
      const res = await expectRoute('GET', testUserGroupPath())
        .as({ id: isolatedUser.id, authId: isolatedUser.authId! })
        .toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 404 when group does not exist', async () => {
      const res = await expectRoute('GET', '/v1/groups/00000000-0000-0000-0000-000000000000/users')
        .as(tiers.admin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });
  });
});
