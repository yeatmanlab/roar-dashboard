/**
 * Route integration tests for /v1/groups endpoints.
 *
 * Tests the full HTTP lifecycle: middleware → controller → service → repository → DB.
 * Only Firebase token verification is mocked — everything else runs for real.
 *
 * Authorization is tested by permission tier (matching RolePermissions groupings):
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
import { createTestApp, createRouteHelper, createTierUsers } from '../test-support/route-test.helper';
import type { TierUsers } from '../test-support/route-test.helper';
import { baseFixture } from '../test-support/fixtures';
import { ApiErrorCode } from '../enums/api-error-code.enum';

// ═══════════════════════════════════════════════════════════════════════════
// Test setup
// ═══════════════════════════════════════════════════════════════════════════

let app: express.Application;
let expectRoute: ReturnType<typeof createRouteHelper>;
let tiers: TierUsers;

/** Group ID with a seeded invitation code for happy-path tests. */
let testGroupId: string;

beforeAll(async () => {
  // Route modules must be imported dynamically — they instantiate services at
  // import time, which capture CoreDbClient by value. This must happen after
  // vitest.setup.ts initializes the DB pools.
  const { registerGroupsRoutes } = await import('./groups');

  app = createTestApp(registerGroupsRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);

  // Seed a valid invitation code on the fixture group for happy-path tests
  testGroupId = baseFixture.group.id;
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await CoreDbClient.insert(invitationCodes).values({
    groupId: testGroupId,
    code: 'ROUTE-TEST-CODE',
    validFrom: yesterday,
    validTo: null,
  });
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
