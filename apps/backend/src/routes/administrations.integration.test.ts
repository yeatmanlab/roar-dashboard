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
import { AdministrationFactory } from '../test-support/factories/administration.factory';
import { AdministrationOrgFactory } from '../test-support/factories/administration-org.factory';
import { AdministrationClassFactory } from '../test-support/factories/administration-class.factory';
import { AdministrationGroupFactory } from '../test-support/factories/administration-group.factory';
import { AgreementFactory } from '../test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../test-support/factories/agreement-version.factory';
import { AdministrationAgreementFactory } from '../test-support/factories/administration-agreement.factory';
import { RunFactory } from '../test-support/factories/run.factory';
import { writeFgaAdministrationAssignment, writeFgaOrgMembership } from '../test-support/fga/fga-test-tuples.helper';
import { FgaType } from '../services/authorization/fga-constants';

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

    it('principal at school A can list school-assigned administrations (school_admin_tier)', async () => {
      // Principal rostered at schoolA has supervisory_tier_group on schoolA,
      // so they see administrations assigned to schoolA via subtree_supervisory_tier_group.
      authenticateAs(baseFixture.schoolAPrincipal);
      const res = await request(app).get('/v1/administrations').set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.administrationAssignedToSchoolA.id);
      // Principal at schoolA should NOT see administrations in other schools or other districts
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
// POST /v1/administrations
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /v1/administrations', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await expectRoute('POST', '/v1/administrations').unauthenticated().withBody({}).toReturn(401);

    expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
  });

  it('non-super admin tiers are forbidden from creating an administration', async () => {
    const body = {
      name: 'Admin Name',
      namePublic: 'Admin Public Name',
      description: 'Integration create test',
      dateStart: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      dateEnd: new Date('2026-12-31T00:00:00.000Z').toISOString(),
      isOrdered: true,
      orgs: [baseFixture.district.id],
      classes: [],
      groups: [],
      taskVariants: [
        {
          taskVariantId: baseFixture.variantForAllGrades.id,
          orderIndex: 0,
          conditionsEligibility: null,
          conditionsRequirement: null,
        },
      ],
      agreements: [],
    };

    await expectRoute('POST', '/v1/administrations').as(tiers.admin).withBody(body).toReturn(403);
    await expectRoute('POST', '/v1/administrations').as(tiers.siteAdmin).withBody(body).toReturn(403);
    await expectRoute('POST', '/v1/administrations').as(tiers.educator).withBody(body).toReturn(403);
    await expectRoute('POST', '/v1/administrations').as(tiers.student).withBody(body).toReturn(403);
    await expectRoute('POST', '/v1/administrations').as(tiers.caregiver).withBody(body).toReturn(403);
  });

  it('superAdmin tier can create an administration and returns the new ID', async () => {
    const agreement = await AgreementFactory.create({ name: 'Agreement Name' });
    await AgreementVersionFactory.create({ locale: 'en-US' }, { transient: { agreementId: agreement.id } });

    const body = {
      name: 'Admin Name',
      namePublic: 'Admin Public Name',
      description: 'Integration create test',
      dateStart: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      dateEnd: new Date('2026-12-31T00:00:00.000Z').toISOString(),
      isOrdered: true,
      orgs: [baseFixture.district.id],
      classes: [],
      groups: [],
      taskVariants: [
        {
          taskVariantId: baseFixture.variantForAllGrades.id,
          orderIndex: 0,
          conditionsEligibility: null,
          conditionsRequirement: null,
        },
      ],
      agreements: [agreement.id],
    };

    const res = await expectRoute('POST', '/v1/administrations').as(tiers.superAdmin).withBody(body).toReturn(201);

    expect(res.body.data).toMatch(/[0-9a-fA-F-]{36}/);

    const getRes = await expectRoute('GET', `/v1/administrations/${res.body.data}`).as(tiers.superAdmin).toReturn(200);

    expect(getRes.body.data.id).toBe(res.body.data);
  });

  it('returns 422 when dateEnd is before dateStart', async () => {
    const body = {
      name: 'Admin Name',
      namePublic: 'Admin Public Name',
      dateStart: new Date('2026-12-31T00:00:00.000Z').toISOString(),
      dateEnd: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      orgs: [baseFixture.district.id],
      classes: [],
      groups: [],
      taskVariants: [
        {
          taskVariantId: baseFixture.variantForAllGrades.id,
          orderIndex: 0,
          conditionsEligibility: null,
          conditionsRequirement: null,
        },
      ],
      agreements: [],
    };

    const res = await expectRoute('POST', '/v1/administrations').as(tiers.superAdmin).withBody(body).toReturn(422);

    expect(res.body.error.code).toBe(ApiErrorCode.REQUEST_VALIDATION_FAILED);
  });

  it('returns 404 when a referenced entity does not exist', async () => {
    const body = {
      name: 'New Admin Name',
      namePublic: 'New Admin Public Name',
      dateStart: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      dateEnd: new Date('2026-12-31T00:00:00.000Z').toISOString(),
      orgs: ['00000000-0000-0000-0000-000000000000'],
      classes: [],
      groups: [],
      taskVariants: [
        {
          taskVariantId: baseFixture.variantForAllGrades.id,
          orderIndex: 0,
          conditionsEligibility: null,
          conditionsRequirement: null,
        },
      ],
      agreements: [],
    };

    const res = await expectRoute('POST', '/v1/administrations').as(tiers.superAdmin).withBody(body).toReturn(404);

    expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
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
// GET /v1/administrations/:id/assignees
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/administrations/:id/assignees', () => {
  const adminId = () => baseFixture.administrationAssignedToDistrict.id;
  const path = () => `/v1/administrations/${adminId()}/assignees`;

  describe('authorization', () => {
    it('superAdmin tier can get assignees', async () => {
      const res = await expectRoute('GET', path()).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data).toHaveProperty('districts');
      expect(res.body.data).toHaveProperty('schools');
      expect(res.body.data).toHaveProperty('classes');
      expect(res.body.data).toHaveProperty('groups');
    });

    it('siteAdmin tier is forbidden from getting assignees', async () => {
      const res = await expectRoute('GET', path()).as(tiers.siteAdmin).toReturn(403);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('admin tier is forbidden from getting assignees', async () => {
      const res = await expectRoute('GET', path()).as(tiers.admin).toReturn(403);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('educator tier is forbidden from getting assignees', async () => {
      const res = await expectRoute('GET', path()).as(tiers.educator).toReturn(403);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('student tier is forbidden from getting assignees', async () => {
      const res = await expectRoute('GET', path()).as(tiers.student).toReturn(403);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier is forbidden from getting assignees', async () => {
      const res = await expectRoute('GET', path()).as(tiers.caregiver).toReturn(403);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('response shape', () => {
    it('returns districts assigned to the administration', async () => {
      const res = await expectRoute('GET', path()).as(tiers.superAdmin).toReturn(200);
      const { districts } = res.body.data;
      expect(districts).toHaveLength(1);
      expect(districts[0].id).toBe(baseFixture.district.id);
      expect(districts[0].name).toBe(baseFixture.district.name);
    });

    it('returns all four entity type arrays', async () => {
      const res = await expectRoute('GET', path()).as(tiers.superAdmin).toReturn(200);

      expect(Array.isArray(res.body.data.districts)).toBe(true);
      expect(Array.isArray(res.body.data.schools)).toBe(true);
      expect(Array.isArray(res.body.data.classes)).toBe(true);
      expect(Array.isArray(res.body.data.groups)).toBe(true);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', path()).unauthenticated().toReturn(401);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 for a non-existent administration', async () => {
      const res = await expectRoute('GET', '/v1/administrations/00000000-0000-0000-0000-000000000000/assignees')
        .as(tiers.superAdmin)
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
      await writeFgaOrgMembership(minorStudent.id, baseFixture.district.id, UserRole.STUDENT, FgaType.DISTRICT);

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
      await writeFgaOrgMembership(adultStudent.id, baseFixture.district.id, UserRole.STUDENT, FgaType.DISTRICT);

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
  let deletableCounter = 0;

  async function createDeletableAdministration() {
    deletableCounter += 1;
    const orgId = baseFixture.district.id;
    const admin = await AdministrationFactory.create({
      name: `Deletable Admin ${deletableCounter}`,
      createdBy: baseFixture.districtAdmin.id,
    });
    await AdministrationOrgFactory.create({ administrationId: admin.id, orgId });
    await writeFgaAdministrationAssignment(admin.id, orgId, FgaType.DISTRICT);
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

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/administrations/:id/tree
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/administrations/:id/tree', () => {
  // administrationAssignedToDistrict has the district directly assigned via administration_orgs
  const adminId = () => baseFixture.administrationAssignedToDistrict.id;
  const treePath = () => `/v1/administrations/${adminId()}/tree`;

  describe('root level — all direct assignees', () => {
    it('superAdmin sees all direct assignees at root level', async () => {
      // Create an administration assigned to multiple entity types
      const multiAdmin = await AdministrationFactory.create({
        name: 'Tree Multi-Entity Test',
        createdBy: baseFixture.districtAdmin.id,
      });
      await Promise.all([
        AdministrationOrgFactory.create({ administrationId: multiAdmin.id, orgId: baseFixture.district.id }),
        AdministrationOrgFactory.create({ administrationId: multiAdmin.id, orgId: baseFixture.schoolA.id }),
        AdministrationClassFactory.create({
          administrationId: multiAdmin.id,
          classId: baseFixture.classInSchoolB.id,
        }),
        AdministrationGroupFactory.create({ administrationId: multiAdmin.id, groupId: baseFixture.group.id }),
      ]);
      await Promise.all([
        writeFgaAdministrationAssignment(multiAdmin.id, baseFixture.district.id, FgaType.DISTRICT),
        writeFgaAdministrationAssignment(multiAdmin.id, baseFixture.schoolA.id, FgaType.SCHOOL),
        writeFgaAdministrationAssignment(multiAdmin.id, baseFixture.classInSchoolB.id, FgaType.CLASS),
        writeFgaAdministrationAssignment(multiAdmin.id, baseFixture.group.id, FgaType.GROUP),
      ]);

      const res = await expectRoute('GET', `/v1/administrations/${multiAdmin.id}/tree`)
        .as(tiers.superAdmin)
        .toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.district.id);
      expect(ids).toContain(baseFixture.schoolA.id);
      expect(ids).toContain(baseFixture.classInSchoolB.id);
      expect(ids).toContain(baseFixture.group.id);

      // Verify entity types
      const typeMap = new Map(
        res.body.data.items.map((item: { id: string; entityType: string }) => [item.id, item.entityType]),
      );
      expect(typeMap.get(baseFixture.district.id)).toBe('district');
      expect(typeMap.get(baseFixture.schoolA.id)).toBe('school');
      expect(typeMap.get(baseFixture.classInSchoolB.id)).toBe('class');
      expect(typeMap.get(baseFixture.group.id)).toBe('group');
    });

    it('superAdmin sees the district assignee for the base fixture administration', async () => {
      const res = await expectRoute('GET', treePath()).as(tiers.superAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.district.id);
    });

    it('admin tier sees only their accessible entities', async () => {
      const res = await expectRoute('GET', treePath()).as(tiers.admin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.district.id);
    });

    it('student tier can access tree (has can_read on administration)', async () => {
      const res = await expectRoute('GET', treePath()).as(tiers.student).toReturn(200);

      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('caregiver tier is forbidden from accessing tree', async () => {
      const res = await expectRoute('GET', treePath()).as(tiers.caregiver).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('hasChildren', () => {
    it('district node has hasChildren=true when it has child schools', async () => {
      const res = await expectRoute('GET', treePath()).as(tiers.superAdmin).toReturn(200);

      const districtNode = res.body.data.items.find((item: { id: string }) => item.id === baseFixture.district.id);
      expect(districtNode).toBeDefined();
      // baseFixture.district has schoolA and schoolB as children
      expect(districtNode.hasChildren).toBe(true);
    });

    it('class node always has hasChildren=false', async () => {
      // Create administration with a directly assigned class
      const classAdmin = await AdministrationFactory.create({
        name: 'Tree Class Leaf Test',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationClassFactory.create({
        administrationId: classAdmin.id,
        classId: baseFixture.classInSchoolA.id,
      });
      await writeFgaAdministrationAssignment(classAdmin.id, baseFixture.classInSchoolA.id, FgaType.CLASS);

      const res = await expectRoute('GET', `/v1/administrations/${classAdmin.id}/tree`)
        .as(tiers.superAdmin)
        .toReturn(200);

      const classNode = res.body.data.items.find((item: { id: string }) => item.id === baseFixture.classInSchoolA.id);
      expect(classNode).toBeDefined();
      expect(classNode.hasChildren).toBe(false);
    });

    it('group node always has hasChildren=false', async () => {
      const groupAdmin = await AdministrationFactory.create({
        name: 'Tree Group Leaf Test',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationGroupFactory.create({
        administrationId: groupAdmin.id,
        groupId: baseFixture.group.id,
      });
      await writeFgaAdministrationAssignment(groupAdmin.id, baseFixture.group.id, FgaType.GROUP);

      const res = await expectRoute('GET', `/v1/administrations/${groupAdmin.id}/tree`)
        .as(tiers.superAdmin)
        .toReturn(200);

      const groupNode = res.body.data.items.find((item: { id: string }) => item.id === baseFixture.group.id);
      expect(groupNode).toBeDefined();
      expect(groupNode.hasChildren).toBe(false);
    });
  });

  describe('drill-down — district children', () => {
    it('returns all child schools of a district when drilling down', async () => {
      const res = await expectRoute(
        'GET',
        `${treePath()}?parentEntityType=district&parentEntityId=${baseFixture.district.id}`,
      )
        .as(tiers.superAdmin)
        .toReturn(200);

      // baseFixture.district has schoolA and schoolB as children
      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.schoolA.id);
      expect(ids).toContain(baseFixture.schoolB.id);

      // All items should be schools
      for (const item of res.body.data.items) {
        expect(item.entityType).toBe('school');
      }
    });

    it('school children have hasChildren=true when they have classes', async () => {
      const res = await expectRoute(
        'GET',
        `${treePath()}?parentEntityType=district&parentEntityId=${baseFixture.district.id}`,
      )
        .as(tiers.superAdmin)
        .toReturn(200);

      // schoolA has classInSchoolA, schoolB has classInSchoolB
      const schoolANode = res.body.data.items.find((item: { id: string }) => item.id === baseFixture.schoolA.id);
      expect(schoolANode).toBeDefined();
      expect(schoolANode.hasChildren).toBe(true);
    });
  });

  describe('drill-down — school children', () => {
    it('returns all child classes of a school when drilling down', async () => {
      const res = await expectRoute(
        'GET',
        `${treePath()}?parentEntityType=school&parentEntityId=${baseFixture.schoolA.id}`,
      )
        .as(tiers.superAdmin)
        .toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.classInSchoolA.id);

      for (const item of res.body.data.items) {
        expect(item.entityType).toBe('class');
        expect(item.hasChildren).toBe(false);
      }
    });
  });

  describe('drill-down — leaf nodes', () => {
    it('returns empty items for class parent', async () => {
      const res = await expectRoute(
        'GET',
        `${treePath()}?parentEntityType=class&parentEntityId=${baseFixture.classInSchoolA.id}`,
      )
        .as(tiers.superAdmin)
        .toReturn(200);

      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.pagination.totalItems).toBe(0);
    });

    it('returns empty items for group parent', async () => {
      // Use an administration that has a group assigned
      const groupAdmin = await AdministrationFactory.create({
        name: 'Tree Group Drill-Down Test',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationGroupFactory.create({
        administrationId: groupAdmin.id,
        groupId: baseFixture.group.id,
      });
      await writeFgaAdministrationAssignment(groupAdmin.id, baseFixture.group.id, FgaType.GROUP);

      const res = await expectRoute(
        'GET',
        `/v1/administrations/${groupAdmin.id}/tree?parentEntityType=group&parentEntityId=${baseFixture.group.id}`,
      )
        .as(tiers.superAdmin)
        .toReturn(200);

      expect(res.body.data.items).toHaveLength(0);
    });
  });

  describe('embed=stats', () => {
    it('returns assignment stats when embed=stats is requested', async () => {
      const res = await expectRoute('GET', `${treePath()}?embed=stats`).as(tiers.superAdmin).toReturn(200);

      // administrationAssignedToDistrict has task variants and students in the fixture.
      // Each node should have a stats object with numeric counts.
      for (const item of res.body.data.items) {
        expect(item).toHaveProperty('stats');
        expect(item.stats).toHaveProperty('assignment');
        expect(item.stats.assignment).toHaveProperty('studentsWithRequiredTasks');
        expect(item.stats.assignment).toHaveProperty('studentsAssigned');
        expect(item.stats.assignment).toHaveProperty('studentsStarted');
        expect(item.stats.assignment).toHaveProperty('studentsCompleted');
        expect(typeof item.stats.assignment.studentsWithRequiredTasks).toBe('number');
        expect(typeof item.stats.assignment.studentsAssigned).toBe('number');
        expect(typeof item.stats.assignment.studentsStarted).toBe('number');
        expect(typeof item.stats.assignment.studentsCompleted).toBe('number');

        // Verify the invariant holds per node
        const { studentsAssigned, studentsStarted, studentsCompleted, studentsWithRequiredTasks } =
          item.stats.assignment;
        expect(studentsAssigned + studentsStarted + studentsCompleted).toBe(studentsWithRequiredTasks);
      }
    });

    it('omits stats when embed=stats is not requested', async () => {
      const res = await expectRoute('GET', treePath()).as(tiers.superAdmin).toReturn(200);

      for (const item of res.body.data.items) {
        expect(item).not.toHaveProperty('stats');
      }
    });
  });

  describe('pagination', () => {
    it('respects perPage limit', async () => {
      const res = await expectRoute('GET', `${treePath()}?perPage=1`).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items.length).toBeLessThanOrEqual(1);
      expect(res.body.data.pagination.perPage).toBe(1);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', treePath()).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 for a non-existent administration', async () => {
      const res = await expectRoute('GET', '/v1/administrations/00000000-0000-0000-0000-000000000000/tree')
        .as(tiers.admin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 403 when user lacks access to the administration', async () => {
      authenticateAs(baseFixture.districtBAdmin);
      const res = await request(app)
        .get(`/v1/administrations/${baseFixture.administrationAssignedToSchoolA.id}/tree`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 400 when parentEntityId is provided without parentEntityType', async () => {
      const res = await expectRoute('GET', `${treePath()}?parentEntityId=${baseFixture.district.id}`)
        .as(tiers.superAdmin)
        .toReturn(400);

      expect(res.body.error.code).toBe(ApiErrorCode.REQUEST_VALIDATION_FAILED);
    });

    it('returns 400 when parentEntityType is provided without parentEntityId', async () => {
      const res = await expectRoute('GET', `${treePath()}?parentEntityType=district`)
        .as(tiers.superAdmin)
        .toReturn(400);

      expect(res.body.error.code).toBe(ApiErrorCode.REQUEST_VALIDATION_FAILED);
    });
  });
});
