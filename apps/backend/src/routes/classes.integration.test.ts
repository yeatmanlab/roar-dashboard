/**
 * Route integration tests for /v1/classes endpoints.
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
import { ClassFactory } from '../test-support/factories/class.factory';
import type { EnrolledUserEntity } from '../types/user';
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
  const { registerClassesRoutes } = await import('./classes');

  app = createTestApp(registerClassesRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/classes/:classId/users
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/classes/:classId/users', () => {
  const classId = () => baseFixture.classInSchoolA.id;
  const path = () => `/v1/classes/${classId()}/users`;

  describe('authorization', () => {
    it('superAdmin tier can list all users in a class', async () => {
      const res = await expectRoute('GET', path()).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toBeDefined();

      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      // Super admin sees all active users in the class
      expect(userIds).toContain(baseFixture.classAStudent.id);
      expect(userIds).toContain(baseFixture.classATeacher.id);
      // Expired enrollment should not be included
      expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
    });

    it('siteAdmin tier can list users in a class within their district', async () => {
      const res = await expectRoute('GET', path()).as(tiers.siteAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      expect(userIds).toContain(baseFixture.classAStudent.id);
      expect(userIds).toContain(baseFixture.classATeacher.id);
      expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
    });

    it('admin tier can list users in a class within their district', async () => {
      const res = await expectRoute('GET', path()).as(tiers.admin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      expect(userIds).toContain(baseFixture.classAStudent.id);
      expect(userIds).toContain(baseFixture.classATeacher.id);
      expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
    });

    it('educator tier can list users in a class within their district', async () => {
      const res = await expectRoute('GET', path()).as(tiers.educator).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      expect(userIds).toContain(baseFixture.classAStudent.id);
      expect(userIds).toContain(baseFixture.classATeacher.id);
      expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
    });

    it('student tier is forbidden from listing users in classes', async () => {
      const res = await expectRoute('GET', path()).as(tiers.student).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier is forbidden from listing users in classes', async () => {
      const res = await expectRoute('GET', path()).as(tiers.caregiver).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('access filtering', () => {
    it('filters out users with expired enrollments', async () => {
      const res = await expectRoute('GET', path()).as(tiers.admin).toReturn(200);

      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      // expiredClassStudent has an expired enrollment and should not appear
      expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
    });

    it('returns 403 for user without access to class in different district', async () => {
      authenticateAs(baseFixture.districtAdmin);
      const res = await request(app)
        .get(`/v1/classes/${baseFixture.classInDistrictB.id}/users`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('teacher can list users in their assigned class', async () => {
      authenticateAs(baseFixture.classATeacher);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items).toBeInstanceOf(Array);
      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      expect(userIds).toContain(baseFixture.classAStudent.id);
      expect(userIds).toContain(baseFixture.classATeacher.id);
    });

    it('teacher cannot list users in unassigned class in same school', async () => {
      // Create a new class in district A that the teacher is not assigned to
      const unassignedClass = await ClassFactory.create({
        name: 'Unassigned Class in District A',
        schoolId: baseFixture.schoolA.id,
        districtId: baseFixture.district.id,
      });

      authenticateAs(baseFixture.classATeacher);
      const res = await request(app)
        .get(`/v1/classes/${unassignedClass.id}/users`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('district B admin cannot list users in class in district A school', async () => {
      authenticateAs(baseFixture.districtBAdmin);
      const res = await request(app)
        .get(`/v1/classes/${baseFixture.classInSchoolA.id}/users`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    describe('query parameters', () => {
      it('filters users by role parameter', async () => {
        const res = await expectRoute('GET', `${path()}?role=student`).as(tiers.admin).toReturn(200);

        expect(res.body.data.items).toBeInstanceOf(Array);
        const userIds = res.body.data.items.map((user: { id: string }) => user.id);
        expect(userIds).toContain(baseFixture.classAStudent.id);
        expect(userIds).not.toContain(baseFixture.classATeacher.id);
      });

      it('filters users by grade parameter', async () => {
        const res = await expectRoute('GET', `${path()}?grade=5`).as(tiers.admin).toReturn(200);

        expect(res.body.data.items).toBeInstanceOf(Array);
        // Should only return users in grade 5
        res.body.data.items.forEach((user: EnrolledUserEntity) => {
          expect(user.grade).toBe('5');
        });
      });

      it('combines role and grade filters', async () => {
        const res = await expectRoute('GET', `${path()}?role=student&grade=5`).as(tiers.admin).toReturn(200);

        expect(res.body.data.items).toBeInstanceOf(Array);
        // Should only contain grade 5 students
        res.body.data.items.forEach((user: EnrolledUserEntity) => {
          expect(user.role).toBe('student');
          expect(user.grade).toBe('5');
        });
      });

      it('supports pagination with page and perPage parameters', async () => {
        const res = await expectRoute('GET', `${path()}?page=1&perPage=1`).as(tiers.admin).toReturn(200);

        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.pagination.page).toBe(1);
        expect(res.body.data.pagination.perPage).toBe(1);
        expect(res.body.data.pagination.totalItems).toBeGreaterThan(0);
        expect(res.body.data.pagination.totalPages).toBeGreaterThan(0);
      });
    });
  });
});
