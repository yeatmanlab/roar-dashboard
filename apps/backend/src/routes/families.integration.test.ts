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
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type express from 'express';
import { and, eq } from 'drizzle-orm';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { createTestApp, createRouteHelper } from '../test-support/route-test.helper';
import { UserFactory } from '../test-support/factories/user.factory';
import { FamilyFactory } from '../test-support/factories/family.factory';
import { UserFamilyFactory } from '../test-support/factories/user-family.factory';
import { CoreDbClient } from '../test-support/db';
import { families, userFamilies, users } from '../db/schema';
import { rosteringProviderIds } from '../db/schema/core';
import { FirebaseAuthClient } from '../clients/firebase-auth.clients';
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
    grade: '5',
  });
  child = { id: childUser.id, authId: childUser.authId! };

  // Create additional children with different grades for filter testing
  const grade3Child = await UserFactory.create({
    nameFirst: 'Grade 3',
    nameLast: 'Child',
    email: 'grade3child@example.com',
    grade: '3',
  });

  const grade2Child = await UserFactory.create({
    nameFirst: 'Grade 2',
    nameLast: 'Child',
    email: 'grade2child@example.com',
    grade: '2',
  });

  const nonMemberUser = await UserFactory.create({
    nameFirst: 'Non',
    nameLast: 'Member',
    email: 'nonmember@example.com',
  });
  nonMember = { id: nonMemberUser.id, authId: nonMemberUser.authId! };

  // Create family memberships
  await Promise.all([
    UserFamilyFactory.create({
      userId: parent.id,
      familyId: testFamilyId,
      role: 'parent',
    }),
    UserFamilyFactory.create({
      userId: child.id,
      familyId: testFamilyId,
      role: 'child',
    }),
    UserFamilyFactory.create({
      userId: grade3Child.id,
      familyId: testFamilyId,
      role: 'child',
    }),
    UserFamilyFactory.create({
      userId: grade2Child.id,
      familyId: testFamilyId,
      role: 'child',
    }),
  ]);

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
      expect(res.body.data.items.length).toBeGreaterThan(0);
      res.body.data.items.forEach((user: EnrolledFamilyUserEntity) => {
        expect(user.roles).toContain('parent');
      });
    });

    it('filters users by role parameter (child)', async () => {
      const res = await expectRoute('GET', `${testFamilyPath()}?role=child`).as(parent).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      res.body.data.items.forEach((user: EnrolledFamilyUserEntity) => {
        expect(user.roles).toContain('child');
      });
    });

    it('filters users by grade parameter', async () => {
      const res = await expectRoute('GET', `${testFamilyPath()}?grade=5`).as(parent).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      // Should only return users in grade 5
      res.body.data.items.forEach((user: EnrolledFamilyUserEntity) => {
        expect(user.grade).toBe('5');
      });
    });

    it('combines role and grade filters', async () => {
      const res = await expectRoute('GET', `${testFamilyPath()}?grade=2&role=child`).as(parent).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      // Should only contain grade 2 children
      res.body.data.items.forEach((user: EnrolledFamilyUserEntity) => {
        expect(user.roles).toContain('child');
        expect(user.grade).toBe('2');
      });
    });

    it('supports pagination with page and perPage parameters', async () => {
      const res = await expectRoute('GET', `${testFamilyPath()}?page=1&perPage=1`).as(parent).toReturn(200);

      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.perPage).toBe(1);
      expect(res.body.data.pagination.totalItems).toBeGreaterThan(0);
      expect(res.body.data.pagination.totalPages).toBeGreaterThan(0);
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

// ═══════════════════════════════════════════════════════════════════════════
// POST /v1/families  (public ROAR@Home caretaker registration)
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /v1/families', () => {
  // Cast to access vi.fn() mock methods — firebase-admin/auth is mocked globally
  // in vitest.setup.ts.
  const mockAuth = FirebaseAuthClient as unknown as {
    createUser: ReturnType<typeof vi.fn>;
    getUserByEmail: ReturnType<typeof vi.fn>;
    deleteUser: ReturnType<typeof vi.fn>;
  };

  let emailSeq = 0;
  let firebaseUidSeq = 0;
  const makeEmail = (suffix: string) => `post-families-${++emailSeq}-${suffix}@test.example.com`;
  const makeUid = () => `fb-uid-post-families-${++firebaseUidSeq}`;

  const validBody = (suffix: string) => ({
    email: makeEmail(suffix),
    password: 'Password123!',
    name: { first: 'Pat', last: 'Parent' },
  });

  beforeEach(() => {
    // Default Firebase behavior: account doesn't exist; create succeeds.
    mockAuth.getUserByEmail.mockRejectedValue(Object.assign(new Error('Not found'), { code: 'auth/user-not-found' }));
    mockAuth.createUser.mockImplementation(async () => ({ uid: makeUid() }));
    mockAuth.deleteUser.mockResolvedValue(undefined);
  });

  describe('happy path', () => {
    it('creates the caretaker, family, user_families, and rostering_provider_ids rows', async () => {
      const body = validBody('happy');

      const res = await expectRoute('POST', '/v1/families').unauthenticated().withBody(body).toReturn(201);

      const newFamilyId: string = res.body.data.id;
      expect(newFamilyId).toMatch(/^[0-9a-f-]{36}$/);

      // Verify the family row exists and has the caretaker as created_by
      const [familyRow] = await CoreDbClient.select().from(families).where(eq(families.id, newFamilyId));
      expect(familyRow).toBeDefined();
      expect(familyRow!.createdBy).not.toBeNull();
      const caretakerId = familyRow!.createdBy!;

      // Caretaker user row
      const [userRow] = await CoreDbClient.select().from(users).where(eq(users.id, caretakerId));
      expect(userRow).toBeDefined();
      expect(userRow!.email).toBe(body.email);
      expect(userRow!.userType).toBe('caregiver');
      expect(userRow!.authProvider).toEqual(['password']);
      // assessmentPid is server-generated — verify it was set (deterministic from email, but the
      // test only needs to assert it's not null since the generator is exercised elsewhere)
      expect(userRow!.assessmentPid).not.toBeNull();

      // user_families junction row with role=parent
      const [ufRow] = await CoreDbClient.select()
        .from(userFamilies)
        .where(and(eq(userFamilies.userId, caretakerId), eq(userFamilies.familyId, newFamilyId)));
      expect(ufRow).toBeDefined();
      expect(ufRow!.role).toBe('parent');

      // rostering_provider_ids row
      const [rpRow] = await CoreDbClient.select()
        .from(rosteringProviderIds)
        .where(and(eq(rosteringProviderIds.entityType, 'user'), eq(rosteringProviderIds.entityId, caretakerId)));
      expect(rpRow).toBeDefined();
      expect(rpRow!.providerType).toBe('dashboard');
      expect(rpRow!.partnerId).toBe(newFamilyId);
    });

    it('passes the optional location through to the families row', async () => {
      const body = {
        ...validBody('location'),
        location: { city: 'Stanford', stateProvince: 'CA', country: 'US' },
      };

      const res = await expectRoute('POST', '/v1/families').unauthenticated().withBody(body).toReturn(201);

      const [familyRow] = await CoreDbClient.select().from(families).where(eq(families.id, res.body.data.id));
      expect(familyRow!.locationCity).toBe('Stanford');
      expect(familyRow!.locationStateProvince).toBe('CA');
      expect(familyRow!.locationCountry).toBe('US');
    });

    it('normalizes a lower-case country code to upper-case', async () => {
      const body = { ...validBody('lowercase-country'), location: { country: 'us' } };
      const res = await expectRoute('POST', '/v1/families').unauthenticated().withBody(body).toReturn(201);

      const [familyRow] = await CoreDbClient.select().from(families).where(eq(families.id, res.body.data.id));
      expect(familyRow!.locationCountry).toBe('US');
    });
  });

  describe('validation', () => {
    it('returns 400 for an invalid email', async () => {
      await expectRoute('POST', '/v1/families')
        .unauthenticated()
        .withBody({ ...validBody('invalid-email'), email: 'not-an-email' })
        .toReturn(400);
    });

    it('returns 400 for a too-short password', async () => {
      await expectRoute('POST', '/v1/families')
        .unauthenticated()
        .withBody({ ...validBody('short-pw'), password: 'short' })
        .toReturn(400);
    });

    it('returns 400 for an invalid country code (not 2 letters)', async () => {
      await expectRoute('POST', '/v1/families')
        .unauthenticated()
        .withBody({ ...validBody('bad-country'), location: { country: 'USA' } })
        .toReturn(400);
    });

    it('returns 400 for an unknown field in the request body (.strict() schema)', async () => {
      await expectRoute('POST', '/v1/families')
        .unauthenticated()
        .withBody({ ...validBody('strict'), unexpectedField: 'nope' })
        .toReturn(400);
    });
  });

  describe('conflicts', () => {
    it('returns 409 when the email is already in the users table', async () => {
      const existing = await UserFactory.create({ email: makeEmail('existing') });

      const body = { ...validBody('dup-db'), email: existing.email! };
      await expectRoute('POST', '/v1/families').unauthenticated().withBody(body).toReturn(409);
    });

    it('returns 409 when the email already exists in Firebase Auth', async () => {
      mockAuth.getUserByEmail.mockResolvedValue({ uid: 'pre-existing-fb-uid' });

      const body = validBody('dup-fb');
      await expectRoute('POST', '/v1/families').unauthenticated().withBody(body).toReturn(409);
    });

    it('returns 409 when Firebase rejects the create with auth/email-already-exists', async () => {
      // Pre-flight passes (no DB row, no Firebase row), but createUser races and returns the conflict.
      mockAuth.createUser.mockRejectedValueOnce(
        Object.assign(new Error('Account exists'), { code: 'auth/email-already-exists' }),
      );

      const body = validBody('dup-race');
      await expectRoute('POST', '/v1/families').unauthenticated().withBody(body).toReturn(409);
    });
  });

  describe('rate limiting', () => {
    it('returns 429 when Firebase rate-limits the createUser call', async () => {
      mockAuth.createUser.mockRejectedValueOnce(
        Object.assign(new Error('Rate limited'), { code: 'auth/too-many-requests' }),
      );

      const body = validBody('ratelimit');
      await expectRoute('POST', '/v1/families').unauthenticated().withBody(body).toReturn(429);
    });
  });

  describe('atomicity', () => {
    it('pre-flight short-circuits before Firebase when email already exists in DB', async () => {
      // The Firebase-created-then-DB-fails compensation path is covered by the unit tests;
      // at the integration level we verify the pre-flight DB check prevents Firebase writes
      // entirely when the email is already taken — the safer, no-orphan-record path.
      const conflictingUser = await UserFactory.create({ email: makeEmail('conflict-target') });

      const body = { ...validBody('atomicity'), email: conflictingUser.email! };
      const captured: { createUserCalled: boolean; deleteUserCalled: boolean } = {
        createUserCalled: false,
        deleteUserCalled: false,
      };
      mockAuth.createUser.mockImplementationOnce(async () => {
        captured.createUserCalled = true;
        return { uid: makeUid() };
      });
      mockAuth.deleteUser.mockImplementationOnce(async () => {
        captured.deleteUserCalled = true;
      });

      await expectRoute('POST', '/v1/families').unauthenticated().withBody(body).toReturn(409);

      // DB pre-flight short-circuited before Firebase — neither was called.
      expect(captured.createUserCalled).toBe(false);
      expect(captured.deleteUserCalled).toBe(false);
    });
  });
});
