/**
 * Route integration tests for /v1/users endpoint.
 *
 * Tests the full HTTP lifecycle: middleware → controller → service → repository → DB.
 * Only Firebase token verification is mocked — everything else runs for real.
 *
 * GET /v1/users/:id
 * - Authorization (who can access which users)
 * - Self-access (all users can access their own profile)
 * - Field transformations (Date → ISO string)
 * - Error cases (401, 403, 404)
 *
 * PATCH /v1/users/:id
 * - Authorization (super admin only; all other tiers → 403)
 * - Partial update semantics (only provided fields written, null clears a field)
 * - Validation (empty body, invalid UUID, invalid enum value)
 * - Unique constraint violations (email, username → 409)
 * - Error cases (401, 404)
 *
 * POST /v1/users/:userId/agreements
 * - Authorization (who can consent for whom)
 * - Age-based agreement type restrictions
 * - Parent/guardian consent for minor children
 * - Duplicate consent detection (same user+version → 409)
 * - Error cases (400, 401, 403, 404, 409)
 *
 * POST /v1/users
 * - Authorization (super admin and platform_admin only; other tiers → 403)
 * - Conflict detection (email already in DB or Firebase → 409)
 * - Entity validation (non-existent entityId → 422)
 * - Request validation (missing fields, empty memberships, short password)
 * - Error cases (401, 403, 409, 422)
 *
 * GET /v1/users/:userId/administrations
 * - Authorization (who can list administrations for which users)
 * - Pagination and sorting
 * - Embed options (stats, tasks)
 * - Field transformations (Date → ISO string)
 * - Error cases (401)
 *
 * GET /v1/users/:userId/administrations/:administrationId
 * - Authorization (super admin, self-access, admin for their district)
 * - Two-party access check (both requester and target user must have access)
 * - Response structure (required fields, Date → ISO string)
 * - Validation (non-existent user/administration → 404, invalid UUID → 400)
 * - Error cases (401, 403, 404)
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { faker } from '@faker-js/faker';
import type express from 'express';
import { StatusCodes } from 'http-status-codes';
import type { Administration, AdministrationTask } from '@roar-platform/api-contract';
import type { Administration as DbAdministration, TaskVariant as DbTaskVariant } from '../db/schema';
import { createTestApp, createRouteHelper, createTierUsers } from '../test-support/route-test.helper';
import type { TierUsers } from '../test-support/route-test.helper';
import { baseFixture } from '../test-support/fixtures';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { UserFactory } from '../test-support/factories/user.factory';
import { UserOrgFactory } from '../test-support/factories/user-org.factory';
import { UserClassFactory } from '../test-support/factories/user-class.factory';
import { OrgFactory } from '../test-support/factories/org.factory';
import { ClassFactory } from '../test-support/factories/class.factory';
import { OrgType } from '../enums/org-type.enum';
import { AgreementVersionFactory } from '../test-support/factories/agreement-version.factory';
import { AgreementFactory } from '../test-support/factories/agreement.factory';
import { AdministrationFactory } from '../test-support/factories/administration.factory';
import { AdministrationOrgFactory } from '../test-support/factories/administration-org.factory';
import { AdministrationAgreementFactory } from '../test-support/factories/administration-agreement.factory';
import { UserAgreementFactory } from '../test-support/factories/user-agreement.factory';
import { AgreementType } from '../enums/agreement-type.enum';
import { UserRole } from '../enums/user-role.enum';
import { UserRepository } from '../repositories/user.repository';
import { FirebaseAuthClient } from '../clients/firebase-auth.clients';
import { EntityType } from '../types/entity-type';
import { RosteringProvider } from '../enums/rostering-provider.enum';
import { RosteringEntityType } from '../enums/rostering-entity-type.enum';
import { FgaClient } from '../clients/fga.client';
import { FgaType } from '../services/authorization/fga-constants';
import { writeFgaAdministrationAssignment } from '../test-support/fga/fga-test-tuples.helper';
import type { Condition } from '../types/condition';
import { Operator } from '../types/condition';

// ═══════════════════════════════════════════════════════════════════════════
// Test setup
// ═══════════════════════════════════════════════════════════════════════════

let app: express.Application;
let expectRoute: ReturnType<typeof createRouteHelper>;
let tiers: TierUsers;
let userRepository: UserRepository;

beforeAll(async () => {
  // Route modules must be imported dynamically — they instantiate services at
  // import time, which capture CoreDbClient by value. This must happen after
  // vitest.setup.ts initializes the DB pools.
  const { registerUserRoutes } = await import('./users');
  const { registerMeRoutes } = await import('./me');

  app = createTestApp(registerUserRoutes, registerMeRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);
  userRepository = new UserRepository();

  // Assign tier educator to a class so they can access students via direct class membership
  await UserClassFactory.create({
    userId: tiers.educator.id,
    classId: baseFixture.classInSchoolA.id,
    role: UserRole.TEACHER,
  });

  // Re-sync FGA tuples to pick up tier users and class memberships created above
  const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');
  await syncFgaTuplesFromPostgres();
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/users/:id
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/users/:id', () => {
  describe('authorization', () => {
    it('superAdmin tier can access any user', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as(tiers.superAdmin)
        .toReturn(200);

      expect(res.body.data.id).toBe(baseFixture.schoolAStudent.id);
      expect(res.body.data.userType).toBe(baseFixture.schoolAStudent.userType);
    });

    it('siteAdmin tier can access users in their district', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as(tiers.siteAdmin)
        .toReturn(200);

      expect(res.body.data.id).toBe(baseFixture.schoolAStudent.id);
    });

    it('admin tier can access users in their district', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}`).as(tiers.admin).toReturn(200);

      expect(res.body.data.id).toBe(baseFixture.schoolAStudent.id);
    });

    it('educator tier can access students in their classes', async () => {
      // Educator directly assigned to classInSchoolA can see students in that class (PATH 3)
      const res = await expectRoute('GET', `/v1/users/${baseFixture.classAStudent.id}`)
        .as(tiers.educator)
        .toReturn(200);

      expect(res.body.data.id).toBe(baseFixture.classAStudent.id);
    });

    it('student tier can only access their own profile', async () => {
      // Student trying to access another student should be forbidden
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as(tiers.student)
        .toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier cannot access users through org membership alone', async () => {
      // Caregivers are not supervisory roles - they only have family-based access
      // Even though caregiver has org membership, they can't access other users without family link
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as(tiers.caregiver)
        .toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver (parent) can access users in their family', async () => {
      const { UserFamilyFactory } = await import('../test-support/factories/user-family.factory');
      const { FamilyFactory } = await import('../test-support/factories/family.factory');
      const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');

      const child = await UserFactory.create({ dob: '2015-01-01', grade: '3' });
      const family = await FamilyFactory.create();
      await UserFamilyFactory.create({ userId: tiers.caregiver.id, familyId: family.id, role: 'parent' });
      await UserFamilyFactory.create({ userId: child.id, familyId: family.id, role: 'child' });

      // Sync FGA tuples so the parent↔child family relationship is visible to FGA
      await syncFgaTuplesFromPostgres();

      const res = await expectRoute('GET', `/v1/users/${child.id}`).as(tiers.caregiver).toReturn(200);

      expect(res.body.data.id).toBe(child.id);
    });
  });

  describe('self-access', () => {
    it('superAdmin can access their own profile', async () => {
      const res = await expectRoute('GET', '/v1/me').as(tiers.superAdmin).toReturn(200);

      // Get the superAdmin's actual user ID from the response
      const superAdminUserId = res.body.data.id;

      const selfRes = await expectRoute('GET', `/v1/users/${superAdminUserId}`).as(tiers.superAdmin).toReturn(200);

      expect(selfRes.body.data.id).toBe(superAdminUserId);
    });

    it('siteAdmin can access their own profile', async () => {
      const res = await expectRoute('GET', '/v1/me').as(tiers.siteAdmin).toReturn(200);
      const siteAdminUserId = res.body.data.id;

      const selfRes = await expectRoute('GET', `/v1/users/${siteAdminUserId}`).as(tiers.siteAdmin).toReturn(200);

      expect(selfRes.body.data.id).toBe(siteAdminUserId);
    });

    it('admin can access their own profile', async () => {
      const res = await expectRoute('GET', '/v1/me').as(tiers.admin).toReturn(200);
      const adminUserId = res.body.data.id;

      const selfRes = await expectRoute('GET', `/v1/users/${adminUserId}`).as(tiers.admin).toReturn(200);

      expect(selfRes.body.data.id).toBe(adminUserId);
    });

    it('educator can access their own profile', async () => {
      const res = await expectRoute('GET', '/v1/me').as(tiers.educator).toReturn(200);
      const educatorUserId = res.body.data.id;

      const selfRes = await expectRoute('GET', `/v1/users/${educatorUserId}`).as(tiers.educator).toReturn(200);

      expect(selfRes.body.data.id).toBe(educatorUserId);
    });

    it('student can access their own profile', async () => {
      const res = await expectRoute('GET', '/v1/me').as(tiers.student).toReturn(200);
      const studentUserId = res.body.data.id;

      const selfRes = await expectRoute('GET', `/v1/users/${studentUserId}`).as(tiers.student).toReturn(200);

      expect(selfRes.body.data.id).toBe(studentUserId);
    });

    it('caregiver can access their own profile', async () => {
      const res = await expectRoute('GET', '/v1/me').as(tiers.caregiver).toReturn(200);
      const caregiverUserId = res.body.data.id;

      const selfRes = await expectRoute('GET', `/v1/users/${caregiverUserId}`).as(tiers.caregiver).toReturn(200);

      expect(selfRes.body.data.id).toBe(caregiverUserId);
    });
  });

  describe('access filtering', () => {
    it('district admin cannot access users in a different district', async () => {
      // Admin in District A trying to access user in District B
      const res = await expectRoute('GET', `/v1/users/${baseFixture.districtBStudent.id}`)
        .as(tiers.admin)
        .toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('educator (teacher) at district level cannot access students in child schools', async () => {
      // Teacher role does NOT inherit via parent_org — a district-level teacher has no
      // teacher role on child schools or classes. This prevents accidental privilege
      // escalation from mis-rostering a teacher at the district level.
      //
      // We probe schoolBStudent (enrolled in classInSchoolB), a class the educator does
      // NOT teach. schoolAStudent is intentionally not probed here: the educator is
      // explicitly rostered on classInSchoolA in beforeAll, and schoolAStudent enrolls in
      // that class, so reading them is legitimate direct-membership access, not a cascade.
      const resSchoolB = await expectRoute('GET', `/v1/users/${baseFixture.schoolBStudent.id}`)
        .as(tiers.educator)
        .toReturn(403);

      expect(resSchoolB.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('educator cannot access students in a different district', async () => {
      // Educator in District A cannot see students in District B
      const res = await expectRoute('GET', `/v1/users/${baseFixture.districtBStudent.id}`)
        .as(tiers.educator)
        .toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('principal at school A can access students at that school (school_admin_tier has can_list_users at school)', async () => {
      // Principal is in school_admin_tier, and school-level can_list_users = admin_tier or school_admin_tier.
      // So a principal rostered at schoolA can see students enrolled at schoolA.
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as({ id: baseFixture.schoolAPrincipal.id, authId: baseFixture.schoolAPrincipal.authId! })
        .toReturn(StatusCodes.OK);

      expect(res.body.data.id).toBe(baseFixture.schoolAStudent.id);
    });

    it('principal at school A can access students in classes within their school (inherits school→class)', async () => {
      // Principal inherits from parent_org at class level, so principal at schoolA
      // has principal role on classInSchoolA → supervisory_tier_group → can_list_users.
      const res = await expectRoute('GET', `/v1/users/${baseFixture.classAStudent.id}`)
        .as({ id: baseFixture.schoolAPrincipal.id, authId: baseFixture.schoolAPrincipal.authId! })
        .toReturn(StatusCodes.OK);

      expect(res.body.data.id).toBe(baseFixture.classAStudent.id);
    });

    it('principal at school A cannot access students in school B (cross-school isolation)', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolBStudent.id}`)
        .as({ id: baseFixture.schoolAPrincipal.id, authId: baseFixture.schoolAPrincipal.authId! })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('school-level teacher cannot access students at school level (educator_tier excluded from school can_list_users)', async () => {
      // schoolATeacher has teacher role at schoolA. At school level, can_list_users
      // = admin_tier or school_admin_tier — educator_tier is excluded. So teacher
      // at school level cannot see school-enrolled students.
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as({ id: baseFixture.schoolATeacher.id, authId: baseFixture.schoolATeacher.authId! })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('unassigned user can only access themselves', async () => {
      // Unassigned user should not be able to access other users
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as({ id: baseFixture.unassignedUser.id, authId: baseFixture.unassignedUser.authId! })
        .toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('response content', () => {
    it('returns all expected user fields', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.districtAdmin.id}`)
        .as(tiers.superAdmin)
        .toReturn(200);

      expect(res.body.data).toMatchObject({
        id: expect.any(String),
        assessmentPid: expect.any(String),
        userType: baseFixture.districtAdmin.userType,
        nameFirst: baseFixture.districtAdmin.nameFirst,
        nameLast: baseFixture.districtAdmin.nameLast,
        isSuperAdmin: expect.any(Boolean),
        createdAt: expect.any(String),
      });
    });

    it('transforms Date fields to ISO datetime strings', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as(tiers.superAdmin)
        .toReturn(200);

      // createdAt should be an ISO 8601 datetime string
      expect(res.body.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // updatedAt can be null or ISO string
      const { updatedAt } = res.body.data;
      expect(updatedAt).toSatisfy(
        (value: unknown) => value === null || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value as string),
      );
    });

    it('handles nullable fields correctly', async () => {
      // Create a user with minimal data
      const minimalUser = await UserFactory.create({
        nameFirst: null,
        nameMiddle: null,
        nameLast: null,
        email: null,
        username: null,
        dob: null,
        grade: null,
      });

      // Give superAdmin access by creating org membership
      await UserOrgFactory.create({
        userId: minimalUser.id,
        orgId: baseFixture.district.id,
        role: UserRole.STUDENT,
      });

      const res = await expectRoute('GET', `/v1/users/${minimalUser.id}`).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.nameFirst).toBeNull();
      expect(res.body.data.nameMiddle).toBeNull();
      expect(res.body.data.nameLast).toBeNull();
      expect(res.body.data.email).toBeNull();
      expect(res.body.data.username).toBeNull();
      expect(res.body.data.dob).toBeNull();
      expect(res.body.data.grade).toBeNull();
    });

    it('includes all demographic fields when present', async () => {
      // Create a user with full demographic data
      const demographicUser = await UserFactory.create({
        nameFirst: 'Demo',
        nameLast: 'User',
        dob: '2010-03-15',
        grade: '5',
        statusEll: 'active',
        statusFrl: 'Free',
        statusIep: 'yes',
        gender: 'female',
        race: 'asian',
        hispanicEthnicity: true,
        homeLanguage: 'Spanish',
      });

      await UserOrgFactory.create({
        userId: demographicUser.id,
        orgId: baseFixture.district.id,
        role: UserRole.STUDENT,
      });

      const res = await expectRoute('GET', `/v1/users/${demographicUser.id}`).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data).toMatchObject({
        dob: '2010-03-15',
        grade: '5',
        statusEll: 'active',
        statusFrl: 'Free',
        statusIep: 'yes',
        gender: 'female',
        race: 'asian',
        hispanicEthnicity: true,
        homeLanguage: 'Spanish',
      });
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .unauthenticated()
        .toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 403 when user lacks permission', async () => {
      // Student trying to access another student
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolBStudent.id}`)
        .as(tiers.student)
        .toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 404 for non-existent user', async () => {
      const res = await expectRoute('GET', '/v1/users/00000000-0000-0000-0000-000000000000')
        .as(tiers.superAdmin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 404 for a rostering-ended target user — even to super admin (#1742)', async () => {
      // Rostering-ended users are decommissioned: any URL that names them as a
      // target returns 404, with the same code/shape as a non-existent user.
      // The shape is symmetric so requesters can't distinguish whether the
      // target ever existed.
      const endedUser = await UserFactory.create({
        nameLast: 'EndedUserDirectAccess',
        rosteringEnded: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const res = await expectRoute('GET', `/v1/users/${endedUser.id}`).as(tiers.superAdmin).toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 404 for a rostering-ended target user — same shape as not-found (#1742)', async () => {
      const endedUser = await UserFactory.create({
        nameLast: 'EndedUserShapeCheck',
        rosteringEnded: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const endedRes = await expectRoute('GET', `/v1/users/${endedUser.id}`).as(tiers.superAdmin).toReturn(404);
      const notFoundRes = await expectRoute('GET', '/v1/users/00000000-0000-0000-0000-000000000000')
        .as(tiers.superAdmin)
        .toReturn(404);

      // The error code matches — caller can't distinguish the two cases.
      expect(endedRes.body.error.code).toBe(notFoundRes.body.error.code);
    });

    it('returns 400 for invalid UUID format', async () => {
      const res = await expectRoute('GET', '/v1/users/not-a-valid-uuid').as(tiers.superAdmin).toReturn(400);

      const message = res.body.issues.map((issue: { [key: string]: unknown }) => issue.message);
      expect(message).toContain('Invalid uuid');
    });
  });

  describe('edge cases', () => {
    it('handles users with expired enrollment correctly', async () => {
      // Expired enrollment student should not be accessible to non-super admins
      // (based on access control filtering of active enrollments)
      const res = await expectRoute('GET', `/v1/users/${baseFixture.expiredEnrollmentStudent.id}`)
        .as(tiers.admin)
        .toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('super admin can access users with expired enrollment', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.expiredEnrollmentStudent.id}`)
        .as(tiers.superAdmin)
        .toReturn(200);

      expect(res.body.data.id).toBe(baseFixture.expiredEnrollmentStudent.id);
    });

    it('user with future enrollment cannot be accessed by non-super admins', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.futureEnrollmentStudent.id}`)
        .as(tiers.admin)
        .toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('handles multi-assigned users correctly', async () => {
      // Multi-assigned user has memberships in multiple entities
      const res = await expectRoute('GET', `/v1/users/${baseFixture.multiAssignedUser.id}`)
        .as(tiers.admin)
        .toReturn(200);

      expect(res.body.data.id).toBe(baseFixture.multiAssignedUser.id);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /v1/users/:id
// ═══════════════════════════════════════════════════════════════════════════

describe('PATCH /v1/users/:id', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Authorization
  // ─────────────────────────────────────────────────────────────────────────

  describe('authorization', () => {
    let targetUser: Awaited<ReturnType<typeof UserFactory.create>>;

    beforeAll(async () => {
      targetUser = await UserFactory.create({ nameFirst: 'Auth', nameLast: 'Target' });
    });

    it('superAdmin tier can update any user', async () => {
      await expectRoute('PATCH', `/v1/users/${targetUser.id}`)
        .as(tiers.superAdmin)
        .withBody({ nameFirst: 'Updated by superAdmin' })
        .toReturn(StatusCodes.NO_CONTENT);
    });

    it('siteAdmin tier cannot update users', async () => {
      const res = await expectRoute('PATCH', `/v1/users/${targetUser.id}`)
        .as(tiers.siteAdmin)
        .withBody({ nameFirst: 'Should Fail' })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('admin tier cannot update users', async () => {
      const res = await expectRoute('PATCH', `/v1/users/${targetUser.id}`)
        .as(tiers.admin)
        .withBody({ nameFirst: 'Should Fail' })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('educator tier cannot update users', async () => {
      const res = await expectRoute('PATCH', `/v1/users/${targetUser.id}`)
        .as(tiers.educator)
        .withBody({ nameFirst: 'Should Fail' })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('student tier cannot update users', async () => {
      const res = await expectRoute('PATCH', `/v1/users/${targetUser.id}`)
        .as(tiers.student)
        .withBody({ nameFirst: 'Should Fail' })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier cannot update users', async () => {
      const res = await expectRoute('PATCH', `/v1/users/${targetUser.id}`)
        .as(tiers.caregiver)
        .withBody({ nameFirst: 'Should Fail' })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    // Self-update is not yet permitted for non-super-admin users.
    // To enable: assign Permissions.Users.UPDATE to roles in role-permissions.ts,
    // then the service's update() will delegate to verifySupervisoryAccess which
    // allows self-access. Un-skip and adjust the expected status at that point.
    it.skip('non-super admin users cannot update their own profile yet', async () => {
      await expectRoute('PATCH', `/v1/users/${tiers.student.id}`)
        .as(tiers.student)
        .withBody({ nameFirst: 'Self Update' })
        .toReturn(StatusCodes.FORBIDDEN);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Partial update semantics
  // ─────────────────────────────────────────────────────────────────────────

  describe('partial update semantics', () => {
    it('updates only the provided field and leaves others unchanged', async () => {
      const targetUser = await UserFactory.create({
        nameFirst: 'Original',
        nameLast: 'Unchanged',
        grade: '3',
      });

      await expectRoute('PATCH', `/v1/users/${targetUser.id}`)
        .as(tiers.superAdmin)
        .withBody({ nameFirst: 'Updated' })
        .toReturn(StatusCodes.NO_CONTENT);

      // Verify database state using repository
      const updated = await userRepository.getById({ id: targetUser.id });
      expect(updated).not.toBeNull();
      expect(updated!.nameFirst).toBe('Updated');
      // Unchanged fields must not be affected
      expect(updated!.nameLast).toBe('Unchanged');
      expect(updated!.grade).toBe('3');
    });

    it('updates multiple fields in a single request', async () => {
      const targetUser = await UserFactory.create({
        nameFirst: 'Before',
        nameLast: 'Before',
        grade: '4',
      });

      await expectRoute('PATCH', `/v1/users/${targetUser.id}`)
        .as(tiers.superAdmin)
        .withBody({ nameFirst: 'After', nameLast: 'After', grade: '5' })
        .toReturn(StatusCodes.NO_CONTENT);

      // Verify database state using repository
      const updated = await userRepository.getById({ id: targetUser.id });
      expect(updated).not.toBeNull();
      expect(updated!.nameFirst).toBe('After');
      expect(updated!.nameLast).toBe('After');
      expect(updated!.grade).toBe('5');
    });

    it('sets a nullable field to null to clear it', async () => {
      const targetUser = await UserFactory.create({ nameFirst: 'HasAName', grade: '6' });

      await expectRoute('PATCH', `/v1/users/${targetUser.id}`)
        .as(tiers.superAdmin)
        .withBody({ nameFirst: null })
        .toReturn(StatusCodes.NO_CONTENT);

      // Verify database state using repository
      const updated = await userRepository.getById({ id: targetUser.id });
      expect(updated).not.toBeNull();
      expect(updated!.nameFirst).toBeNull();
      // Other fields must remain untouched
      expect(updated!.grade).toBe('6');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('returns 400 for an empty request body', async () => {
      await expectRoute('PATCH', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as(tiers.superAdmin)
        .withBody({})
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 for an invalid UUID in the path', async () => {
      const res = await expectRoute('PATCH', '/v1/users/not-a-valid-uuid')
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.BAD_REQUEST);

      const messages = res.body.issues.map((issue: { message: string }) => issue.message);
      expect(messages).toContain('Invalid uuid');
    });

    it('returns 400 for an invalid enum value', async () => {
      await expectRoute('PATCH', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as(tiers.superAdmin)
        .withBody({ grade: 'not-a-real-grade' })
        .toReturn(StatusCodes.BAD_REQUEST);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Unique constraint violations
  // ─────────────────────────────────────────────────────────────────────────

  describe('unique constraint violations', () => {
    it('returns 409 when the email conflicts with an existing user', async () => {
      const existingUser = await UserFactory.create({ email: 'taken-email@example.com' });
      const targetUser = await UserFactory.create({ email: 'other-email@example.com' });

      const res = await expectRoute('PATCH', `/v1/users/${targetUser.id}`)
        .as(tiers.superAdmin)
        .withBody({ email: existingUser.email })
        .toReturn(StatusCodes.CONFLICT);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });

    it('returns 409 when the username conflicts with an existing user', async () => {
      const existingUser = await UserFactory.create({ username: 'taken-username' });
      const targetUser = await UserFactory.create({ username: 'other-username' });

      const res = await expectRoute('PATCH', `/v1/users/${targetUser.id}`)
        .as(tiers.superAdmin)
        .withBody({ username: existingUser.username })
        .toReturn(StatusCodes.CONFLICT);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Schema strictness
  // ─────────────────────────────────────────────────────────────────────────

  describe('schema strictness', () => {
    it('rejects unknown fields like isSuperAdmin from superAdmin', async () => {
      // Get the original data before attempting the patch
      const originalRes = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      const originalNameFirst = originalRes.body.nameFirst;

      // Super admin users cannot set isSuperAdmin on any user, even though they can update other fields for that user
      await expectRoute('PATCH', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as(tiers.superAdmin)
        .withBody({ nameFirst: 'Valid', isSuperAdmin: true })
        .toReturn(StatusCodes.BAD_REQUEST);

      // Verify the PATCH operation did not modify any data
      const verifyRes = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(verifyRes.body.nameFirst).toBe(originalNameFirst);
      expect(verifyRes.body.nameFirst).not.toBe('Valid');
    });

    it('rejects isSuperAdmin from non-superAdmin with 400 validation error (not 403 authorization error)', async () => {
      // Get the original data before attempting the patch
      const originalRes = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      const originalNameFirst = originalRes.body.nameFirst;

      // Non-superAdmin users get caught by schema validation (400) before authorization layer (403)
      await expectRoute('PATCH', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as(tiers.educator)
        .withBody({ nameFirst: 'Valid', isSuperAdmin: true })
        .toReturn(StatusCodes.BAD_REQUEST);

      // Verify the PATCH operation did not modify any data
      const verifyRes = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(verifyRes.body.nameFirst).toBe(originalNameFirst);
      expect(verifyRes.body.nameFirst).not.toBe('Valid');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Error cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('PATCH', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .unauthenticated()
        .toReturn(StatusCodes.UNAUTHORIZED);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 for a non-existent user', async () => {
      const res = await expectRoute('PATCH', '/v1/users/00000000-0000-0000-0000-000000000000')
        .as(tiers.superAdmin)
        .withBody({ nameFirst: 'Ghost' })
        .toReturn(StatusCodes.NOT_FOUND);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 404 for a rostering-ended target user — same shape as not-found (#1742)', async () => {
      // A rostering-ended user cannot be PATCHed — same 404 shape as
      // not-found so callers can't distinguish.
      const endedUser = await UserFactory.create({
        nameFirst: 'Patch',
        nameLast: 'EndedTarget',
        rosteringEnded: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const res = await expectRoute('PATCH', `/v1/users/${endedUser.id}`)
        .as(tiers.superAdmin)
        .withBody({ nameFirst: 'ShouldNotApply' })
        .toReturn(StatusCodes.NOT_FOUND);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);

      // Verify the underlying row was NOT modified.
      const stillEnded = await userRepository.getById({ id: endedUser.id });
      expect(stillEnded).not.toBeNull();
      expect(stillEnded!.nameFirst).toBe('Patch');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /v1/users/:userId/agreements
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /v1/users/:userId/agreements', () => {
  let tosAgreementVersion: Awaited<ReturnType<typeof AgreementVersionFactory.create>>;
  let consentAgreementVersion: Awaited<ReturnType<typeof AgreementVersionFactory.create>>;
  let assentAgreementVersion: Awaited<ReturnType<typeof AgreementVersionFactory.create>>;
  let adultUser: Awaited<ReturnType<typeof UserFactory.create>>;
  let minorUser: Awaited<ReturnType<typeof UserFactory.create>>;

  beforeAll(async () => {
    const { AgreementFactory } = await import('../test-support/factories/agreement.factory');
    const { AgreementVersionFactory } = await import('../test-support/factories/agreement-version.factory');
    const { AgreementType } = await import('../enums/agreement-type.enum');

    // Create agreements and versions
    const tosAgreement = await AgreementFactory.create({ name: 'Terms of Service', agreementType: AgreementType.TOS });
    const consentAgreement = await AgreementFactory.create({
      name: 'Parent Consent',
      agreementType: AgreementType.CONSENT,
    });
    const assentAgreement = await AgreementFactory.create({
      name: 'Child Assent',
      agreementType: AgreementType.ASSENT,
    });

    tosAgreementVersion = await AgreementVersionFactory.create(
      {
        locale: 'en-US',
        isCurrent: true,
      },
      {
        transient: { agreementId: tosAgreement.id },
      },
    );

    consentAgreementVersion = await AgreementVersionFactory.create(
      {
        locale: 'en-US',
        isCurrent: true,
      },
      {
        transient: { agreementId: consentAgreement.id },
      },
    );

    assentAgreementVersion = await AgreementVersionFactory.create(
      {
        locale: 'en-US',
        isCurrent: true,
      },
      {
        transient: { agreementId: assentAgreement.id },
      },
    );

    // Create test users
    adultUser = await UserFactory.create({ dob: '1990-01-01', grade: null });
    minorUser = await UserFactory.create({ dob: '2015-01-01', grade: '3' });
  });

  describe('self-consent - adult', () => {
    it('should allow adult to consent to TOS agreement', async () => {
      const res = await expectRoute('POST', `/v1/users/${adultUser.id}/agreements`)
        .as({ id: adultUser.id, authId: adultUser.authId! })
        .withBody({ agreementVersionId: tosAgreementVersion.id })
        .toReturn(StatusCodes.CREATED);

      expect(res.body.data.id).toBeDefined();
    });

    it('should allow adult to consent to CONSENT agreement', async () => {
      const res = await expectRoute('POST', `/v1/users/${adultUser.id}/agreements`)
        .as({ id: adultUser.id, authId: adultUser.authId! })
        .withBody({ agreementVersionId: consentAgreementVersion.id })
        .toReturn(StatusCodes.CREATED);

      expect(res.body.data.id).toBeDefined();
    });

    it('should reject adult attempting to consent to ASSENT agreement', async () => {
      const res = await expectRoute('POST', `/v1/users/${adultUser.id}/agreements`)
        .as({ id: adultUser.id, authId: adultUser.authId! })
        .withBody({ agreementVersionId: assentAgreementVersion.id })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('self-consent - minor', () => {
    it('should allow minor to consent to ASSENT agreement', async () => {
      const res = await expectRoute('POST', `/v1/users/${minorUser.id}/agreements`)
        .as({ id: minorUser.id, authId: minorUser.authId! })
        .withBody({ agreementVersionId: assentAgreementVersion.id })
        .toReturn(StatusCodes.CREATED);

      expect(res.body.data.id).toBeDefined();
    });

    it('should reject minor attempting to consent to TOS agreement', async () => {
      const res = await expectRoute('POST', `/v1/users/${minorUser.id}/agreements`)
        .as({ id: minorUser.id, authId: minorUser.authId! })
        .withBody({ agreementVersionId: tosAgreementVersion.id })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('should reject minor attempting to consent to CONSENT agreement', async () => {
      const res = await expectRoute('POST', `/v1/users/${minorUser.id}/agreements`)
        .as({ id: minorUser.id, authId: minorUser.authId! })
        .withBody({ agreementVersionId: consentAgreementVersion.id })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('self-consent - unknown age', () => {
    it('should allow user with unknown age (null dob + null grade) to consent to TOS agreement', async () => {
      const unknownAgeUser = await UserFactory.create({ dob: null, grade: null });
      const res = await expectRoute('POST', `/v1/users/${unknownAgeUser.id}/agreements`)
        .as({ id: unknownAgeUser.id, authId: unknownAgeUser.authId! })
        .withBody({ agreementVersionId: tosAgreementVersion.id })
        .toReturn(StatusCodes.CREATED);

      expect(res.body.data.id).toBeDefined();
    });

    it('should allow user with unknown age to consent to ASSENT agreement', async () => {
      const unknownAgeUser = await UserFactory.create({ dob: null, grade: null });
      const res = await expectRoute('POST', `/v1/users/${unknownAgeUser.id}/agreements`)
        .as({ id: unknownAgeUser.id, authId: unknownAgeUser.authId! })
        .withBody({ agreementVersionId: assentAgreementVersion.id })
        .toReturn(StatusCodes.CREATED);

      expect(res.body.data.id).toBeDefined();
    });

    it('should allow user with unknown age to consent to CONSENT agreement', async () => {
      const unknownAgeUser = await UserFactory.create({ dob: null, grade: null });
      const res = await expectRoute('POST', `/v1/users/${unknownAgeUser.id}/agreements`)
        .as({ id: unknownAgeUser.id, authId: unknownAgeUser.authId! })
        .withBody({ agreementVersionId: consentAgreementVersion.id })
        .toReturn(StatusCodes.CREATED);

      expect(res.body.data.id).toBeDefined();
    });
  });

  describe('parent consent', () => {
    it('should allow parent to consent to ASSENT agreement for minor child', async () => {
      const { UserFamilyFactory } = await import('../test-support/factories/user-family.factory');
      const { FamilyFactory } = await import('../test-support/factories/family.factory');
      const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');

      const parent = await UserFactory.create({ dob: '1985-01-01' });
      const child = await UserFactory.create({ dob: '2015-01-01', grade: '3' });
      const family = await FamilyFactory.create();
      await UserFamilyFactory.create({ userId: parent.id, familyId: family.id, role: 'parent' });
      await UserFamilyFactory.create({ userId: child.id, familyId: family.id, role: 'child' });

      // Sync FGA tuples so the parent↔child family relationship is visible to FGA
      await syncFgaTuplesFromPostgres();

      const res = await expectRoute('POST', `/v1/users/${child.id}/agreements`)
        .as({ id: parent.id, authId: parent.authId! })
        .withBody({ agreementVersionId: assentAgreementVersion.id })
        .toReturn(StatusCodes.CREATED);

      expect(res.body.data.id).toBeDefined();
    });

    it('should reject parent attempting to consent to TOS for child', async () => {
      const { UserFamilyFactory } = await import('../test-support/factories/user-family.factory');
      const { FamilyFactory } = await import('../test-support/factories/family.factory');
      const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');

      const parent = await UserFactory.create({ dob: '1985-01-01' });
      const child = await UserFactory.create({ dob: '2015-01-01', grade: '3' });
      const family = await FamilyFactory.create();
      await UserFamilyFactory.create({ userId: parent.id, familyId: family.id, role: 'parent' });
      await UserFamilyFactory.create({ userId: child.id, familyId: family.id, role: 'child' });

      // Sync FGA tuples so the parent↔child family relationship is visible to FGA
      await syncFgaTuplesFromPostgres();

      const res = await expectRoute('POST', `/v1/users/${child.id}/agreements`)
        .as({ id: parent.id, authId: parent.authId! })
        .withBody({ agreementVersionId: tosAgreementVersion.id })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('should reject user without family relationship attempting to consent', async () => {
      const unrelatedUser = await UserFactory.create({ dob: '1985-01-01' });
      const targetChild = await UserFactory.create({ dob: '2015-01-01', grade: '3' });

      const res = await expectRoute('POST', `/v1/users/${targetChild.id}/agreements`)
        .as({ id: unrelatedUser.id, authId: unrelatedUser.authId! })
        .withBody({ agreementVersionId: assentAgreementVersion.id })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('should reject teacher with class access but no family relationship', async () => {
      const teacher = await UserFactory.create({ dob: '1980-01-01' });
      const targetChild = await UserFactory.create({ dob: '2015-01-01', grade: '3' });

      // Create class relationship: both teacher and student in same class
      await UserClassFactory.create({
        userId: teacher.id,
        classId: baseFixture.classInSchoolA.id,
        role: UserRole.TEACHER,
      });
      await UserClassFactory.create({
        userId: targetChild.id,
        classId: baseFixture.classInSchoolA.id,
        role: UserRole.STUDENT,
      });

      const res = await expectRoute('POST', `/v1/users/${targetChild.id}/agreements`)
        .as({ id: teacher.id, authId: teacher.authId! })
        .withBody({ agreementVersionId: assentAgreementVersion.id })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('should reject parent attempting to consent for adult child', async () => {
      const { UserFamilyFactory } = await import('../test-support/factories/user-family.factory');
      const { FamilyFactory } = await import('../test-support/factories/family.factory');
      const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');

      const parent = await UserFactory.create({ dob: '1960-01-01' });
      const adultChild = await UserFactory.create({ dob: '1995-01-01', grade: null });
      const family = await FamilyFactory.create();
      await UserFamilyFactory.create({ userId: parent.id, familyId: family.id, role: 'parent' });
      await UserFamilyFactory.create({ userId: adultChild.id, familyId: family.id, role: 'child' });

      // Sync FGA tuples so the parent↔child family relationship is visible to FGA
      await syncFgaTuplesFromPostgres();

      const res = await expectRoute('POST', `/v1/users/${adultChild.id}/agreements`)
        .as({ id: parent.id, authId: parent.authId! })
        .withBody({ agreementVersionId: assentAgreementVersion.id })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('validation', () => {
    it('should return 404 when target user does not exist', async () => {
      const res = await expectRoute('POST', '/v1/users/00000000-0000-0000-0000-000000000000/agreements')
        .as(tiers.superAdmin)
        .withBody({ agreementVersionId: tosAgreementVersion.id })
        .toReturn(StatusCodes.NOT_FOUND);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('should return 404 when target user is rostering-ended (#1742)', async () => {
      // Even with a valid agreement version and a super-admin requester,
      // a rostering-ended target user yields 404 with the same code as not-found.
      const endedUser = await UserFactory.create({
        dob: '1990-01-01',
        rosteringEnded: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const res = await expectRoute('POST', `/v1/users/${endedUser.id}/agreements`)
        .as(tiers.superAdmin)
        .withBody({ agreementVersionId: tosAgreementVersion.id })
        .toReturn(StatusCodes.NOT_FOUND);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('should return 404 when agreement version does not exist', async () => {
      const res = await expectRoute('POST', `/v1/users/${adultUser.id}/agreements`)
        .as({ id: adultUser.id, authId: adultUser.authId! })
        .withBody({ agreementVersionId: '00000000-0000-0000-0000-000000000000' })
        .toReturn(StatusCodes.NOT_FOUND);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await expectRoute('POST', `/v1/users/${adultUser.id}/agreements`)
        .unauthenticated()
        .withBody({ agreementVersionId: tosAgreementVersion.id })
        .toReturn(StatusCodes.UNAUTHORIZED);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('should return 400 when agreementVersionId is missing', async () => {
      await expectRoute('POST', `/v1/users/${adultUser.id}/agreements`)
        .as({ id: adultUser.id, authId: adultUser.authId! })
        .withBody({})
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('should return 400 when agreementVersionId is invalid UUID', async () => {
      await expectRoute('POST', `/v1/users/${adultUser.id}/agreements`)
        .as({ id: adultUser.id, authId: adultUser.authId! })
        .withBody({ agreementVersionId: 'not-a-uuid' })
        .toReturn(StatusCodes.BAD_REQUEST);
    });
  });

  describe('duplicate consent', () => {
    it('returns 409 when user attempts to consent to an agreement version they already have', async () => {
      const freshAdult = await UserFactory.create({ dob: '1990-01-01', grade: null });
      const asUser = { id: freshAdult.id, authId: freshAdult.authId! };

      // First consent succeeds
      await expectRoute('POST', `/v1/users/${freshAdult.id}/agreements`)
        .as(asUser)
        .withBody({ agreementVersionId: tosAgreementVersion.id })
        .toReturn(StatusCodes.CREATED);

      // Second consent to the same version returns 409
      const res2 = await expectRoute('POST', `/v1/users/${freshAdult.id}/agreements`)
        .as(asUser)
        .withBody({ agreementVersionId: tosAgreementVersion.id })
        .toReturn(StatusCodes.CONFLICT);

      expect(res2.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });

    it('returns 409 when parent attempts to re-consent to the same agreement version for child', async () => {
      const { UserFamilyFactory } = await import('../test-support/factories/user-family.factory');
      const { FamilyFactory } = await import('../test-support/factories/family.factory');
      const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');

      const parent = await UserFactory.create({ dob: '1985-01-01' });
      const child = await UserFactory.create({ dob: '2015-01-01', grade: '3' });
      const family = await FamilyFactory.create();
      await UserFamilyFactory.create({ userId: parent.id, familyId: family.id, role: 'parent' });
      await UserFamilyFactory.create({ userId: child.id, familyId: family.id, role: 'child' });

      // Sync FGA tuples so the parent↔child family relationship is visible to FGA
      await syncFgaTuplesFromPostgres();

      const asParent = { id: parent.id, authId: parent.authId! };

      // First consent succeeds
      await expectRoute('POST', `/v1/users/${child.id}/agreements`)
        .as(asParent)
        .withBody({ agreementVersionId: assentAgreementVersion.id })
        .toReturn(StatusCodes.CREATED);

      // Second consent to the same version returns 409
      const res2 = await expectRoute('POST', `/v1/users/${child.id}/agreements`)
        .as(asParent)
        .withBody({ agreementVersionId: assentAgreementVersion.id })
        .toReturn(StatusCodes.CONFLICT);

      expect(res2.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/users/:userId/administrations
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/users/:userId/administrations', () => {
  describe('authorization', () => {
    it('super admin can list administrations for any user', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}/administrations`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('user can list their own administrations', async () => {
      const res = await expectRoute('GET', `/v1/users/${tiers.student.id}/administrations`)
        .as(tiers.student)
        .toReturn(StatusCodes.OK);

      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('admin can list administrations for users in their district', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}/administrations`)
        .as(tiers.admin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}/administrations`)
        .unauthenticated()
        .toReturn(StatusCodes.UNAUTHORIZED);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });
  });

  describe('response structure', () => {
    it('returns paginated response with items and pagination metadata', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}/administrations`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toMatchObject({
        page: expect.any(Number),
        perPage: expect.any(Number),
        totalItems: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('transforms administration fields correctly', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}/administrations`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data.items.length).toBeGreaterThan(0);
      const admin = res.body.data.items[0];
      expect(admin).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        publicName: expect.any(String),
        dates: {
          start: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          end: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          created: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        },
        isOrdered: expect.any(Boolean),
      });
    });

    it('does not include stats or tasks by default', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}/administrations`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data.items.length).toBeGreaterThan(0);
      const admin = res.body.data.items[0];
      expect(admin).not.toHaveProperty('stats');
      expect(admin).not.toHaveProperty('tasks');
    });
  });

  describe('pagination', () => {
    it('respects page parameter', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations?page=1&perPage=10`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.perPage).toBe(10);
    });

    it('respects perPage parameter', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations?page=1&perPage=5`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data.pagination.perPage).toBe(5);
      expect(res.body.data.items.length).toBeLessThanOrEqual(5);
    });

    it('calculates totalPages correctly', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations?page=1&perPage=10`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      const { totalItems, perPage, totalPages } = res.body.data.pagination;
      expect(totalPages).toBe(Math.ceil(totalItems / perPage));
    });
  });

  describe('sorting', () => {
    it('respects sortBy and sortOrder parameters', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations?sortBy=name&sortOrder=asc`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data).toHaveProperty('items');
    });

    it('defaults to createdAt desc when sort parameters not provided', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}/administrations`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data).toHaveProperty('items');
    });
  });

  describe('embed options', () => {
    it('includes stats when embed=stats', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}/administrations?embed=stats`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data.items.length).toBeGreaterThan(0);
      const adminWithStats = res.body.data.items.find((item: Administration) => item.stats);
      if (!adminWithStats) {
        throw new Error('Expected at least one administration with embedded stats');
      }
      expect(adminWithStats.stats).toMatchObject({
        assigned: expect.any(Number),
        started: expect.any(Number),
        completed: expect.any(Number),
      });
    });

    it('includes tasks when embed=tasks', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}/administrations?embed=tasks`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data.items.length).toBeGreaterThan(0);
      const adminWithTasks = res.body.data.items.find((item: Administration) => item.tasks);
      if (!adminWithTasks) {
        throw new Error('Expected at least one administration with embedded tasks');
      }
      expect(Array.isArray(adminWithTasks.tasks)).toBe(true);
    });

    it('includes both stats and tasks when embed=stats,tasks', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations?embed=stats,tasks`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data).toHaveProperty('items');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // embed=progress (retake eligibility)
  //
  // Real-database proof that the cross-id-space matches the service performs
  // actually line up against seeded data — a thing mocked unit tests cannot
  // catch. Two id-space joins are under test:
  //   1. The canonical run is matched to its administration task by
  //      `run.taskVariantId === AdministrationTask.variantId`.
  //   2. `allowRetake` excludes tasks whose `slug` is in
  //      TASKS_EXCLUDED_FROM_RETAKE, resolved slug → task UUID at runtime.
  //
  // A self-contained district-level administration is seeded with four task
  // variants so each branch of the `allowRetake` rule is exercised against the
  // SAME response, without mutating any shared baseFixture row. The target
  // (path) user is `schoolAStudent`; the supervisory user-scoped path attaches
  // that user's run state, so runs are seeded for `schoolAStudent`.
  // ─────────────────────────────────────────────────────────────────────────

  describe('embed=progress (retake eligibility)', () => {
    // A non-excluded slug — the `unreliable` and `reliable` variants hang off
    // this task so retake eligibility is driven purely by `reliableRun`.
    const NON_EXCLUDED_SLUG = `progress-included-${faker.string.alphanumeric(8).toLowerCase()}`;
    // A genuinely-excluded slug (must exist in TASKS_EXCLUDED_FROM_RETAKE).
    const EXCLUDED_SLUG = 'ran';

    let progressAdmin: DbAdministration;
    let unreliableVariant: DbTaskVariant;
    let reliableVariant: DbTaskVariant;
    let noRunVariant: DbTaskVariant;
    let excludedVariant: DbTaskVariant;
    let includedTaskId: string;
    let excludedTaskId: string;

    // Canonical-run completion timestamps — distinct per task so each
    // `completedOn` assertion proves the run was matched to the right variant.
    const unreliableCompletedAt = new Date('2025-09-03T14:20:00.000Z');
    const reliableCompletedAt = new Date('2025-09-04T09:15:00.000Z');
    const excludedCompletedAt = new Date('2025-09-05T11:05:00.000Z');

    beforeAll(async () => {
      const { AdministrationFactory } = await import('../test-support/factories/administration.factory');
      const { AdministrationOrgFactory } = await import('../test-support/factories/administration-org.factory');
      const { TaskFactory } = await import('../test-support/factories/task.factory');
      const { TaskVariantFactory } = await import('../test-support/factories/task-variant.factory');
      const { AdministrationTaskVariantFactory } =
        await import('../test-support/factories/administration-task-variant.factory');
      const { RunFactory } = await import('../test-support/factories/run.factory');
      const { writeFgaAdministrationAssignment } = await import('../test-support/fga/fga-test-tuples.helper');
      const { TASKS_EXCLUDED_FROM_RETAKE } = await import('../constants/tasks-excluded-from-retake');

      // Guard the premise of case 4: assert in setup via throws, since expect()
      // outside a test block violates vitest/no-standalone-expect.
      if (!TASKS_EXCLUDED_FROM_RETAKE.has(EXCLUDED_SLUG)) {
        throw new Error(`Test premise broken: "${EXCLUDED_SLUG}" must be in TASKS_EXCLUDED_FROM_RETAKE`);
      }
      if (TASKS_EXCLUDED_FROM_RETAKE.has(NON_EXCLUDED_SLUG)) {
        throw new Error(`Test premise broken: "${NON_EXCLUDED_SLUG}" must NOT be in TASKS_EXCLUDED_FROM_RETAKE`);
      }

      // Self-contained district-level administration the student can access via
      // the same class → school → district hierarchy as the other fixtures.
      progressAdmin = await AdministrationFactory.create({
        name: 'Progress Embed Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({ administrationId: progressAdmin.id, orgId: baseFixture.district.id });
      await writeFgaAdministrationAssignment(progressAdmin.id, baseFixture.district.id, FgaType.DISTRICT);

      // Two tasks: one validity-checked (non-excluded slug), one excluded.
      const includedTask = await TaskFactory.create({ name: 'Progress Included Task', slug: NON_EXCLUDED_SLUG });
      const excludedTask = await TaskFactory.create({ name: 'Progress Excluded Task', slug: EXCLUDED_SLUG });
      includedTaskId = includedTask.id;
      excludedTaskId = excludedTask.id;

      [unreliableVariant, reliableVariant, noRunVariant, excludedVariant] = await Promise.all([
        TaskVariantFactory.create({ taskId: includedTask.id, name: 'Unreliable Variant' }),
        TaskVariantFactory.create({ taskId: includedTask.id, name: 'Reliable Variant' }),
        TaskVariantFactory.create({ taskId: includedTask.id, name: 'No Run Variant' }),
        TaskVariantFactory.create({ taskId: excludedTask.id, name: 'Excluded Variant' }),
      ]);

      await Promise.all([
        AdministrationTaskVariantFactory.create({
          administrationId: progressAdmin.id,
          taskVariantId: unreliableVariant.id,
          orderIndex: 0,
        }),
        AdministrationTaskVariantFactory.create({
          administrationId: progressAdmin.id,
          taskVariantId: reliableVariant.id,
          orderIndex: 1,
        }),
        AdministrationTaskVariantFactory.create({
          administrationId: progressAdmin.id,
          taskVariantId: noRunVariant.id,
          orderIndex: 2,
        }),
        AdministrationTaskVariantFactory.create({
          administrationId: progressAdmin.id,
          taskVariantId: excludedVariant.id,
          orderIndex: 3,
        }),
      ]);

      // Canonical (use_for_reporting=true) runs for the target student, keyed to
      // the REAL taskVariantId of each administration task. `taskVariantId` is the
      // join under test; `taskId` mirrors the variant's task for realism only.
      await Promise.all([
        // Unreliable → retake allowed (non-excluded task).
        RunFactory.create({
          userId: baseFixture.schoolAStudent.id,
          administrationId: progressAdmin.id,
          taskVariantId: unreliableVariant.id,
          taskId: includedTask.id,
          useForReporting: true,
          reliableRun: false,
          completedAt: unreliableCompletedAt,
        }),
        // Reliable → retake NOT allowed.
        RunFactory.create({
          userId: baseFixture.schoolAStudent.id,
          administrationId: progressAdmin.id,
          taskVariantId: reliableVariant.id,
          taskId: includedTask.id,
          useForReporting: true,
          reliableRun: true,
          completedAt: reliableCompletedAt,
        }),
        // Excluded slug + unreliable → retake NOT allowed (slug → UUID exclusion).
        RunFactory.create({
          userId: baseFixture.schoolAStudent.id,
          administrationId: progressAdmin.id,
          taskVariantId: excludedVariant.id,
          taskId: excludedTask.id,
          useForReporting: true,
          reliableRun: false,
          completedAt: excludedCompletedAt,
        }),
        // `noRunVariant` is intentionally left without any run so it reports nulls.
      ]);

      // Pick up the administration assignment tuple written above.
      const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');
      await syncFgaTuplesFromPostgres();
    });

    /**
     * Fetch the seeded progress administration with its tasks embed and return a
     * lookup from `variantId` → task object (which carries `progress`). Asserts
     * the administration and all four task variants are present in the response.
     */
    async function getProgressTasksByVariantId(): Promise<Map<string, AdministrationTask>> {
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations?embed=progress&perPage=100`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      const admin = res.body.data.items.find((item: Administration) => item.id === progressAdmin.id);
      if (!admin) {
        throw new Error('Expected the seeded progress administration in the response');
      }
      const tasks = (admin.tasks ?? []) as AdministrationTask[];
      return new Map(tasks.map((task) => [task.variantId, task]));
    }

    it('matches the canonical run by variantId — the run.taskVariantId join lines up with the response variantId', async () => {
      const byVariant = await getProgressTasksByVariantId();

      // The match under test: the seeded run.taskVariantId is the SAME id that
      // surfaces as the administration task's variantId in the response.
      const unreliableTask = byVariant.get(unreliableVariant.id);
      expect(unreliableTask).toBeDefined();
      expect(unreliableTask!.variantId).toBe(unreliableVariant.id);
      expect(unreliableTask!.taskId).toBe(includedTaskId);
      expect(unreliableTask!.progress).toBeDefined();
    });

    it('allows retake for an unreliable canonical run on a validity-checked task', async () => {
      const byVariant = await getProgressTasksByVariantId();
      const task = byVariant.get(unreliableVariant.id);

      expect(task!.progress).toEqual({
        startedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        completedOn: unreliableCompletedAt.toISOString(),
        allowRetake: true,
      });
    });

    it('does not allow retake when the canonical run is reliable', async () => {
      const byVariant = await getProgressTasksByVariantId();
      const task = byVariant.get(reliableVariant.id);

      expect(task!.progress).toEqual({
        startedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        completedOn: reliableCompletedAt.toISOString(),
        allowRetake: false,
      });
    });

    it('reports nulls and no retake for a task with no canonical run', async () => {
      const byVariant = await getProgressTasksByVariantId();
      const task = byVariant.get(noRunVariant.id);

      expect(task!.progress).toEqual({
        startedOn: null,
        completedOn: null,
        allowRetake: false,
      });
    });

    it('does not allow retake for an excluded-slug task even when the canonical run is unreliable', async () => {
      const byVariant = await getProgressTasksByVariantId();
      const task = byVariant.get(excludedVariant.id);

      // The slug → UUID exclusion proof: an unreliable canonical run would
      // normally allow a retake, but this task's slug ('ran') is in
      // TASKS_EXCLUDED_FROM_RETAKE, so retake is suppressed.
      expect(task!.taskId).toBe(excludedTaskId);
      expect(task!.progress).toEqual({
        startedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        completedOn: excludedCompletedAt.toISOString(),
        allowRetake: false,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // per-student optional/assigned (attached alongside progress)
  //
  // Real-database proof that the assigned_if/optional_if conditions stored as
  // jsonb on administration_task_variants are evaluated against the TARGET
  // user's real demographics and surfaced as `assigned`/`optional` on each
  // task — without dropping any task from the list. These flags ride along on
  // the `embed=progress` per-student pass (which implies `tasks`).
  //
  // The target (path) user is `schoolAStudent`, who has no explicit grade
  // (grade IS NULL). Three task variants exercise the truth table against that
  // user:
  //   1. assigned_if = null,            optional_if = null            → assigned, required
  //   2. assigned_if = (grade == '5'),  optional_if = null            → NOT assigned (null grade fails), required
  //   3. assigned_if = null,            optional_if = true (SelectAll)→ assigned, optional
  //
  // No runs are seeded — `progress` resolves to nulls, which is fine; this
  // block asserts only the assignment flags.
  // ─────────────────────────────────────────────────────────────────────────

  describe('per-student optional/assigned (alongside progress)', () => {
    // assigned_if the null-grade target student fails (grade EQUAL '5').
    const ASSIGNED_IF_GRADE_5: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: '5' };
    // optional_if that matches everyone (SelectAllCondition).
    const OPTIONAL_IF_ALL: Condition = true;

    let optionalAdmin: DbAdministration;
    let requiredAssignedVariant: DbTaskVariant;
    let notAssignedVariant: DbTaskVariant;
    let optionalAssignedVariant: DbTaskVariant;

    beforeAll(async () => {
      const { AdministrationFactory } = await import('../test-support/factories/administration.factory');
      const { AdministrationOrgFactory } = await import('../test-support/factories/administration-org.factory');
      const { TaskFactory } = await import('../test-support/factories/task.factory');
      const { TaskVariantFactory } = await import('../test-support/factories/task-variant.factory');
      const { AdministrationTaskVariantFactory } =
        await import('../test-support/factories/administration-task-variant.factory');
      const { writeFgaAdministrationAssignment } = await import('../test-support/fga/fga-test-tuples.helper');

      // Self-contained district-level administration the student can access via
      // the same class → school → district hierarchy as the other fixtures.
      optionalAdmin = await AdministrationFactory.create({
        name: 'Optional/Assigned Embed Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({ administrationId: optionalAdmin.id, orgId: baseFixture.district.id });
      await writeFgaAdministrationAssignment(optionalAdmin.id, baseFixture.district.id, FgaType.DISTRICT);

      const task = await TaskFactory.create({
        name: 'Optional Embed Task',
        slug: `optional-embed-${faker.string.alphanumeric(8).toLowerCase()}`,
      });

      [requiredAssignedVariant, notAssignedVariant, optionalAssignedVariant] = await Promise.all([
        TaskVariantFactory.create({ taskId: task.id, name: 'Required Assigned Variant' }),
        TaskVariantFactory.create({ taskId: task.id, name: 'Not Assigned Variant' }),
        TaskVariantFactory.create({ taskId: task.id, name: 'Optional Assigned Variant' }),
      ]);

      await Promise.all([
        // assigned (no assigned_if), required (no optional_if).
        AdministrationTaskVariantFactory.create({
          administrationId: optionalAdmin.id,
          taskVariantId: requiredAssignedVariant.id,
          orderIndex: 0,
          conditionsAssignment: null,
          conditionsRequirements: null,
        }),
        // assigned_if the null-grade student fails → NOT assigned.
        AdministrationTaskVariantFactory.create({
          administrationId: optionalAdmin.id,
          taskVariantId: notAssignedVariant.id,
          orderIndex: 1,
          conditionsAssignment: ASSIGNED_IF_GRADE_5,
          conditionsRequirements: null,
        }),
        // assigned (no assigned_if), optional_if matches everyone → optional.
        AdministrationTaskVariantFactory.create({
          administrationId: optionalAdmin.id,
          taskVariantId: optionalAssignedVariant.id,
          orderIndex: 2,
          conditionsAssignment: null,
          conditionsRequirements: OPTIONAL_IF_ALL,
        }),
      ]);

      // Pick up the administration assignment tuple written above.
      const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');
      await syncFgaTuplesFromPostgres();
    });

    /**
     * Fetch the seeded optional/assigned administration with its tasks embed and
     * return a lookup from `variantId` → task object (carrying optional/assigned).
     *
     * `optional`/`assigned` are attached alongside `progress` on the user-scoped
     * path, so we request `embed=progress` (which implies `tasks`).
     */
    async function getOptionalTasksByVariantId(): Promise<Map<string, AdministrationTask>> {
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations?embed=progress&perPage=100`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      const admin = res.body.data.items.find((item: Administration) => item.id === optionalAdmin.id);
      if (!admin) {
        throw new Error('Expected the seeded optional/assigned administration in the response');
      }
      const tasks = (admin.tasks ?? []) as AdministrationTask[];
      return new Map(tasks.map((task) => [task.variantId, task]));
    }

    it('returns the full task list — an unassigned task is flagged, not removed', async () => {
      const byVariant = await getOptionalTasksByVariantId();

      // All three variants are present despite one being unassigned.
      expect(byVariant.size).toBe(3);
      expect(byVariant.has(requiredAssignedVariant.id)).toBe(true);
      expect(byVariant.has(notAssignedVariant.id)).toBe(true);
      expect(byVariant.has(optionalAssignedVariant.id)).toBe(true);
    });

    it('flags a task with no assigned_if and no optional_if as assigned and required', async () => {
      const byVariant = await getOptionalTasksByVariantId();
      const task = byVariant.get(requiredAssignedVariant.id);

      expect(task!.assigned).toBe(true);
      expect(task!.optional).toBe(false);
    });

    it('flags a task whose assigned_if the target user fails as not assigned', async () => {
      const byVariant = await getOptionalTasksByVariantId();
      const task = byVariant.get(notAssignedVariant.id);

      // schoolAStudent has no grade, so `grade == '5'` is false → not assigned.
      expect(task!.assigned).toBe(false);
    });

    it('flags a task whose optional_if matches the target user as optional', async () => {
      const byVariant = await getOptionalTasksByVariantId();
      const task = byVariant.get(optionalAssignedVariant.id);

      expect(task!.assigned).toBe(true);
      expect(task!.optional).toBe(true);
    });

    it('does not leak the internal assignment conditions in the response', async () => {
      const byVariant = await getOptionalTasksByVariantId();
      const task = byVariant.get(requiredAssignedVariant.id);

      expect(task).not.toHaveProperty('conditionsAssignment');
      expect(task).not.toHaveProperty('conditionsRequirements');
    });
  });

  describe('filtering', () => {
    it('respects status filter when provided', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}/administrations?status=active`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data).toHaveProperty('items');
    });
  });

  describe('empty results', () => {
    it('returns empty array when user has no administrations', async () => {
      const userWithNoAdmins = await UserFactory.create();
      await UserOrgFactory.create({
        userId: userWithNoAdmins.id,
        orgId: baseFixture.district.id,
        role: UserRole.STUDENT,
      });

      const res = await expectRoute('GET', `/v1/users/${userWithNoAdmins.id}/administrations`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.pagination.totalItems).toBe(0);
      expect(res.body.data.pagination.totalPages).toBe(0);
    });
  });

  describe('validation', () => {
    it('returns 404 when target user does not exist', async () => {
      const res = await expectRoute('GET', '/v1/users/00000000-0000-0000-0000-000000000000/administrations')
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.NOT_FOUND);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 404 when target user is rostering-ended (#1742)', async () => {
      const endedUser = await UserFactory.create({
        nameLast: 'EndedAdminsList1742',
        rosteringEnded: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const res = await expectRoute('GET', `/v1/users/${endedUser.id}/administrations`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.NOT_FOUND);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 403 when a rostering-ended user requests their own administrations (#1742)', async () => {
      // End-to-end, the auth guard (#1735) blocks rostering-ended users at
      // the middleware layer and returns 403 AUTH_ROSTERING_ENDED before
      // any handler runs — so the service-layer 404 (which would otherwise
      // fire for a self-lookup against a rostering-ended target) is
      // unreachable from a route test. We still want to verify the
      // user-visible behavior: a rostering-ended user can't access their
      // own administrations.
      //
      // The service-layer defense-in-depth (rejectRosteringEndedTarget
      // running BEFORE the `requesterUserId === userId` early return)
      // matters if the auth guard logic is ever bypassed or changed —
      // that path is covered by the unit test in
      // `administration.service.test.ts`.
      const endedUser = await UserFactory.create({
        nameLast: 'EndedSelfAdmin1742',
        rosteringEnded: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const res = await expectRoute('GET', `/v1/users/${endedUser.id}/administrations`)
        .as({ id: endedUser.id, authId: endedUser.authId! })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_ROSTERING_ENDED);
    });

    it('returns 403 when non-super-admin tries to list administrations for user with no shared access', async () => {
      // districtBStudent is in a different district from tiers.admin (who is in districtA)
      const res = await expectRoute('GET', `/v1/users/${baseFixture.districtBStudent.id}/administrations`)
        .as(tiers.admin)
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 400 for invalid UUID in userId parameter', async () => {
      const res = await expectRoute('GET', '/v1/users/not-a-valid-uuid/administrations')
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.BAD_REQUEST);

      const messages = res.body.issues.map((issue: { message: string }) => issue.message);
      expect(messages).toContain('Invalid uuid');
    });

    it('returns 400 for invalid page parameter', async () => {
      await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}/administrations?page=0`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 for invalid perPage parameter', async () => {
      await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}/administrations?perPage=0`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 for invalid sortBy parameter', async () => {
      await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}/administrations?sortBy=invalidField`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 for invalid sortOrder parameter', async () => {
      await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}/administrations?sortOrder=invalid`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.BAD_REQUEST);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /v1/users
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /v1/users', () => {
  let platformAdmin: { id: string; authId: string };
  let schoolAPlatformAdmin: { id: string; authId: string };
  let groupPlatformAdmin: { id: string; authId: string };
  let otherGroup: { id: string };

  // Cast to access vi.fn() mock methods — these are vi.fn() at runtime because
  // firebase-admin/auth is mocked globally in vitest.setup.ts
  const mockAuth = FirebaseAuthClient as unknown as {
    createUser: ReturnType<typeof vi.fn>;
    getUserByEmail: ReturnType<typeof vi.fn>;
    deleteUser: ReturnType<typeof vi.fn>;
  };

  // Monotonic counter for unique test emails — avoids Date.now() collisions
  let emailSeq = 0;
  const makeEmail = (suffix: string) => `post-users-${++emailSeq}-${suffix}@test.example.com`;

  const validBodyForDistrict = (suffix: string) => ({
    email: makeEmail(suffix),
    password: 'Password123!',
    name: { first: 'Test', last: 'User' },
    memberships: [{ entityType: EntityType.DISTRICT, entityId: baseFixture.district.id, role: 'student' }],
  });

  const validBodyForSchoolInDistrict = (suffix: string) => ({
    email: makeEmail(suffix),
    password: 'Password123!',
    name: { first: 'Test', last: 'User' },
    memberships: [
      { entityType: EntityType.DISTRICT, entityId: baseFixture.district.id, role: 'student' },
      { entityType: EntityType.SCHOOL, entityId: baseFixture.schoolA.id, role: 'student' },
    ],
  });

  const validBodyForClassInSchoolInDistrict = (suffix: string) => ({
    email: makeEmail(suffix),
    password: 'Password123!',
    name: { first: 'Test', last: 'User' },
    memberships: [
      { entityType: EntityType.DISTRICT, entityId: baseFixture.district.id, role: 'student' },
      { entityType: EntityType.SCHOOL, entityId: baseFixture.schoolA.id, role: 'student' },
      { entityType: EntityType.CLASS, entityId: baseFixture.classInSchoolA.id, role: 'student' },
    ],
  });

  const validBodyForGroupInDistrict = (suffix: string) => ({
    email: makeEmail(suffix),
    password: 'Password123!',
    name: { first: 'Test', last: 'User' },
    memberships: [
      { entityType: EntityType.DISTRICT, entityId: baseFixture.district.id, role: 'student' },
      { entityType: EntityType.GROUP, entityId: baseFixture.group.id, role: 'student' },
    ],
  });

  let sharedFamily: { id: string };

  const validBodyForFamilyInDistrict = (suffix: string) => ({
    email: makeEmail(suffix),
    password: 'Password123!',
    name: { first: 'Test', last: 'User' },
    memberships: [
      { entityType: EntityType.DISTRICT, entityId: baseFixture.district.id, role: 'student' },
      { entityType: EntityType.FAMILY, entityId: sharedFamily.id, role: 'parent' },
    ],
  });

  beforeAll(async () => {
    const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');
    const { FamilyFactory } = await import('../test-support/factories/family.factory');
    const { UserGroupFactory } = await import('../test-support/factories/user-group.factory');
    const { GroupFactory } = await import('../test-support/factories/group.factory');

    const platformAdminUser = await UserFactory.create({ nameFirst: 'Platform', nameLast: 'Admin' });
    await UserOrgFactory.create({
      userId: platformAdminUser.id,
      orgId: baseFixture.district.id,
      role: UserRole.PLATFORM_ADMIN,
    });
    platformAdmin = { id: platformAdminUser.id, authId: platformAdminUser.authId! };

    const schoolAPlatformAdminUser = await UserFactory.create({ nameFirst: 'SchoolA Platform', nameLast: 'Admin' });
    await UserOrgFactory.create({
      userId: schoolAPlatformAdminUser.id,
      orgId: baseFixture.schoolA.id,
      role: UserRole.PLATFORM_ADMIN,
    });
    schoolAPlatformAdmin = { id: schoolAPlatformAdminUser.id, authId: schoolAPlatformAdminUser.authId! };

    const groupPlatformAdminUser = await UserFactory.create({ nameFirst: 'Group Platform', nameLast: 'Admin' });
    await UserGroupFactory.create({
      userId: groupPlatformAdminUser.id,
      groupId: baseFixture.group.id,
      role: UserRole.PLATFORM_ADMIN,
    });
    groupPlatformAdmin = { id: groupPlatformAdminUser.id, authId: groupPlatformAdminUser.authId! };

    sharedFamily = await FamilyFactory.create();
    otherGroup = await GroupFactory.create();

    // Re-sync FGA tuples to pick up all new memberships
    await syncFgaTuplesFromPostgres();
  });

  beforeEach(() => {
    // Global vitest.setup.ts beforeEach already calls vi.clearAllMocks() (clears call history
    // only, not implementations). Set default Firebase behavior: user doesn't exist,
    // creation succeeds. Individual tests can override these before calling expectRoute.
    mockAuth.getUserByEmail.mockRejectedValue(Object.assign(new Error('Not found'), { code: 'auth/user-not-found' }));
    mockAuth.createUser.mockResolvedValue({ uid: `test-firebase-uid-${emailSeq}` });
    mockAuth.deleteUser.mockResolvedValue(undefined);
  });

  describe('authorization', () => {
    it('super admin can create a user', async () => {
      const body = validBodyForDistrict('superadmin');
      const res = await expectRoute('POST', '/v1/users').as(tiers.superAdmin).withBody(body).toReturn(201);

      expect(res.body.data.id).toBeDefined();

      const created = await userRepository.getById({ id: res.body.data.id });
      expect(created).not.toBeNull();
      expect(created!.email).toBe(body.email);
    });

    it('platform_admin can create a user at their district', async () => {
      const body = validBodyForDistrict('platform-admin');
      const res = await expectRoute('POST', '/v1/users').as(platformAdmin).withBody(body).toReturn(201);

      expect(res.body.data.id).toBeDefined();

      const memberships = await userRepository.getUserEntityMemberships(res.body.data.id);
      const districtMembership = memberships.find((m) => m.entityId === baseFixture.district.id);
      expect(districtMembership).toBeDefined();
    });

    it('platform_admin can create a user at a school in their district', async () => {
      const body = validBodyForSchoolInDistrict('platform-admin');
      const res = await expectRoute('POST', '/v1/users').as(platformAdmin).withBody(body).toReturn(201);

      expect(res.body.data.id).toBeDefined();

      const memberships = await userRepository.getUserEntityMemberships(res.body.data.id);
      const districtMembership = memberships.find((m) => m.entityId === baseFixture.district.id);
      const schoolMembership = memberships.find((m) => m.entityId === baseFixture.schoolA.id);
      expect(districtMembership).toBeDefined();
      expect(schoolMembership).toBeDefined();
    });

    it('platform_admin can create a user at a class in their district', async () => {
      const body = validBodyForClassInSchoolInDistrict('platform-admin');
      const res = await expectRoute('POST', '/v1/users').as(platformAdmin).withBody(body).toReturn(201);

      expect(res.body.data.id).toBeDefined();

      const memberships = await userRepository.getUserEntityMemberships(res.body.data.id);
      const districtMembership = memberships.find((m) => m.entityId === baseFixture.district.id);
      const schoolMembership = memberships.find((m) => m.entityId === baseFixture.schoolA.id);
      const classMembership = memberships.find((m) => m.entityId === baseFixture.classInSchoolA.id);
      expect(districtMembership).toBeDefined();
      expect(schoolMembership).toBeDefined();
      expect(classMembership).toBeDefined();
    });

    it('platform_admin on a group can create a user in that group', async () => {
      // groupPlatformAdmin has platform_admin role directly on the group — FGA grants
      // can_create_users on that group specifically, not via district inheritance.
      // The body contains only the group membership; the service checks can_create_users
      // per membership target so adding a district would require district access too.
      const body = {
        email: makeEmail('group-platform-admin'),
        password: 'Password123!',
        name: { first: 'Test', last: 'User' },
        memberships: [{ entityType: 'group', entityId: baseFixture.group.id, role: 'student' }],
      };
      const res = await expectRoute('POST', '/v1/users').as(groupPlatformAdmin).withBody(body).toReturn(201);

      expect(res.body.data.id).toBeDefined();

      const memberships = await userRepository.getUserEntityMemberships(res.body.data.id);
      const groupMembership = memberships.find((m) => m.entityId === baseFixture.group.id);
      expect(groupMembership).toBeDefined();
    });

    it('platform_admin on group A cannot create a user in group B', async () => {
      // groupPlatformAdmin has can_create_users on baseFixture.group only —
      // group memberships have no hierarchy so there is no lateral inheritance.
      const res = await expectRoute('POST', '/v1/users')
        .as(groupPlatformAdmin)
        .withBody({
          email: makeEmail('group-platform-admin-cross-group'),
          password: 'Password123!',
          name: { first: 'Test', last: 'User' },
          memberships: [{ entityType: 'group', entityId: otherGroup.id, role: 'student' }],
        })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('super admin can create a user in a group', async () => {
      const body = validBodyForGroupInDistrict('superadmin-group');
      const res = await expectRoute('POST', '/v1/users').as(tiers.superAdmin).withBody(body).toReturn(201);

      expect(res.body.data.id).toBeDefined();

      const memberships = await userRepository.getUserEntityMemberships(res.body.data.id);
      const districtMembership = memberships.find((m) => m.entityId === baseFixture.district.id);
      const groupMembership = memberships.find((m) => m.entityId === baseFixture.group.id);
      expect(districtMembership).toBeDefined();
      expect(groupMembership).toBeDefined();
    });

    it('super admin can create a user in a family', async () => {
      const body = validBodyForFamilyInDistrict('superadmin-family');
      const res = await expectRoute('POST', '/v1/users').as(tiers.superAdmin).withBody(body).toReturn(201);

      expect(res.body.data.id).toBeDefined();

      const memberships = await userRepository.getUserEntityMemberships(res.body.data.id);
      const districtMembership = memberships.find((m) => m.entityId === baseFixture.district.id);
      const familyMembership = memberships.find((m) => m.entityId === sharedFamily.id);
      expect(districtMembership).toBeDefined();
      expect(familyMembership).toBeDefined();
    });

    it('platform_admin cannot create a user in another district', async () => {
      // platformAdmin has can_create_users on baseFixture.district, not districtB
      const body = {
        ...validBodyForDistrict('platform-admin-cross-district'),
        memberships: [{ entityType: 'district', entityId: baseFixture.districtB.id, role: 'student' }],
      };
      const res = await expectRoute('POST', '/v1/users')
        .as(platformAdmin)
        .withBody(body)
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('platform_admin cannot create a user at a school in another district', async () => {
      // platformAdmin has no can_create_users on districtB or any of its children
      const body = {
        ...validBodyForDistrict('platform-admin-cross-school'),
        memberships: [
          { entityType: 'district', entityId: baseFixture.districtB.id, role: 'student' },
          { entityType: 'school', entityId: baseFixture.schoolInDistrictB.id, role: 'student' },
        ],
      };
      const res = await expectRoute('POST', '/v1/users')
        .as(platformAdmin)
        .withBody(body)
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('platform_admin cannot create a user at a class in a school in another district', async () => {
      const body = {
        ...validBodyForDistrict('platform-admin-cross-class'),
        memberships: [
          { entityType: 'district', entityId: baseFixture.districtB.id, role: 'student' },
          { entityType: 'school', entityId: baseFixture.schoolInDistrictB.id, role: 'student' },
          { entityType: 'class', entityId: baseFixture.classInDistrictB.id, role: 'student' },
        ],
      };
      const res = await expectRoute('POST', '/v1/users')
        .as(platformAdmin)
        .withBody(body)
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('district platform_admin cannot create a user in a group without explicit group platform_admin', async () => {
      // platformAdmin has can_create_users on baseFixture.district via the org hierarchy.
      // Groups have no hierarchy — district platform_admin does NOT inherit to groups.
      // can_create_users on a group requires explicit platform_admin on that specific group.
      const res = await expectRoute('POST', '/v1/users')
        .as(platformAdmin)
        .withBody({
          email: makeEmail('district-admin-cross-group'),
          password: 'Password123!',
          name: { first: 'Test', last: 'User' },
          memberships: [{ entityType: 'group', entityId: baseFixture.group.id, role: 'student' }],
        })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('school platform_admin cannot create a user in a class in a sibling school', async () => {
      // schoolAPlatformAdmin has can_create_users on schoolA only.
      // The class→parent-school FGA check resolves classInSchoolB to schoolB —
      // schoolAPlatformAdmin has no can_create_users on schoolB.
      const res = await expectRoute('POST', '/v1/users')
        .as(schoolAPlatformAdmin)
        .withBody({
          email: makeEmail('school-admin-sibling-class'),
          password: 'Password123!',
          name: { first: 'Test', last: 'User' },
          memberships: [{ entityType: 'class', entityId: baseFixture.classInSchoolB.id, role: 'student' }],
        })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('platform_admin can create a user with both district and family memberships', async () => {
      // Family is explicitly excluded from FGA can_create_users checks — the district
      // membership passes authorization and the family membership is written without an
      // additional FGA check (known gap, tracked separately).
      const body = validBodyForFamilyInDistrict('platform-admin-family');
      const res = await expectRoute('POST', '/v1/users').as(platformAdmin).withBody(body).toReturn(201);

      expect(res.body.data.id).toBeDefined();

      const memberships = await userRepository.getUserEntityMemberships(res.body.data.id);
      expect(memberships.find((m) => m.entityId === baseFixture.district.id)).toBeDefined();
      expect(memberships.find((m) => m.entityId === sharedFamily.id)).toBeDefined();
    });

    it('admin tier (administrator role) cannot create users — no can_create_users in FGA', async () => {
      const res = await expectRoute('POST', '/v1/users')
        .as(tiers.admin)
        .withBody(validBodyForDistrict('admin-forbidden'))
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('educator tier cannot create users', async () => {
      const res = await expectRoute('POST', '/v1/users')
        .as(tiers.educator)
        .withBody(validBodyForDistrict('educator-forbidden'))
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('POST', '/v1/users')
        .unauthenticated()
        .withBody(validBodyForDistrict('unauth'))
        .toReturn(StatusCodes.UNAUTHORIZED);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });
  });

  describe('conflict detection', () => {
    it('returns 409 when email already exists in the database', async () => {
      // existsByUniqueFields catches this before Firebase is called
      const body = { ...validBodyForDistrict('db-conflict'), email: baseFixture.districtAdmin.email! };
      const res = await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody(body)
        .toReturn(StatusCodes.CONFLICT);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });

    it('returns 409 when email belongs to a rostered-out user (expired enrollment)', async () => {
      // existsByUniqueFields queries users directly — enrollment status is irrelevant.
      // A rostered-out user still owns their identifiers and must block re-registration.
      const body = {
        ...validBodyForDistrict('rostered-out-conflict'),
        email: baseFixture.expiredEnrollmentStudent.email!,
      };
      const res = await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody(body)
        .toReturn(StatusCodes.CONFLICT);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });

    it('returns 409 when identifiers.pid matches an existing user assessmentPid', async () => {
      // Caller-supplied pid takes precedence over auto-generation; existsByUniqueFields
      // checks it against the assessmentPid column and must block the create.
      const body = {
        ...validBodyForDistrict('pid-conflict'),
        identifiers: { pid: baseFixture.districtAdmin.assessmentPid! },
      };
      const res = await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody(body)
        .toReturn(StatusCodes.CONFLICT);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });

    it('returns 409 when email already exists in Firebase Auth', async () => {
      // Override: Firebase reports the email is already taken (exists in Auth but not in DB)
      mockAuth.getUserByEmail.mockResolvedValue({ uid: 'existing-firebase-uid' });

      const body = validBodyForDistrict('firebase-conflict');
      const res = await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody(body)
        .toReturn(StatusCodes.CONFLICT);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });
  });

  describe('entity validation', () => {
    it('returns 422 when super admin provides a non-existent district entityId', async () => {
      // Super admin skips FGA; entity existence is checked pre-flight via districtRepository.getById
      const body = {
        ...validBodyForDistrict('bad-district'),
        memberships: [{ entityType: 'district', entityId: '00000000-0000-0000-0000-000000000000', role: 'student' }],
      };

      const res = await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody(body)
        .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 422 when super admin provides a non-existent class entityId', async () => {
      // Super admin verifies class parent exists — non-existent class throws 422 before Firebase
      const body = {
        ...validBodyForDistrict('bad-class'),
        memberships: [{ entityType: 'class', entityId: '00000000-0000-0000-0000-000000000000', role: 'student' }],
      };

      const res = await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody(body)
        .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    describe('rostered-out entity rejection', () => {
      const rosteringEnded = new Date(Date.now() - 1000);
      let rosteringEndedDistrict: { id: string };
      let rosteringEndedSchool: { id: string };
      let rosteringEndedClass: { id: string };
      let activeClassInRosteredOutSchool: { id: string };
      let rosteringEndedGroup: { id: string };
      let rosteringEndedFamily: { id: string };

      beforeAll(async () => {
        const { GroupFactory } = await import('../test-support/factories/group.factory');
        const { FamilyFactory } = await import('../test-support/factories/family.factory');

        rosteringEndedDistrict = await OrgFactory.create({ orgType: OrgType.DISTRICT, rosteringEnded });

        rosteringEndedSchool = await OrgFactory.create({
          orgType: OrgType.SCHOOL,
          parentOrgId: baseFixture.district.id,
          rosteringEnded,
        });

        rosteringEndedClass = await ClassFactory.create({
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
          rosteringEnded,
        });

        // Active class whose parent school is rostered out
        const rosteredOutSchoolForClass = await OrgFactory.create({
          orgType: OrgType.SCHOOL,
          parentOrgId: baseFixture.district.id,
          rosteringEnded,
        });
        activeClassInRosteredOutSchool = await ClassFactory.create({
          schoolId: rosteredOutSchoolForClass.id,
          districtId: baseFixture.district.id,
        });

        rosteringEndedGroup = await GroupFactory.create({ rosteringEnded });
        rosteringEndedFamily = await FamilyFactory.create({ rosteringEnded });
      });

      it('returns 422 when district is rostered out', async () => {
        const body = {
          ...validBodyForDistrict('rostered-district'),
          memberships: [{ entityType: 'district', entityId: rosteringEndedDistrict.id, role: 'student' }],
        };
        const res = await expectRoute('POST', '/v1/users')
          .as(tiers.superAdmin)
          .withBody(body)
          .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);
        expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      });

      it('returns 422 when school is rostered out', async () => {
        const body = {
          ...validBodyForDistrict('rostered-school'),
          memberships: [{ entityType: 'school', entityId: rosteringEndedSchool.id, role: 'student' }],
        };
        const res = await expectRoute('POST', '/v1/users')
          .as(tiers.superAdmin)
          .withBody(body)
          .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);
        expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      });

      it('returns 422 when class is rostered out', async () => {
        const body = {
          ...validBodyForDistrict('rostered-class'),
          memberships: [{ entityType: 'class', entityId: rosteringEndedClass.id, role: 'student' }],
        };
        const res = await expectRoute('POST', '/v1/users')
          .as(tiers.superAdmin)
          .withBody(body)
          .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);
        expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      });

      it("returns 422 when class's parent school is rostered out", async () => {
        const body = {
          ...validBodyForDistrict('rostered-school-via-class'),
          memberships: [{ entityType: 'class', entityId: activeClassInRosteredOutSchool.id, role: 'student' }],
        };
        const res = await expectRoute('POST', '/v1/users')
          .as(tiers.superAdmin)
          .withBody(body)
          .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);
        expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      });

      it('returns 422 when group is rostered out', async () => {
        const body = {
          ...validBodyForDistrict('rostered-group'),
          memberships: [{ entityType: 'group', entityId: rosteringEndedGroup.id, role: 'student' }],
        };
        const res = await expectRoute('POST', '/v1/users')
          .as(tiers.superAdmin)
          .withBody(body)
          .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);
        expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      });

      it('returns 422 when family is rostered out', async () => {
        const body = {
          ...validBodyForDistrict('rostered-family'),
          memberships: [{ entityType: 'family', entityId: rosteringEndedFamily.id, role: 'parent' }],
        };
        const res = await expectRoute('POST', '/v1/users')
          .as(tiers.superAdmin)
          .withBody(body)
          .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);
        expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      });
    });
  });

  describe('request validation', () => {
    it('returns 400 when required fields are missing', async () => {
      await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody({ email: 'missing-fields@test.example.com' })
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('rejects request body with isSuperAdmin field', async () => {
      await expectRoute('POST', '/v1/users')
        .as(tiers.platformAdmin)
        .withBody({
          ...validBodyForDistrict,
          isSuperAdmin: true, // must not be settable via the API
        })
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when memberships array is empty', async () => {
      await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody({
          email: makeEmail('empty-memberships'),
          password: 'Password123!',
          name: { first: 'Test', last: 'User' },
          memberships: [],
        })
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when password is too short', async () => {
      await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody({ ...validBodyForDistrict('short-pass'), password: '1234567' })
        .toReturn(StatusCodes.BAD_REQUEST);
    });
  });

  // ── Roster provider ID resolution ────────────────────────────────────────

  describe('roster provider ID resolution', () => {
    // resolveRootOrgProviderFromMemberships is only observable via the partnerId
    // written to rostering_provider_ids after a successful create.
    // superAdmin is used throughout so authorization never interferes with the
    // resolver path being exercised.

    async function getPartnerId(userId: string): Promise<string | null> {
      const { rosteringProviderIds } = await import('../db/schema');
      const { eq, and } = await import('drizzle-orm');
      const { CoreDbClient } = await import('../test-support/db');
      const [record] = await CoreDbClient.select({ partnerId: rosteringProviderIds.partnerId })
        .from(rosteringProviderIds)
        .where(and(eq(rosteringProviderIds.entityId, userId)));
      return record?.partnerId ?? null;
    }

    it('district membership → partnerId is the district ID (direct, no DB lookup)', async () => {
      const res = await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody(validBodyForDistrict('resolver-district'))
        .toReturn(StatusCodes.CREATED);

      const userId: string = res.body.data.id;

      // Full record assertion — the only test in this suite that verifies every field
      // written to rostering_provider_ids, not just partnerId.
      const { rosteringProviderIds } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');
      const { CoreDbClient } = await import('../test-support/db');
      const [record] = await CoreDbClient.select()
        .from(rosteringProviderIds)
        .where(eq(rosteringProviderIds.entityId, userId));

      expect(record).toMatchObject({
        providerType: RosteringProvider.DASHBOARD,
        entityType: RosteringEntityType.USER,
        entityId: userId,
        providerId: userId, // DASHBOARD provider uses the user's own ID as the external provider ID
        partnerId: baseFixture.district.id,
      });
    });

    it('school-only membership → partnerId resolves to parent district via ltree', async () => {
      const res = await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody({
          email: makeEmail('resolver-school'),
          password: 'Password123!',
          name: { first: 'Test', last: 'User' },
          memberships: [{ entityType: 'school', entityId: baseFixture.schoolA.id, role: 'student' }],
        })
        .toReturn(StatusCodes.CREATED);

      expect(await getPartnerId(res.body.data.id)).toBe(baseFixture.district.id);
    });

    it('class-only membership → partnerId resolves to ancestor district via ltree', async () => {
      const res = await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody({
          email: makeEmail('resolver-class'),
          password: 'Password123!',
          name: { first: 'Test', last: 'User' },
          memberships: [{ entityType: 'class', entityId: baseFixture.classInSchoolA.id, role: 'student' }],
        })
        .toReturn(StatusCodes.CREATED);

      expect(await getPartnerId(res.body.data.id)).toBe(baseFixture.district.id);
    });

    it('group-only membership → partnerId is the group ID (direct fallback, no DB lookup)', async () => {
      const res = await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody({
          email: makeEmail('resolver-group'),
          password: 'Password123!',
          name: { first: 'Test', last: 'User' },
          memberships: [{ entityType: 'group', entityId: baseFixture.group.id, role: 'student' }],
        })
        .toReturn(StatusCodes.CREATED);

      expect(await getPartnerId(res.body.data.id)).toBe(baseFixture.group.id);
    });

    it('consistent district + school + class memberships → partnerId is the shared district', async () => {
      // All three org membership types point to the same district.
      // The resolver collects all evidence, confirms one unique root, and returns it.
      const res = await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody(validBodyForClassInSchoolInDistrict('resolver-consistent'))
        .toReturn(StatusCodes.CREATED);

      expect(await getPartnerId(res.body.data.id)).toBe(baseFixture.district.id);
    });

    it('explicit district_A + class in district_B → 422 (cross-district inconsistency)', async () => {
      // Previously undefined behaviour: the resolver returned district_A without
      // checking that the class belongs there. Now all sources are validated together.
      await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody({
          email: makeEmail('resolver-district-class-mismatch'),
          password: 'Password123!',
          name: { first: 'Test', last: 'User' },
          memberships: [
            { entityType: 'district', entityId: baseFixture.district.id, role: 'student' },
            { entityType: 'class', entityId: baseFixture.classInDistrictB.id, role: 'student' },
          ],
        })
        .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);
    });

    it('class memberships spanning two districts → 422 (cross-district ambiguity)', async () => {
      // classInSchoolA is under district; classInDistrictB is under districtB.
      // resolveRootOrgProviderFromMemberships finds two distinct root IDs and throws
      // UNPROCESSABLE_ENTITY. The catch block should delete the DB row and the
      // Firebase account before re-throwing.
      await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody({
          email: makeEmail('resolver-cross-district'),
          password: 'Password123!',
          name: { first: 'Test', last: 'User' },
          memberships: [
            { entityType: 'class', entityId: baseFixture.classInSchoolA.id, role: 'student' },
            { entityType: 'class', entityId: baseFixture.classInDistrictB.id, role: 'student' },
          ],
        })
        .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);
    });

    it('family-only membership → partnerId is the family ID (direct fallback)', async () => {
      // Family memberships fall through all org/class/school/group branches and resolve
      // to the family ID directly. sharedFamily is set up in the POST /v1/users beforeAll.
      const res = await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody({
          email: makeEmail('resolver-family'),
          password: 'Password123!',
          name: { first: 'Test', last: 'User' },
          memberships: [{ entityType: 'family', entityId: sharedFamily.id, role: 'parent' }],
        })
        .toReturn(StatusCodes.CREATED);

      expect(await getPartnerId(res.body.data.id)).toBe(sharedFamily.id);
    });

    it('school memberships spanning two districts → 422 (cross-district ambiguity)', async () => {
      // schoolA is under district; schoolInDistrictB is under districtB.
      // Symmetric to the class cross-district case — the same multi-root guard fires.
      await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody({
          email: makeEmail('resolver-school-cross-district'),
          password: 'Password123!',
          name: { first: 'Test', last: 'User' },
          memberships: [
            { entityType: 'school', entityId: baseFixture.schoolA.id, role: 'student' },
            { entityType: 'school', entityId: baseFixture.schoolInDistrictB.id, role: 'student' },
          ],
        })
        .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/users/:userId/administrations/:administrationId
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/users/:userId/administrations/:administrationId', () => {
  describe('authorization', () => {
    it('super admin can get any administration for any user', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations/${baseFixture.administrationAssignedToSchoolA.id}`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data.id).toBe(baseFixture.administrationAssignedToSchoolA.id);
      expect(res.body.data).toHaveProperty('name');
      expect(res.body.data).toHaveProperty('publicName');
      expect(res.body.data).toHaveProperty('dates');
    });

    it('user can get their own administration (self-access)', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${tiers.student.id}/administrations/${baseFixture.administrationAssignedToDistrict.id}`,
      )
        .as(tiers.student)
        .toReturn(StatusCodes.OK);

      expect(res.body.data.id).toBe(baseFixture.administrationAssignedToDistrict.id);
    });

    it('admin can get administration for users in their district', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations/${baseFixture.administrationAssignedToSchoolA.id}`,
      )
        .as(tiers.admin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data.id).toBe(baseFixture.administrationAssignedToSchoolA.id);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations/${baseFixture.administrationAssignedToSchoolA.id}`,
      )
        .unauthenticated()
        .toReturn(StatusCodes.UNAUTHORIZED);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 403 when target user does not have access to administration', async () => {
      // Create a user with no access to any administrations
      const userWithNoAccess = await UserFactory.create();
      await UserOrgFactory.create({
        userId: userWithNoAccess.id,
        orgId: baseFixture.district.id,
        role: UserRole.STUDENT,
      });

      const res = await expectRoute(
        'GET',
        `/v1/users/${userWithNoAccess.id}/administrations/${baseFixture.administrationAssignedToSchoolA.id}`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 403 when requester lacks access to administration (even if target user has access)', async () => {
      // districtBStudent has access to administrations in district B
      // tiers.admin only has access to district A
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.districtBStudent.id}/administrations/${baseFixture.administrationAssignedToDistrictB.id}`,
      )
        .as(tiers.admin)
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('response structure', () => {
    it('returns administration with all required fields', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations/${baseFixture.administrationAssignedToSchoolA.id}`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        dates: {
          start: expect.any(String),
          end: expect.any(String),
          created: expect.any(String),
        },
        isOrdered: expect.any(Boolean),
      });
    });

    it('transforms Date fields to ISO datetime strings', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations/${baseFixture.administrationAssignedToSchoolA.id}`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      const { dates } = res.body.data;
      expect(dates.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(dates.end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(dates.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('includes publicName field (may be null)', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations/${baseFixture.administrationAssignedToSchoolA.id}`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data).toHaveProperty('publicName');
    });
  });

  describe('validation', () => {
    it('returns 404 when target user does not exist', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/00000000-0000-0000-0000-000000000000/administrations/${baseFixture.administrationAssignedToSchoolA.id}`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.NOT_FOUND);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 404 when target user is rostering-ended (#1742)', async () => {
      const endedUser = await UserFactory.create({
        nameLast: 'EndedSingleAdmin1742',
        rosteringEnded: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const res = await expectRoute(
        'GET',
        `/v1/users/${endedUser.id}/administrations/${baseFixture.administrationAssignedToSchoolA.id}`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.NOT_FOUND);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 404 when administration does not exist', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations/00000000-0000-0000-0000-000000000000`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.NOT_FOUND);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 400 for invalid UUID in userId parameter', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/not-a-valid-uuid/administrations/${baseFixture.administrationAssignedToSchoolA.id}`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.BAD_REQUEST);

      const messages = res.body.issues.map((issue: { message: string }) => issue.message);
      expect(messages).toContain('Invalid uuid');
    });

    it('returns 400 for invalid UUID in administrationId parameter', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations/not-a-valid-uuid`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.BAD_REQUEST);

      const messages = res.body.issues.map((issue: { message: string }) => issue.message);
      expect(messages).toContain('Invalid uuid');
    });
  });

  describe('self-access scenarios', () => {
    it('allows user to access their own administration without additional permission checks', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${tiers.student.id}/administrations/${baseFixture.administrationAssignedToDistrict.id}`,
      )
        .as(tiers.student)
        .toReturn(StatusCodes.OK);

      expect(res.body.data.id).toBe(baseFixture.administrationAssignedToDistrict.id);
    });

    it('returns 404 when user requests their own administration that does not exist', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${tiers.student.id}/administrations/00000000-0000-0000-0000-000000000000`,
      )
        .as(tiers.student)
        .toReturn(StatusCodes.NOT_FOUND);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });
  });

  describe('cross-user access scenarios', () => {
    it('super admin can access administration for any user regardless of target user access', async () => {
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations/${baseFixture.administrationAssignedToSchoolA.id}`,
      )
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data.id).toBe(baseFixture.administrationAssignedToSchoolA.id);
    });

    it('non-super-admin can access administration if both target user and requester have access', async () => {
      // Both tiers.admin and baseFixture.schoolAStudent have access to administrationAssignedToSchoolA
      const res = await expectRoute(
        'GET',
        `/v1/users/${baseFixture.schoolAStudent.id}/administrations/${baseFixture.administrationAssignedToSchoolA.id}`,
      )
        .as(tiers.admin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data.id).toBe(baseFixture.administrationAssignedToSchoolA.id);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/users/:userId/administrations/:administrationId/agreements
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/users/:userId/administrations/:administrationId/agreements', () => {
  // A fresh district-assigned administration requiring a TOS, a consent, and an
  // assent agreement. The endpoint filters the returned agreements to the ones
  // the TARGET user is age-appropriately required to sign (assent → minors,
  // consent → adults, TOS → never), so we seed both a minor and an adult target
  // enrolled at the district, each signing the agreement type they actually see.
  let administrationId: string;
  let tosAgreementId: string;
  let consentAgreementId: string;
  let assentAgreementId: string;
  // Explicitly-aged targets enrolled at the district (so they can read the admin).
  let minorTarget: { id: string; authId: string };
  let adultTarget: { id: string; authId: string };

  beforeAll(async () => {
    const administration = await AdministrationFactory.create({
      name: `User Agreements Admin ${faker.string.uuid()}`,
      createdBy: baseFixture.districtAdmin.id,
    });
    administrationId = administration.id;

    await AdministrationOrgFactory.create({ administrationId, orgId: baseFixture.district.id });
    await writeFgaAdministrationAssignment(administrationId, baseFixture.district.id, FgaType.DISTRICT);

    // Required agreements: TOS, consent, and assent, each with a current en-US version.
    const tos = await AgreementFactory.create({ agreementType: AgreementType.TOS });
    const consent = await AgreementFactory.create({ agreementType: AgreementType.CONSENT });
    const assent = await AgreementFactory.create({ agreementType: AgreementType.ASSENT });
    tosAgreementId = tos.id;
    consentAgreementId = consent.id;
    assentAgreementId = assent.id;

    await AgreementVersionFactory.create({ isCurrent: true, locale: 'en-US' }, { transient: { agreementId: tos.id } });
    const consentVersion = await AgreementVersionFactory.create(
      { isCurrent: true, locale: 'en-US' },
      { transient: { agreementId: consent.id } },
    );
    const assentVersion = await AgreementVersionFactory.create(
      { isCurrent: true, locale: 'en-US' },
      { transient: { agreementId: assent.id } },
    );

    await AdministrationAgreementFactory.create({}, { transient: { administrationId, agreementId: tos.id } });
    await AdministrationAgreementFactory.create({}, { transient: { administrationId, agreementId: consent.id } });
    await AdministrationAgreementFactory.create({}, { transient: { administrationId, agreementId: assent.id } });

    // Seed two explicitly-aged students enrolled at the district. The minor (dob
    // 10 years ago) is required to sign the assent; the adult (dob 20 years ago)
    // the consent. Each signs the current version of the agreement they see.
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    const twentyYearsAgo = new Date();
    twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);

    const [minorUser, adultUser] = await Promise.all([
      UserFactory.create({
        userType: 'student',
        dob: tenYearsAgo.toISOString().split('T')[0]!,
        grade: null,
      }),
      UserFactory.create({
        userType: 'student',
        dob: twentyYearsAgo.toISOString().split('T')[0]!,
        grade: null,
      }),
    ]);
    minorTarget = { id: minorUser.id, authId: minorUser.authId! };
    adultTarget = { id: adultUser.id, authId: adultUser.authId! };

    await Promise.all([
      UserOrgFactory.create({ userId: minorUser.id, orgId: baseFixture.district.id, role: UserRole.STUDENT }),
      UserOrgFactory.create({ userId: adultUser.id, orgId: baseFixture.district.id, role: UserRole.STUDENT }),
    ]);

    // The minor signs the assent; the adult signs the consent.
    await UserAgreementFactory.create({ userId: minorUser.id, agreementVersionId: assentVersion.id });
    await UserAgreementFactory.create({ userId: adultUser.id, agreementVersionId: consentVersion.id });

    // Re-sync FGA so the two new student memberships grant can_read on the admin.
    const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');
    await syncFgaTuplesFromPostgres();
  });

  function path(userId: string, adminId: string) {
    return `/v1/users/${userId}/administrations/${adminId}/agreements`;
  }

  describe('authorization', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', path(minorTarget.id, administrationId))
        .unauthenticated()
        .toReturn(StatusCodes.UNAUTHORIZED);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('super admin can list agreements for any user', async () => {
      const res = await expectRoute('GET', path(minorTarget.id, administrationId))
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('returns 404 when the target user does not exist', async () => {
      const res = await expectRoute('GET', path('00000000-0000-0000-0000-000000000000', administrationId))
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.NOT_FOUND);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 404 when the administration does not exist', async () => {
      const res = await expectRoute('GET', path(minorTarget.id, '00000000-0000-0000-0000-000000000000'))
        .as(minorTarget)
        .toReturn(StatusCodes.NOT_FOUND);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 403 when a non-super-admin requester lacks access to the administration', async () => {
      // districtBAdmin is an administrator in a fully disjoint district branch:
      // no ltree ancestry or membership overlap with the district-A admin. The
      // minor target HAS access (so existence/target checks pass), but the
      // requester's own can_read check fails → 403. This exercises the full
      // middleware/FGA stack for the cross-user access path.
      const res = await expectRoute('GET', path(minorTarget.id, administrationId))
        .as({ id: baseFixture.districtBAdmin.id, authId: baseFixture.districtBAdmin.authId! })
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('agreement type filtering by target user age', () => {
    it('shows only the assent (excludes consent and TOS) for a minor target', async () => {
      const res = await expectRoute('GET', path(minorTarget.id, administrationId))
        .as(minorTarget)
        .toReturn(StatusCodes.OK);

      const items: Array<{ id: string; agreementType: string; signed: boolean }> = res.body.data.items;
      const ids = items.map((i) => i.id);

      expect(ids).toContain(assentAgreementId);
      expect(ids).not.toContain(consentAgreementId);
      expect(ids).not.toContain(tosAgreementId);
      // Every returned agreement is an assent.
      expect(items.every((i) => i.agreementType === AgreementType.ASSENT)).toBe(true);
    });

    it('shows only the consent (excludes assent and TOS) for an adult target', async () => {
      const res = await expectRoute('GET', path(adultTarget.id, administrationId))
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      const items: Array<{ id: string; agreementType: string; signed: boolean }> = res.body.data.items;
      const ids = items.map((i) => i.id);

      expect(ids).toContain(consentAgreementId);
      expect(ids).not.toContain(assentAgreementId);
      expect(ids).not.toContain(tosAgreementId);
      expect(items.every((i) => i.agreementType === AgreementType.CONSENT)).toBe(true);
    });
  });

  describe('signed status', () => {
    it('annotates the assent with signed status for a minor self-read', async () => {
      const res = await expectRoute('GET', path(minorTarget.id, administrationId))
        .as(minorTarget)
        .toReturn(StatusCodes.OK);

      const items: Array<{ id: string; signed: boolean }> = res.body.data.items;
      const assentItem = items.find((i) => i.id === assentAgreementId);

      expect(assentItem).toBeDefined();
      // The minor signed the assent's current version.
      expect(assentItem!.signed).toBe(true);
    });

    it('reports the adult consent as signed and excludes everything else', async () => {
      // Super admin reads on behalf of the adult target, who signed the consent.
      const res = await expectRoute('GET', path(adultTarget.id, administrationId))
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      const items: Array<{ id: string; signed: boolean }> = res.body.data.items;
      const consentItem = items.find((i) => i.id === consentAgreementId);

      expect(consentItem).toBeDefined();
      expect(consentItem!.signed).toBe(true);
    });

    it('reports the relevant agreement as unsigned for a user who signed nothing', async () => {
      // baseFixture.districtAdmin (no dob/grade → minor) signed neither agreement,
      // so the assent they are shown comes back unsigned.
      const res = await expectRoute('GET', path(baseFixture.districtAdmin.id, administrationId))
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      const items: Array<{ id: string; signed: boolean }> = res.body.data.items;
      const assentItem = items.find((i) => i.id === assentAgreementId);

      expect(assentItem).toBeDefined();
      expect(assentItem!.signed).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/users/:userId/reports/scores  (#1687 Guardian Student Report)
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/users/:userId/reports/scores', () => {
  function reportPath(userId: string) {
    return `/v1/users/${userId}/reports/scores`;
  }

  describe('authorization', () => {
    it('returns 401 without auth', async () => {
      const res = await expectRoute('GET', reportPath(baseFixture.classAStudent.id)).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('super admin can access any student', async () => {
      const res = await expectRoute('GET', reportPath(baseFixture.classAStudent.id)).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.student.userId).toBe(baseFixture.classAStudent.id);
    });

    it('admin tier (administrator at district) can access an in-scope student', async () => {
      const res = await expectRoute('GET', reportPath(baseFixture.classAStudent.id)).as(tiers.admin).toReturn(200);

      expect(res.body.data.student.userId).toBe(baseFixture.classAStudent.id);
    });

    it('educator tier with class overlap can access a student in their class', async () => {
      // tiers.educator is assigned to classInSchoolA at class level
      // in the file's beforeAll. District and school-level educators can only
      // access students in classes they are explicitly assigned to.
      const res = await expectRoute('GET', reportPath(baseFixture.classAStudent.id)).as(tiers.educator).toReturn(200);

      expect(res.body.data.student.userId).toBe(baseFixture.classAStudent.id);
    });

    it('educator without overlap is forbidden', async () => {
      // tiers.educator is a TEACHER at the main district (created by createTierUsers
      // with `district.id`). districtBStudent lives under districtB — a fully
      // disjoint district hierarchy — so no ltree ancestry, class, or group
      // overlap exists between them.
      const res = await expectRoute('GET', reportPath(baseFixture.districtBStudent.id))
        .as(tiers.educator)
        .toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('linked caregiver (parent) can access their child', async () => {
      const { UserFamilyFactory } = await import('../test-support/factories/user-family.factory');
      const { FamilyFactory } = await import('../test-support/factories/family.factory');

      const child = await UserFactory.create({ dob: '2015-01-01', grade: '3' });
      const family = await FamilyFactory.create();
      await UserFamilyFactory.create({ userId: tiers.caregiver.id, familyId: family.id, role: 'parent' });
      await UserFamilyFactory.create({ userId: child.id, familyId: family.id, role: 'child' });

      const res = await expectRoute('GET', reportPath(child.id)).as(tiers.caregiver).toReturn(200);

      expect(res.body.data.student.userId).toBe(child.id);
    });

    it('caregiver who is not linked to the student is forbidden', async () => {
      // tiers.caregiver has no user_families link to schoolAStudent.
      const res = await expectRoute('GET', reportPath(baseFixture.schoolAStudent.id)).as(tiers.caregiver).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('student attempting to view their own report is forbidden', async () => {
      // schoolAStudent is a student tier user — calling for themselves should be denied.
      const studentAsTier = {
        id: baseFixture.schoolAStudent.id,
        authId: baseFixture.schoolAStudent.authId!,
      };
      const res = await expectRoute('GET', reportPath(baseFixture.schoolAStudent.id)).as(studentAsTier).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 404 for an unknown user ID', async () => {
      const res = await expectRoute('GET', reportPath('00000000-0000-0000-0000-000000000000'))
        .as(tiers.superAdmin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 404 for a student with rosteringEnded set', async () => {
      const endedStudent = await UserFactory.create({
        userType: 'student',
        rosteringEnded: new Date('2025-01-01'),
      });

      const res = await expectRoute('GET', reportPath(endedStudent.id)).as(tiers.superAdmin).toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 400 for a malformed userId path parameter', async () => {
      // ts-rest validates path params before the request reaches the global
      // error handler, so the response body shape is the validator's native
      // shape (not our `{ error: { ... } }` envelope). Asserting the 400
      // status is sufficient — the body shape is owned by ts-rest.
      await expectRoute('GET', reportPath('not-a-uuid')).as(tiers.superAdmin).toReturn(400);
    });
  });

  describe('response shape', () => {
    it('returns 200 with student, administrations, and longitudinalScores', async () => {
      const res = await expectRoute('GET', reportPath(baseFixture.grade5Student.id)).as(tiers.superAdmin).toReturn(200);

      const { data } = res.body;
      expect(data).toHaveProperty('student');
      expect(data).toHaveProperty('administrations');
      expect(data).toHaveProperty('longitudinalScores');

      // Header
      expect(data.student.userId).toBe(baseFixture.grade5Student.id);
      expect(data.student).toHaveProperty('firstName');
      expect(data.student).toHaveProperty('lastName');
      expect(data.student).toHaveProperty('grade');
      expect(data.student).toHaveProperty('schoolName');

      // Per-admin entries: array, each with required fields
      expect(Array.isArray(data.administrations)).toBe(true);
      for (const admin of data.administrations) {
        expect(admin).toHaveProperty('administrationId');
        expect(admin).toHaveProperty('name');
        expect(admin).toHaveProperty('dateStart');
        expect(admin).toHaveProperty('dateEnd');
        expect(typeof admin.dateStart).toBe('string');
        expect(Array.isArray(admin.tasks)).toBe(true);

        // Per-task entries omit historicalScores (longitudinal data is at the response root)
        for (const task of admin.tasks) {
          expect(task).not.toHaveProperty('historicalScores');
          expect(task).toHaveProperty('tags');
          // Type tag is always present
          expect(task.tags.some((t: { label: string }) => t.label === 'Type')).toBe(true);
        }
      }

      // Longitudinal map
      expect(typeof data.longitudinalScores).toBe('object');
    });

    it('administrations are sorted ascending by dateStart', async () => {
      const res = await expectRoute('GET', reportPath(baseFixture.grade5Student.id)).as(tiers.superAdmin).toReturn(200);

      const dates = (res.body.data.administrations as Array<{ dateStart: string }>).map((a) =>
        new Date(a.dateStart).getTime(),
      );
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]!);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /v1/users/anonymous
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /v1/users/anonymous', () => {
  // AnonTokenMiddleware checks claims.firebase.sign_in_provider — the shared
  // authenticateAs() helper sets claims: {} which would fail that check.
  // expectRoute().asAnonymous(uid) sets the full anonymous claims instead.

  it('returns 401 when Authorization header is absent', async () => {
    const res = await expectRoute('POST', '/v1/users/anonymous').unauthenticated().toReturn(401);

    expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
  });

  it('returns 401 when the token is from a non-anonymous provider', async () => {
    // authenticateAs sets claims: {} (no firebase key), so isAnonymousToken returns
    // false and AnonTokenMiddleware rejects the request as non-anonymous.
    const res = await expectRoute('POST', '/v1/users/anonymous').as(tiers.student).toReturn(401);

    expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
  });

  it('returns 200 with { data: { id: <uuid> } } on first call for a new anonymous user', async () => {
    const uid = `anon-uid-${Date.now()}`;

    const res = await expectRoute('POST', '/v1/users/anonymous').asAnonymous(uid).toReturn(200);

    expect(res.body.data).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it('returns 200 with the same UUID on a second call for the same Firebase UID (idempotency)', async () => {
    const uid = `anon-uid-idempotent-${Date.now()}`;

    const first = await expectRoute('POST', '/v1/users/anonymous').asAnonymous(uid).toReturn(200);
    const second = await expectRoute('POST', '/v1/users/anonymous').asAnonymous(uid).toReturn(200);

    expect(second.body.data.id).toBe(first.body.data.id);
  });

  it('returns 200 with no request body (the contract declares no body)', async () => {
    const uid = `anon-uid-nobody-${Date.now()}`;

    const res = await expectRoute('POST', '/v1/users/anonymous').asAnonymous(uid).toReturn(200);

    expect(res.body.data).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it('writes no FGA tuples for the new anonymous user (anonymous users have no org memberships)', async () => {
    const uid = `anon-uid-fga-${Date.now()}`;
    const res = await expectRoute('POST', '/v1/users/anonymous').asAnonymous(uid).toReturn(200);
    const roarUserId: string = res.body.data.id;

    // OpenFGA read requires an object type when filtering by user, so scan each
    // membership-bearing type separately (empty id = all objects of that type).
    const fga = FgaClient.getClient();
    const membershipTypes = [
      FgaType.DISTRICT,
      FgaType.SCHOOL,
      FgaType.CLASS,
      FgaType.GROUP,
      FgaType.FAMILY,
      FgaType.ADMINISTRATION,
    ] as const;

    const reads = await Promise.all(
      membershipTypes.map((type) => fga.read({ user: `${FgaType.USER}:${roarUserId}`, object: `${type}:` })),
    );

    const allTuples = reads.flatMap((r) => r.tuples ?? []);
    expect(allTuples).toHaveLength(0);
  });
});
