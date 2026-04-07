/**
 * Route integration tests for /v1/administrations endpoints.
 *
 * Tests the full HTTP lifecycle: middleware → controller → service → repository → DB.
 * Only Firebase token verification is mocked — everything else runs for real.
 *
 * Authorization is tested by permission tier (matching RolePermissions groupings):
 *   - superAdmin:  isSuperAdmin=true (bypasses all access control)
 *   - siteAdmin:   site_administrator
 *   - admin:       administrator
 *   - educator:    teacher
 *   - student:     student
 *   - caregiver:   guardian
 *
 * Each endpoint section follows the structure:
 *   1. Authorization — one spec per tier with status + content assertions
 *   2. Access filtering — cross-district isolation, scoped visibility
 *   3. Error cases — 401, 404, 403 (no access to resource)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type express from 'express';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import { authenticateAs, createTestApp, createRouteHelper, createTierUsers } from '../test-support/route-test.helper';
import type { TierUsers } from '../test-support/route-test.helper';
import { baseFixture } from '../test-support/fixtures';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { UserRole } from '../enums/user-role.enum';
import { UserFactory } from '../test-support/factories/user.factory';
import { UserOrgFactory } from '../test-support/factories/user-org.factory';
import { UserGroupFactory } from '../test-support/factories/user-group.factory';
import { AdministrationFactory } from '../test-support/factories/administration.factory';
import { AdministrationOrgFactory } from '../test-support/factories/administration-org.factory';
import { AgreementFactory } from '../test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../test-support/factories/agreement-version.factory';
import { AdministrationAgreementFactory } from '../test-support/factories/administration-agreement.factory';
import { RunFactory } from '../test-support/factories/run.factory';
import {
  writeFgaAdministrationAssignment,
  writeFgaOrgMembership,
  writeFgaGroupMembership,
} from '../test-support/fga/fga-test-tuples.helper';

// ═══════════════════════════════════════════════════════════════════════════
// Test setup
// ═══════════════════════════════════════════════════════════════════════════

let app: express.Application;
let expectRoute: ReturnType<typeof createRouteHelper>;
let tiers: TierUsers;

beforeAll(async () => {
  // Route modules must be imported dynamically — they instantiate services at
  // import time, which capture CoreDbClient by value. This must happen after
  // vitest.setup.ts initializes the DB pools.
  const { registerAdministrationsRoutes } = await import('./administrations');

  app = createTestApp(registerAdministrationsRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);

  // Re-sync FGA tuples to pick up tier users created above
  const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');
  await syncFgaTuplesFromPostgres();
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/administrations
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/administrations', () => {
  describe('authorization', () => {
    it('superAdmin tier can list all administrations across districts', async () => {
      const res = await expectRoute('GET', '/v1/administrations').as(tiers.superAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      // Super admin sees administrations from ALL districts
      expect(ids).toContain(baseFixture.administrationAssignedToDistrict.id);
      expect(ids).toContain(baseFixture.administrationAssignedToSchoolA.id);
      expect(ids).toContain(baseFixture.administrationAssignedToDistrictB.id);
    });

    it('siteAdmin tier can list administrations scoped to their district', async () => {
      const res = await expectRoute('GET', '/v1/administrations').as(tiers.siteAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.administrationAssignedToDistrict.id);
      expect(ids).toContain(baseFixture.administrationAssignedToSchoolA.id);
      expect(ids).toContain(baseFixture.administrationAssignedToSchoolB.id);
      expect(ids).not.toContain(baseFixture.administrationAssignedToDistrictB.id);
    });

    it('admin tier can list administrations scoped to their district', async () => {
      const res = await expectRoute('GET', '/v1/administrations').as(tiers.admin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.administrationAssignedToDistrict.id);
      expect(ids).toContain(baseFixture.administrationAssignedToSchoolA.id);
      expect(ids).not.toContain(baseFixture.administrationAssignedToDistrictB.id);
    });

    it('educator tier can list administrations scoped to their district', async () => {
      const res = await expectRoute('GET', '/v1/administrations').as(tiers.educator).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.administrationAssignedToDistrict.id);
      expect(ids).not.toContain(baseFixture.administrationAssignedToDistrictB.id);
    });

    it('student tier can list administrations scoped to their enrollment', async () => {
      const res = await expectRoute('GET', '/v1/administrations').as(tiers.student).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      // Student enrolled at district sees district-level administrations
      expect(ids).toContain(baseFixture.administrationAssignedToDistrict.id);
      // Supervised users have ancestor-only access — no descendant visibility
      expect(ids).not.toContain(baseFixture.administrationAssignedToSchoolA.id);
      expect(ids).not.toContain(baseFixture.administrationAssignedToSchoolB.id);
      expect(ids).not.toContain(baseFixture.administrationAssignedToDistrictB.id);
    });

    it('caregiver tier sees an empty list (caregivers lack can_list on administration)', async () => {
      const res = await expectRoute('GET', '/v1/administrations').as(tiers.caregiver).toReturn(200);

      // Caregivers (guardian/parent/relative) are not in supervisory_tier_group or student,
      // so FGA returns no accessible administrations
      expect(res.body.data.items).toHaveLength(0);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', '/v1/administrations').unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns empty list for an unassigned user', async () => {
      authenticateAs(baseFixture.unassignedUser);
      const res = await request(app).get('/v1/administrations').set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.pagination.totalItems).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/administrations/:id
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/administrations/:id', () => {
  const adminId = () => baseFixture.administrationAssignedToDistrict.id;

  describe('authorization', () => {
    it('superAdmin tier can get any administration', async () => {
      const res = await expectRoute('GET', `/v1/administrations/${adminId()}`).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.id).toBe(adminId());
    });

    it('siteAdmin tier can get an administration', async () => {
      const res = await expectRoute('GET', `/v1/administrations/${adminId()}`).as(tiers.siteAdmin).toReturn(200);

      expect(res.body.data.id).toBe(adminId());
      expect(res.body.data.name).toBe(baseFixture.administrationAssignedToDistrict.name);
    });

    it('admin tier can get an administration', async () => {
      const res = await expectRoute('GET', `/v1/administrations/${adminId()}`).as(tiers.admin).toReturn(200);

      expect(res.body.data.id).toBe(adminId());
    });

    it('educator tier can get an administration', async () => {
      const res = await expectRoute('GET', `/v1/administrations/${adminId()}`).as(tiers.educator).toReturn(200);

      expect(res.body.data.id).toBe(adminId());
    });

    it('student tier can get an administration', async () => {
      const res = await expectRoute('GET', `/v1/administrations/${adminId()}`).as(tiers.student).toReturn(200);

      expect(res.body.data.id).toBe(adminId());
    });

    it('caregiver tier is forbidden from getting an administration', async () => {
      const res = await expectRoute('GET', `/v1/administrations/${adminId()}`).as(tiers.caregiver).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', `/v1/administrations/${adminId()}`).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 for a non-existent administration', async () => {
      const res = await expectRoute('GET', '/v1/administrations/00000000-0000-0000-0000-000000000000')
        .as(tiers.admin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 403 when user lacks access to the administration', async () => {
      authenticateAs(baseFixture.districtBAdmin);
      const res = await request(app)
        .get(`/v1/administrations/${baseFixture.administrationAssignedToSchoolA.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/administrations/:id/districts
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/administrations/:id/districts', () => {
  const adminId = () => baseFixture.administrationAssignedToDistrict.id;
  const path = () => `/v1/administrations/${adminId()}/districts`;

  describe('authorization', () => {
    it('superAdmin tier sees all assigned districts without filtering', async () => {
      // Create a multi-district administration for this assertion
      const multiDistrictAdmin = await AdministrationFactory.create({
        name: 'Super Admin Districts Test',
        createdBy: baseFixture.districtAdmin.id,
      });
      await Promise.all([
        AdministrationOrgFactory.create({ administrationId: multiDistrictAdmin.id, orgId: baseFixture.district.id }),
        AdministrationOrgFactory.create({ administrationId: multiDistrictAdmin.id, orgId: baseFixture.districtB.id }),
      ]);
      await Promise.all([
        writeFgaAdministrationAssignment(multiDistrictAdmin.id, baseFixture.district.id, 'district'),
        writeFgaAdministrationAssignment(multiDistrictAdmin.id, baseFixture.districtB.id, 'district'),
      ]);

      const res = await expectRoute('GET', `/v1/administrations/${multiDistrictAdmin.id}/districts`)
        .as(tiers.superAdmin)
        .toReturn(200);

      // Super admin sees both districts
      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.district.id);
      expect(ids).toContain(baseFixture.districtB.id);
    });

    it('siteAdmin tier can list districts', async () => {
      const res = await expectRoute('GET', path()).as(tiers.siteAdmin).toReturn(200);

      expect(res.body.data.items.length).toBeGreaterThan(0);
      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.district.id);
    });

    it('admin tier can list districts scoped to their org tree', async () => {
      const res = await expectRoute('GET', path()).as(tiers.admin).toReturn(200);

      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].id).toBe(baseFixture.district.id);
    });

    it('educator tier can list districts scoped to their org tree', async () => {
      const res = await expectRoute('GET', path()).as(tiers.educator).toReturn(200);

      expect(res.body.data.items.length).toBeGreaterThan(0);
      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.district.id);
    });

    it('student tier is forbidden from listing districts', async () => {
      const res = await expectRoute('GET', path()).as(tiers.student).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier is forbidden from listing districts', async () => {
      const res = await expectRoute('GET', path()).as(tiers.caregiver).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('access filtering', () => {
    it('admin tier sees only their own district in a multi-district administration', async () => {
      // Create administration assigned to both districts
      const multiDistrictAdmin = await AdministrationFactory.create({
        name: 'Multi-District Test',
        createdBy: baseFixture.districtAdmin.id,
      });
      await Promise.all([
        AdministrationOrgFactory.create({ administrationId: multiDistrictAdmin.id, orgId: baseFixture.district.id }),
        AdministrationOrgFactory.create({ administrationId: multiDistrictAdmin.id, orgId: baseFixture.districtB.id }),
      ]);
      await Promise.all([
        writeFgaAdministrationAssignment(multiDistrictAdmin.id, baseFixture.district.id, 'district'),
        writeFgaAdministrationAssignment(multiDistrictAdmin.id, baseFixture.districtB.id, 'district'),
      ]);

      const res = await expectRoute('GET', `/v1/administrations/${multiDistrictAdmin.id}/districts`)
        .as(tiers.admin)
        .toReturn(200);

      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].id).toBe(baseFixture.district.id);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', path()).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 for a non-existent administration', async () => {
      const res = await expectRoute('GET', '/v1/administrations/00000000-0000-0000-0000-000000000000/districts')
        .as(tiers.admin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 403 when user lacks access to the administration', async () => {
      authenticateAs(baseFixture.districtBAdmin);
      const res = await request(app)
        .get(`/v1/administrations/${baseFixture.administrationAssignedToSchoolA.id}/districts`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/administrations/:id/schools
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/administrations/:id/schools', () => {
  // Use administrationAssignedToSchoolA — it has schoolA directly in administration_orgs.
  // administrationAssignedToDistrict has only the district org, NOT individual schools.
  const adminId = () => baseFixture.administrationAssignedToSchoolA.id;
  const path = () => `/v1/administrations/${adminId()}/schools`;

  describe('authorization', () => {
    it('superAdmin tier sees all assigned schools', async () => {
      const res = await expectRoute('GET', path()).as(tiers.superAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.schoolA.id);
    });

    it('siteAdmin tier can list schools', async () => {
      const res = await expectRoute('GET', path()).as(tiers.siteAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.schoolA.id);
    });

    it('admin tier can list schools scoped to their org tree', async () => {
      const res = await expectRoute('GET', path()).as(tiers.admin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.schoolA.id);
    });

    it('educator tier can list schools scoped to their org tree', async () => {
      const res = await expectRoute('GET', path()).as(tiers.educator).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.schoolA.id);
    });

    it('student tier is forbidden from listing schools', async () => {
      const res = await expectRoute('GET', path()).as(tiers.student).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier is forbidden from listing schools', async () => {
      const res = await expectRoute('GET', path()).as(tiers.caregiver).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('error cases', () => {
    it('returns 404 for a non-existent administration', async () => {
      const res = await expectRoute('GET', '/v1/administrations/00000000-0000-0000-0000-000000000000/schools')
        .as(tiers.admin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/administrations/:id/classes
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/administrations/:id/classes', () => {
  const adminId = () => baseFixture.administrationAssignedToClassA.id;
  const path = () => `/v1/administrations/${adminId()}/classes`;

  describe('authorization', () => {
    it('superAdmin tier can list all assigned classes', async () => {
      const res = await expectRoute('GET', path()).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items.length).toBeGreaterThan(0);
      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.classInSchoolA.id);
    });

    it('admin tier can list classes', async () => {
      const res = await expectRoute('GET', path()).as(tiers.admin).toReturn(200);

      // District admin sees classInSchoolA via descendant access
      expect(res.body.data.items.length).toBeGreaterThan(0);
      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.classInSchoolA.id);
    });

    it('educator tier can list classes scoped to their org tree', async () => {
      const res = await expectRoute('GET', path()).as(tiers.educator).toReturn(200);

      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('student tier is forbidden from listing classes', async () => {
      authenticateAs(baseFixture.classAStudent);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier is forbidden from listing classes', async () => {
      const res = await expectRoute('GET', path()).as(tiers.caregiver).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('error cases', () => {
    it('returns 404 for a non-existent administration', async () => {
      const res = await expectRoute('GET', '/v1/administrations/00000000-0000-0000-0000-000000000000/classes')
        .as(tiers.admin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/administrations/:id/groups
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/administrations/:id/groups', () => {
  const adminId = () => baseFixture.administrationAssignedToGroup.id;
  const path = () => `/v1/administrations/${adminId()}/groups`;

  describe('authorization', () => {
    it('superAdmin tier sees all groups without membership requirement', async () => {
      const res = await expectRoute('GET', path()).as(tiers.superAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.group.id);
    });

    it('admin tier who is a group member can list groups', async () => {
      // Groups require direct membership — create an admin in the group
      const groupAdmin = await UserFactory.create({ nameFirst: 'Group', nameLast: 'Admin' });
      await UserGroupFactory.create({
        userId: groupAdmin.id,
        groupId: baseFixture.group.id,
        role: UserRole.ADMINISTRATOR,
      });
      await writeFgaGroupMembership(groupAdmin.id, baseFixture.group.id, UserRole.ADMINISTRATOR);

      authenticateAs(groupAdmin);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.group.id);
    });

    it('educator tier who is a group member can list groups', async () => {
      const groupTeacher = await UserFactory.create({ nameFirst: 'Group', nameLast: 'Teacher' });
      await UserGroupFactory.create({
        userId: groupTeacher.id,
        groupId: baseFixture.group.id,
        role: UserRole.TEACHER,
      });
      await writeFgaGroupMembership(groupTeacher.id, baseFixture.group.id, UserRole.TEACHER);

      authenticateAs(groupTeacher);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items).toBeInstanceOf(Array);
    });

    it('student tier is forbidden from listing groups', async () => {
      authenticateAs(baseFixture.groupStudent);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier is forbidden from listing groups', async () => {
      const groupCaregiver = await UserFactory.create({ nameFirst: 'Group', nameLast: 'Caregiver' });
      await UserGroupFactory.create({
        userId: groupCaregiver.id,
        groupId: baseFixture.group.id,
        role: UserRole.GUARDIAN,
      });
      await writeFgaGroupMembership(groupCaregiver.id, baseFixture.group.id, UserRole.GUARDIAN);

      authenticateAs(groupCaregiver);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('error cases', () => {
    it('returns 404 for a non-existent administration', async () => {
      const res = await expectRoute('GET', '/v1/administrations/00000000-0000-0000-0000-000000000000/groups')
        .as(tiers.admin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/administrations/:id/task-variants
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/administrations/:id/task-variants', () => {
  const adminId = () => baseFixture.administrationAssignedToDistrict.id;
  const path = () => `/v1/administrations/${adminId()}/task-variants`;

  describe('authorization', () => {
    it('superAdmin tier sees all variants with raw conditions', async () => {
      const res = await expectRoute('GET', path()).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toHaveLength(6);
      const variant = res.body.data.items[0];
      expect(variant.conditions).toHaveProperty('assigned_if');
      expect(variant.conditions).toHaveProperty('optional_if');
    });

    it('siteAdmin tier sees all variants with raw conditions', async () => {
      const res = await expectRoute('GET', path()).as(tiers.siteAdmin).toReturn(200);

      expect(res.body.data.items).toHaveLength(6);
      const variant = res.body.data.items[0];
      expect(variant.conditions).toHaveProperty('assigned_if');
      expect(variant.conditions).toHaveProperty('optional_if');
    });

    it('admin tier sees all variants with raw conditions', async () => {
      const res = await expectRoute('GET', path()).as(tiers.admin).toReturn(200);

      expect(res.body.data.items).toHaveLength(6);
      const variant = res.body.data.items[0];
      expect(variant.conditions).toHaveProperty('assigned_if');
      expect(variant.conditions).toHaveProperty('optional_if');
    });

    it('educator tier sees all variants with raw conditions', async () => {
      const res = await expectRoute('GET', path()).as(tiers.educator).toReturn(200);

      expect(res.body.data.items).toHaveLength(6);
      const variant = res.body.data.items[0];
      expect(variant.conditions).toHaveProperty('assigned_if');
    });

    it('student tier sees only eligible variants with evaluated conditions', async () => {
      authenticateAs(baseFixture.grade5Student);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      // Grade 5 student should see: variantForAllGrades, variantForGrade5,
      // variantOptionalForEll, variantForTask2, variantForTask2Grade5OptionalEll
      expect(ids).toContain(baseFixture.variantForAllGrades.id);
      expect(ids).toContain(baseFixture.variantForGrade5.id);
      expect(ids).toContain(baseFixture.variantOptionalForEll.id);
      expect(ids).toContain(baseFixture.variantForTask2.id);
      expect(ids).toContain(baseFixture.variantForTask2Grade5OptionalEll.id);
      // Should NOT see grade 3 variant
      expect(ids).not.toContain(baseFixture.variantForGrade3.id);

      // Students get evaluated conditions (optional boolean), not raw conditions
      const firstVariant = res.body.data.items[0];
      expect(firstVariant.conditions).toHaveProperty('optional');
      expect(firstVariant.conditions).not.toHaveProperty('assigned_if');
    });

    it('caregiver tier is forbidden from listing task variants', async () => {
      const res = await expectRoute('GET', path()).as(tiers.caregiver).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', path()).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 for a non-existent administration', async () => {
      const res = await expectRoute('GET', '/v1/administrations/00000000-0000-0000-0000-000000000000/task-variants')
        .as(tiers.admin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/administrations/:id/agreements
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/administrations/:id/agreements', () => {
  const adminId = () => baseFixture.administrationAssignedToDistrict.id;
  const path = () => `/v1/administrations/${adminId()}/agreements`;

  describe('authorization', () => {
    it('superAdmin tier sees all agreement types', async () => {
      const res = await expectRoute('GET', path()).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('siteAdmin tier sees all agreement types', async () => {
      // Create all three agreement types for the administration
      const [tosAgreement, assentAgreement, consentAgreement] = await Promise.all([
        AgreementFactory.create({ agreementType: 'tos' }),
        AgreementFactory.create({ agreementType: 'assent' }),
        AgreementFactory.create({ agreementType: 'consent' }),
      ]);
      await Promise.all([
        AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: tosAgreement.id } },
        ),
        AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: assentAgreement.id } },
        ),
        AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: consentAgreement.id } },
        ),
      ]);
      await Promise.all([
        AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: adminId(), agreementId: tosAgreement.id },
        }),
        AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: adminId(), agreementId: assentAgreement.id },
        }),
        AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: adminId(), agreementId: consentAgreement.id },
        }),
      ]);

      const res = await expectRoute('GET', path()).as(tiers.siteAdmin).toReturn(200);

      // Supervisory roles see all agreement types unfiltered
      const types = res.body.data.items.map((item: { agreementType: string }) => item.agreementType);
      expect(types).toContain('tos');
      expect(types).toContain('assent');
      expect(types).toContain('consent');
    });

    it('admin tier sees all agreement types', async () => {
      const res = await expectRoute('GET', path()).as(tiers.admin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('educator tier sees all agreement types', async () => {
      const res = await expectRoute('GET', path()).as(tiers.educator).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
    });

    it('minor student sees only assent agreements', async () => {
      // Create a minor student (10 years old) with access to the administration
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      const minorStudent = await UserFactory.create({
        userType: 'student',
        dob: tenYearsAgo.toISOString().split('T')[0]!,
      });
      await UserOrgFactory.create({ userId: minorStudent.id, orgId: baseFixture.district.id, role: UserRole.STUDENT });
      await writeFgaOrgMembership(minorStudent.id, baseFixture.district.id, UserRole.STUDENT, 'district');

      authenticateAs(minorStudent);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const types = res.body.data.items.map((item: { agreementType: string }) => item.agreementType);
      // Minor students only see assent agreements
      for (const type of types) {
        expect(type).toBe('assent');
      }
    });

    it('adult student sees only consent agreements', async () => {
      // Create an adult student (20 years old)
      const twentyYearsAgo = new Date();
      twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
      const adultStudent = await UserFactory.create({
        userType: 'student',
        dob: twentyYearsAgo.toISOString().split('T')[0]!,
      });
      await UserOrgFactory.create({ userId: adultStudent.id, orgId: baseFixture.district.id, role: UserRole.STUDENT });
      await writeFgaOrgMembership(adultStudent.id, baseFixture.district.id, UserRole.STUDENT, 'district');

      authenticateAs(adultStudent);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const types = res.body.data.items.map((item: { agreementType: string }) => item.agreementType);
      // Adult students only see consent agreements
      for (const type of types) {
        expect(type).toBe('consent');
      }
    });

    it('caregiver tier is forbidden from listing agreements', async () => {
      const res = await expectRoute('GET', path()).as(tiers.caregiver).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('error cases', () => {
    it('returns 404 for a non-existent administration', async () => {
      const res = await expectRoute('GET', '/v1/administrations/00000000-0000-0000-0000-000000000000/agreements')
        .as(tiers.admin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 403 for a user without access to the administration', async () => {
      authenticateAs(baseFixture.districtBAdmin);
      const res = await request(app)
        .get(`/v1/administrations/${baseFixture.administrationAssignedToSchoolA.id}/agreements`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /v1/administrations/:id
// ═══════════════════════════════════════════════════════════════════════════

describe('DELETE /v1/administrations/:id', () => {
  /**
   * Creates a fresh administration assigned to the given org for delete tests.
   * Each delete test needs its own administration to avoid side effects.
   */
  let deletableCounter = 0;
  async function createDeletableAdministration(orgId: string = baseFixture.district.id) {
    deletableCounter += 1;
    const admin = await AdministrationFactory.create({
      name: `Deletable Admin ${deletableCounter}`,
      createdBy: baseFixture.districtAdmin.id,
    });
    await AdministrationOrgFactory.create({ administrationId: admin.id, orgId });
    await writeFgaAdministrationAssignment(admin.id, orgId, 'district');
    return admin;
  }

  describe('authorization', () => {
    it('superAdmin tier can delete any administration', async () => {
      const adminToDelete = await createDeletableAdministration();

      await expectRoute('DELETE', `/v1/administrations/${adminToDelete.id}`).as(tiers.superAdmin).toReturn(204);

      // Verify it's actually deleted
      const getRes = await expectRoute('GET', `/v1/administrations/${adminToDelete.id}`)
        .as(tiers.superAdmin)
        .toReturn(404);
      expect(getRes.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('siteAdmin tier is forbidden from deleting (can_delete is no_one in FGA)', async () => {
      const adminToDelete = await createDeletableAdministration();

      const res = await expectRoute('DELETE', `/v1/administrations/${adminToDelete.id}`)
        .as(tiers.siteAdmin)
        .toReturn(403);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('admin tier is forbidden from deleting (can_delete is no_one in FGA)', async () => {
      const adminToDelete = await createDeletableAdministration();

      const res = await expectRoute('DELETE', `/v1/administrations/${adminToDelete.id}`).as(tiers.admin).toReturn(403);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('educator tier is forbidden from deleting (no DELETE permission)', async () => {
      const adminToDelete = await createDeletableAdministration();

      const res = await expectRoute('DELETE', `/v1/administrations/${adminToDelete.id}`)
        .as(tiers.educator)
        .toReturn(403);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);

      // Verify the administration still exists
      const getRes = await expectRoute('GET', `/v1/administrations/${adminToDelete.id}`).as(tiers.admin).toReturn(200);
      expect(getRes.body.data.id).toBe(adminToDelete.id);
    });

    it('student tier is forbidden from deleting', async () => {
      const res = await expectRoute('DELETE', `/v1/administrations/${baseFixture.administrationAssignedToDistrict.id}`)
        .as(tiers.student)
        .toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier is forbidden from deleting', async () => {
      const res = await expectRoute('DELETE', `/v1/administrations/${baseFixture.administrationAssignedToDistrict.id}`)
        .as(tiers.caregiver)
        .toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('DELETE', `/v1/administrations/${baseFixture.administrationAssignedToDistrict.id}`)
        .unauthenticated()
        .toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 for a non-existent administration', async () => {
      const res = await expectRoute('DELETE', '/v1/administrations/00000000-0000-0000-0000-000000000000')
        .as(tiers.admin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 403 when admin lacks access to the administration', async () => {
      authenticateAs(baseFixture.districtBAdmin);
      const res = await request(app)
        .delete(`/v1/administrations/${baseFixture.administrationAssignedToSchoolA.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 409 when administration has existing runs', async () => {
      const adminWithRuns = await createDeletableAdministration();
      await RunFactory.create({ administrationId: adminWithRuns.id });

      // Only superAdmin can delete (can_delete is no_one in FGA)
      const res = await expectRoute('DELETE', `/v1/administrations/${adminWithRuns.id}`)
        .as(tiers.superAdmin)
        .toReturn(409);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });
  });
});
