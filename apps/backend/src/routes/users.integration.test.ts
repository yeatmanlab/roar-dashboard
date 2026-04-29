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
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type express from 'express';
import { StatusCodes } from 'http-status-codes';
import type { Administration } from '@roar-dashboard/api-contract';
import { createTestApp, createRouteHelper, createTierUsers } from '../test-support/route-test.helper';
import type { TierUsers } from '../test-support/route-test.helper';
import { baseFixture } from '../test-support/fixtures';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { UserFactory } from '../test-support/factories/user.factory';
import { UserOrgFactory } from '../test-support/factories/user-org.factory';
import { UserClassFactory } from '../test-support/factories/user-class.factory';
import { AgreementVersionFactory } from '../test-support/factories/agreement-version.factory';
import { UserRole } from '../enums/user-role.enum';
import { UserRepository } from '../repositories/user.repository';
import { FirebaseAuthClient } from '../clients/firebase-auth.clients';

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
      // Teacher role does NOT inherit via parent_org — a district-level teacher
      // has no teacher role on child schools or classes. This prevents accidental
      // privilege escalation from mis-rostering a teacher at the district level.
      const resSchoolA = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as(tiers.educator)
        .toReturn(403);

      expect(resSchoolA.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);

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
      if (res.body.data.updatedAt) {
        expect(res.body.data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
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

      if (res.body.data.items.length > 0) {
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
      }
    });

    it('does not include stats or tasks by default', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}/administrations`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      if (res.body.data.items.length > 0) {
        const admin = res.body.data.items[0];
        expect(admin).not.toHaveProperty('stats');
        expect(admin).not.toHaveProperty('tasks');
      }
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

      if (res.body.data.items.length > 0) {
        const adminWithStats = res.body.data.items.find((item: Administration) => item.stats);
        if (adminWithStats) {
          expect(adminWithStats.stats).toMatchObject({
            assigned: expect.any(Number),
            started: expect.any(Number),
            completed: expect.any(Number),
          });
        }
      }
    });

    it('includes tasks when embed=tasks', async () => {
      const res = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}/administrations?embed=tasks`)
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.OK);

      if (res.body.data.items.length > 0) {
        const adminWithTasks = res.body.data.items.find((item: Administration) => item.tasks);
        if (adminWithTasks) {
          expect(Array.isArray(adminWithTasks.tasks)).toBe(true);
        }
      }
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
    memberships: [{ entityType: 'district', entityId: baseFixture.district.id, role: 'student' }],
  });

  const validBodyForSchoolInDistrict = (suffix: string) => ({
    email: makeEmail(suffix),
    password: 'Password123!',
    name: { first: 'Test', last: 'User' },
    memberships: [
      { entityType: 'district', entityId: baseFixture.district.id, role: 'student' },
      { entityType: 'school', entityId: baseFixture.schoolA.id, role: 'student' },
    ],
  });

  const validBodyForClassInSchoolInDistrict = (suffix: string) => ({
    email: makeEmail(suffix),
    password: 'Password123!',
    name: { first: 'Test', last: 'User' },
    memberships: [
      { entityType: 'district', entityId: baseFixture.district.id, role: 'student' },
      { entityType: 'school', entityId: baseFixture.schoolA.id, role: 'student' },
      { entityType: 'class', entityId: baseFixture.classInSchoolA.id, role: 'student' },
    ],
  });

  const validBodyForGroupInDistrict = (suffix: string) => ({
    email: makeEmail(suffix),
    password: 'Password123!',
    name: { first: 'Test', last: 'User' },
    memberships: [
      { entityType: 'district', entityId: baseFixture.district.id, role: 'student' },
      { entityType: 'group', entityId: baseFixture.group.id, role: 'student' },
    ],
  });

  let sharedFamily: { id: string };

  const validBodyForFamilyInDistrict = (suffix: string) => ({
    email: makeEmail(suffix),
    password: 'Password123!',
    name: { first: 'Test', last: 'User' },
    memberships: [
      { entityType: 'district', entityId: baseFixture.district.id, role: 'student' },
      { entityType: 'family', entityId: sharedFamily.id, role: 'parent' },
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
      // Super admin skips FGA; Firebase createUser runs, then DB FK violation fires → 422
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
  });

  describe('request validation', () => {
    it('returns 400 when required fields are missing', async () => {
      await expectRoute('POST', '/v1/users')
        .as(tiers.superAdmin)
        .withBody({ email: 'missing-fields@test.example.com' })
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
});
