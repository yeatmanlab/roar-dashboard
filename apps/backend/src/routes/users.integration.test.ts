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
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type express from 'express';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import { createTestApp, createRouteHelper, createTierUsers, authenticateAs } from '../test-support/route-test.helper';
import type { TierUsers } from '../test-support/route-test.helper';
import { baseFixture } from '../test-support/fixtures';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { UserFactory } from '../test-support/factories/user.factory';
import { UserOrgFactory } from '../test-support/factories/user-org.factory';
import { UserClassFactory } from '../test-support/factories/user-class.factory';
import { UserRole } from '../enums/user-role.enum';
import { UserRepository } from '../repositories/user.repository';

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

  // Assign tier educator to a class so they can access students via direct class membership (PATH 3)
  await UserClassFactory.create({
    userId: tiers.educator.id,
    classId: baseFixture.classInSchoolA.id,
    role: UserRole.TEACHER,
  });
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

    // TODO: Add family-based access test once family fixtures are available
    // ISSUE: https://github.com/yeatmanlab/roar-project-management/issues/1707
    it.skip('caregiver tier can access users in their family', async () => {
      // Would require family fixtures linking caregiver to target user
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

    it('educator cannot access students via org membership alone', async () => {
      // Educator with district-level membership cannot see org-level students
      // Teachers only see students in classes they directly teach (PATH 3)
      const resSchoolA = await expectRoute('GET', `/v1/users/${baseFixture.schoolAStudent.id}`)
        .as(tiers.educator)
        .toReturn(403);

      expect(resSchoolA.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);

      // Also cannot see students in other schools
      const resSchoolB = await expectRoute('GET', `/v1/users/${baseFixture.schoolBStudent.id}`)
        .as(tiers.educator)
        .toReturn(403);

      expect(resSchoolB.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
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
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .patch(`/v1/users/${targetUser.id}`)
        .set('Authorization', 'Bearer token')
        .send({ nameFirst: 'Updated by superAdmin' });

      expect(res.status).toBe(StatusCodes.NO_CONTENT);
    });

    it('siteAdmin tier cannot update users', async () => {
      authenticateAs(tiers.siteAdmin);
      const res = await request(app)
        .patch(`/v1/users/${targetUser.id}`)
        .set('Authorization', 'Bearer token')
        .send({ nameFirst: 'Should Fail' });

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('admin tier cannot update users', async () => {
      authenticateAs(tiers.admin);
      const res = await request(app)
        .patch(`/v1/users/${targetUser.id}`)
        .set('Authorization', 'Bearer token')
        .send({ nameFirst: 'Should Fail' });

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('educator tier cannot update users', async () => {
      authenticateAs(tiers.educator);
      const res = await request(app)
        .patch(`/v1/users/${targetUser.id}`)
        .set('Authorization', 'Bearer token')
        .send({ nameFirst: 'Should Fail' });

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('student tier cannot update users', async () => {
      authenticateAs(tiers.student);
      const res = await request(app)
        .patch(`/v1/users/${targetUser.id}`)
        .set('Authorization', 'Bearer token')
        .send({ nameFirst: 'Should Fail' });

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier cannot update users', async () => {
      authenticateAs(tiers.caregiver);
      const res = await request(app)
        .patch(`/v1/users/${targetUser.id}`)
        .set('Authorization', 'Bearer token')
        .send({ nameFirst: 'Should Fail' });

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    // Self-update is not yet permitted for non-super-admin users.
    // To enable: assign Permissions.Users.UPDATE to roles in role-permissions.ts,
    // then the service's update() will delegate to verifySupervisoryAccess which
    // allows self-access. Un-skip and adjust the expected status at that point.
    it.skip('non-super admin users cannot update their own profile yet', async () => {
      authenticateAs(tiers.student);
      const res = await request(app)
        .patch(`/v1/users/${tiers.student.id}`)
        .set('Authorization', 'Bearer token')
        .send({ nameFirst: 'Self Update' });

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
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

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .patch(`/v1/users/${targetUser.id}`)
        .set('Authorization', 'Bearer token')
        .send({ nameFirst: 'Updated' });

      expect(res.status).toBe(StatusCodes.NO_CONTENT);

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

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .patch(`/v1/users/${targetUser.id}`)
        .set('Authorization', 'Bearer token')
        .send({ nameFirst: 'After', nameLast: 'After', grade: '5' });

      expect(res.status).toBe(StatusCodes.NO_CONTENT);

      // Verify database state using repository
      const updated = await userRepository.getById({ id: targetUser.id });
      expect(updated).not.toBeNull();
      expect(updated!.nameFirst).toBe('After');
      expect(updated!.nameLast).toBe('After');
      expect(updated!.grade).toBe('5');
    });

    it('sets a nullable field to null to clear it', async () => {
      const targetUser = await UserFactory.create({ nameFirst: 'HasAName', grade: '6' });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .patch(`/v1/users/${targetUser.id}`)
        .set('Authorization', 'Bearer token')
        .send({ nameFirst: null });

      expect(res.status).toBe(StatusCodes.NO_CONTENT);

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
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .patch(`/v1/users/${baseFixture.schoolAStudent.id}`)
        .set('Authorization', 'Bearer token')
        .send({});

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 for an invalid UUID in the path', async () => {
      const res = await expectRoute('PATCH', '/v1/users/not-a-valid-uuid')
        .as(tiers.superAdmin)
        .toReturn(StatusCodes.BAD_REQUEST);

      const messages = res.body.issues.map((issue: { message: string }) => issue.message);
      expect(messages).toContain('Invalid uuid');
    });

    it('returns 400 for an invalid enum value', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .patch(`/v1/users/${baseFixture.schoolAStudent.id}`)
        .set('Authorization', 'Bearer token')
        .send({ grade: 'not-a-real-grade' });

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Unique constraint violations
  // ─────────────────────────────────────────────────────────────────────────

  describe('unique constraint violations', () => {
    it('returns 409 when the email conflicts with an existing user', async () => {
      const existingUser = await UserFactory.create({ email: 'taken-email@example.com' });
      const targetUser = await UserFactory.create({ email: 'other-email@example.com' });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .patch(`/v1/users/${targetUser.id}`)
        .set('Authorization', 'Bearer token')
        .send({ email: existingUser.email });

      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });

    it('returns 409 when the username conflicts with an existing user', async () => {
      const existingUser = await UserFactory.create({ username: 'taken-username' });
      const targetUser = await UserFactory.create({ username: 'other-username' });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .patch(`/v1/users/${targetUser.id}`)
        .set('Authorization', 'Bearer token')
        .send({ username: existingUser.username });

      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Schema strictness
  // ─────────────────────────────────────────────────────────────────────────

  describe('schema strictness', () => {
    it('rejects unknown fields like isSuperAdmin', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .patch(`/v1/users/${tiers.superAdmin.id}`)
        .set('Authorization', 'Bearer token')
        .send({ nameFirst: 'Valid', isSuperAdmin: true });

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(res.body.error.message).toContain('isSuperAdmin');
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
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .patch('/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', 'Bearer token')
        .send({ nameFirst: 'Ghost' });

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });
  });
});
