/**
 * Route integration tests for /v1/families endpoints.
 *
 * Tests the full HTTP lifecycle: middleware → controller → service → repository → DB.
 * Only Firebase token verification is mocked — everything else runs for real.
 *
 * Authorization is tested by permission tier (resolved via OpenFGA):
 *   - superAdmin:  isSuperAdmin=true (bypasses all access control)
 *   - parent:      parent role in family → can list users
 *   - child:       child role in family → 403
 *   - nonMember:   no relationship to family → 403
 *
 * Each endpoint section follows the structure:
 *   1. Authorization — one spec per tier with status + content assertions
 *   2. Error cases — 401 unauthenticated, 404 not found
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type express from 'express';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { createTestApp, createRouteHelper } from '../test-support/route-test.helper';
import { UserFactory } from '../test-support/factories/user.factory';
import { FamilyFactory } from '../test-support/factories/family.factory';
import { UserFamilyFactory } from '../test-support/factories/user-family.factory';
import type { EnrolledFamilyUserEntity } from '../types/user';

// ═══════════════════════════════════════════════════════════════════════════
// Test setup
// ═══════════════════════════════════════════════════════════════════════════

let app: express.Application;
let expectRoute: ReturnType<typeof createRouteHelper>;

let testFamilyId: string;
let superAdmin: { id: string; authId: string };
let parent: { id: string; authId: string };
let child: { id: string; authId: string };
let nonMember: { id: string; authId: string };

beforeAll(async () => {
  // Route modules must be imported dynamically — they instantiate services at
  // import time, which capture CoreDbClient by value. This must happen after
  // vitest.setup.ts initializes the DB pools.
  const { registerFamiliesRoutes } = await import('./families');
  app = createTestApp(registerFamiliesRoutes);
  expectRoute = createRouteHelper(app);

  // Create test family and users
  const testFamily = await FamilyFactory.create();
  testFamilyId = testFamily.id;

  // Create users with different roles
  const superAdminUser = await UserFactory.create({
    nameFirst: 'Super',
    nameLast: 'Admin',
    email: 'superadmin@example.com',
    isSuperAdmin: true,
  });
  superAdmin = { id: superAdminUser.id, authId: superAdminUser.authId! };

  const parentUser = await UserFactory.create({
    nameFirst: 'Parent',
    nameLast: 'User',
    email: 'parent@example.com',
  });
  parent = { id: parentUser.id, authId: parentUser.authId! };

  const childUser = await UserFactory.create({
    nameFirst: 'Child',
    nameLast: 'User',
    email: 'child@example.com',
  });
  child = { id: childUser.id, authId: childUser.authId! };

  const nonMemberUser = await UserFactory.create({
    nameFirst: 'Non',
    nameLast: 'Member',
    email: 'nonmember@example.com',
  });
  nonMember = { id: nonMemberUser.id, authId: nonMemberUser.authId! };

  // Create family memberships
  await UserFamilyFactory.create({
    userId: parent.id,
    familyId: testFamilyId,
    role: 'parent',
  });

  await UserFamilyFactory.create({
    userId: child.id,
    familyId: testFamilyId,
    role: 'child',
  });

  // Re-sync FGA tuples to pick up family memberships created above
  const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');
  await syncFgaTuplesFromPostgres();
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/families/:familyId/users
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/families/:familyId/users', () => {
  const testFamilyPath = () => `/v1/families/${testFamilyId}/users`;

  describe('authorization', () => {
    it('superAdmin tier can list users in a family', async () => {
      const res = await expectRoute('GET', testFamilyPath()).as(superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toBeDefined();

      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      // Super admin sees all active users in the family
      expect(userIds).toContain(parent.id);
      expect(userIds).toContain(child.id);
    });

    it('parent tier can list users in their family', async () => {
      const res = await expectRoute('GET', testFamilyPath()).as(parent).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);

      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      expect(userIds).toContain(parent.id);
      expect(userIds).toContain(child.id);
    });

    it('child tier is forbidden from listing users in family', async () => {
      const res = await expectRoute('GET', testFamilyPath()).as(child).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('non-member is forbidden from listing users in family', async () => {
      const res = await expectRoute('GET', testFamilyPath()).as(nonMember).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('query parameters', () => {
    it('filters users by role parameter (parent)', async () => {
      const res = await expectRoute('GET', `${testFamilyPath()}?role=parent`).as(parent).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      res.body.data.items.forEach((user: EnrolledFamilyUserEntity) => {
        expect(user.roles).toContain('parent');
      });
    });

    it('filters users by role parameter (child)', async () => {
      const res = await expectRoute('GET', `${testFamilyPath()}?role=child`).as(parent).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      res.body.data.items.forEach((user: EnrolledFamilyUserEntity) => {
        expect(user.roles).toContain('child');
      });
    });

    it('filters users by grade parameter', async () => {
      const grade5Child = await UserFactory.create({
        nameFirst: 'Grade 5',
        nameLast: 'Child',
        email: 'grade5child@example.com',
        grade: '5',
      });

      const grade3Child = await UserFactory.create({
        nameFirst: 'Grade 3',
        nameLast: 'Child',
        email: 'grade3child@example.com',
        grade: '3',
      });

      await Promise.all([
        UserFamilyFactory.create({ userId: grade5Child.id, familyId: testFamilyId, role: 'child' }),
        UserFamilyFactory.create({ userId: grade3Child.id, familyId: testFamilyId, role: 'child' }),
      ]);

      const res = await expectRoute('GET', `${testFamilyPath()}?grade=5`).as(parent).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      // Should only return users in grade 5
      res.body.data.items.forEach((user: EnrolledFamilyUserEntity) => {
        expect(user.grade).toBe('5');
      });
    });

    it('combines role and grade filters', async () => {
      const grade2Child = await UserFactory.create({
        nameFirst: 'Grade 2',
        nameLast: 'Child',
        email: 'grade2child@example.com',
        grade: '2',
      });

      await UserFamilyFactory.create({ userId: grade2Child.id, familyId: testFamilyId, role: 'child' });

      const res = await expectRoute('GET', `${testFamilyPath()}?grade=2&role=child`).as(parent).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      // Should only contain grade 2 children
      res.body.data.items.forEach((user: EnrolledFamilyUserEntity) => {
        expect(user.roles).toContain('child');
        expect(user.grade).toBe('2');
      });
    });

    it('supports pagination with page and perPage parameters', async () => {
      const paginationFamily = await FamilyFactory.create();
      const paginationParent = await UserFactory.create({
        nameFirst: 'Pagination',
        nameLast: 'Parent',
        email: 'paginationparent@example.com',
      });

      await UserFamilyFactory.create({
        userId: paginationParent.id,
        familyId: paginationFamily.id,
        role: 'parent',
      });

      const child1 = await UserFactory.create({
        nameFirst: 'Child',
        nameLast: 'One',
        email: 'child1@example.com',
      });
      const child2 = await UserFactory.create({
        nameFirst: 'Child',
        nameLast: 'Two',
        email: 'child2@example.com',
      });

      await Promise.all([
        UserFamilyFactory.create({ userId: child1.id, familyId: paginationFamily.id, role: 'child' }),
        UserFamilyFactory.create({ userId: child2.id, familyId: paginationFamily.id, role: 'child' }),
      ]);

      // Re-sync FGA so the parent's membership on the new family is recognized
      const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');
      await syncFgaTuplesFromPostgres();

      const res = await expectRoute('GET', `/v1/families/${paginationFamily.id}/users?page=1&perPage=1`)
        .as({ id: paginationParent.id, authId: paginationParent.authId! })
        .toReturn(200);

      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.perPage).toBe(1);
      expect(res.body.data.pagination.totalItems).toBe(3);
      expect(res.body.data.pagination.totalPages).toBe(3);
    });

    it('excludes users with expired family membership', async () => {
      const expiredChild = await UserFactory.create({
        nameFirst: 'Expired',
        nameLast: 'Child',
        email: 'expiredchild@example.com',
      });

      await UserFamilyFactory.create({
        userId: expiredChild.id,
        familyId: testFamilyId,
        role: 'child',
        joinedOn: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        leftOn: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });

      const res = await expectRoute('GET', testFamilyPath()).as(parent).toReturn(200);

      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      // Expired membership should not be included
      expect(userIds).not.toContain(expiredChild.id);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', testFamilyPath()).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 403 when user does not have access to family', async () => {
      const otherFamily = await FamilyFactory.create();
      const res = await expectRoute('GET', `/v1/families/${otherFamily.id}/users`).as(parent).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 403 when user is parent of a different family', async () => {
      const familyB = await FamilyFactory.create();
      const isolatedParent = await UserFactory.create({
        nameFirst: 'Isolated',
        nameLast: 'Parent',
        email: 'isolated-parent@example.com',
      });
      await UserFamilyFactory.create({
        userId: isolatedParent.id,
        familyId: familyB.id,
        role: 'parent',
      });

      const res = await expectRoute('GET', testFamilyPath())
        .as({ id: isolatedParent.id, authId: isolatedParent.authId! })
        .toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 404 when family does not exist', async () => {
      const res = await expectRoute('GET', '/v1/families/00000000-0000-0000-0000-000000000000/users')
        .as(superAdmin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });
  });
});
