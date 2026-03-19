/**
 * Route Integration Test Helper
 *
 * Provides utilities for full-stack HTTP integration tests that exercise
 * the real middleware -> controller -> service -> repository -> DB chain.
 *
 * Only Firebase token verification is mocked — everything else runs for real.
 *
 * @example
 * ```typescript
 * import { baseFixture } from '../test-support/fixtures';
 *
 * let app: express.Application;
 * let expectRoute: ReturnType<typeof createRouteHelper>;
 * let tiers: TierUsers;
 *
 * beforeAll(async () => {
 *   const { createTestApp, createRouteHelper, createTierUsers } = await import('../test-support/route-test.helper');
 *   const { registerAdministrationsRoutes } = await import('./administrations');
 *
 *   app = createTestApp(registerAdministrationsRoutes);
 *   expectRoute = createRouteHelper(app);
 *   tiers = await createTierUsers(baseFixture.district.id);
 * });
 *
 * it('admin can list administrations', async () => {
 *   const res = await expectRoute('GET', '/v1/administrations')
 *     .as(tiers.admin).toReturn(200);
 *   expect(res.body.data.items).toBeInstanceOf(Array);
 * });
 *
 * it('returns 401 without auth', async () => {
 *   const res = await expectRoute('GET', '/v1/administrations')
 *     .unauthenticated().toReturn(401);
 * });
 * ```
 */
import express from 'express';
import type { Router } from 'express';
import request from 'supertest';
import { expect, vi } from 'vitest';
import { AuthService } from '../services/auth/auth.service';
import { errorHandler } from '../error-handler';
import { UserRole } from '../enums/user-role.enum';
import { UserFactory } from './factories/user.factory';
import { UserOrgFactory } from './factories/user-org.factory';
import { UserGroupFactory } from './factories/user-group.factory';
// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A user identity for route tests — only `authId` is needed since
 * AuthGuardMiddleware looks up the full user record from the DB.
 */
export interface TierUser {
  authId: string;
}

/**
 * One representative user per RolePermissions permission tier.
 *
 * Maps directly to the tier groupings in `constants/role-permissions.ts`:
 *   - superAdmin:  isSuperAdmin=true in DB (bypasses all access control)
 *   - siteAdmin:   site_administrator role
 *   - admin:       administrator role
 *   - educator:    teacher role
 *   - student:     student role
 *   - caregiver:   guardian role
 */
export interface TierUsers {
  superAdmin: TierUser;
  siteAdmin: TierUser;
  admin: TierUser;
  educator: TierUser;
  student: TierUser;
  caregiver: TierUser;
}

// ═══════════════════════════════════════════════════════════════════════════
// App & Auth
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates an Express app wired for route integration tests.
 *
 * Registers the given route handler(s) under the /v1 prefix with JSON parsing
 * and the global error handler — matching the production app structure.
 *
 * @param registerRoutes - One or more route registration functions (e.g., registerAdministrationsRoutes)
 * @returns A configured Express application ready for supertest
 */
export function createTestApp(...registerRoutes: Array<(router: Router) => void>): express.Application {
  const app = express();
  app.use(express.json());

  const router = express.Router();
  for (const register of registerRoutes) {
    register(router);
  }
  app.use('/v1', router);

  app.use(errorHandler);

  return app;
}

/**
 * Mocks Firebase token verification to resolve as the given user.
 *
 * The real AuthGuardMiddleware runs, calls the real UserService.findByAuthId
 * against the real DB, and populates the real req.user — only the Firebase
 * token decode step is bypassed.
 *
 * Call this in `beforeEach` or at the start of each test.
 * Any `Authorization: Bearer <token>` header will authenticate as this user.
 *
 * @param user - A user object with an `authId` field (e.g., from baseFixture)
 */
export function authenticateAs(user: { authId: string | null }) {
  vi.spyOn(AuthService, 'verifyToken').mockResolvedValue({
    uid: user.authId!,
    claims: {},
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Tier Users
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates one user per permission tier, all enrolled at the given org.
 *
 * Call once in `beforeAll` after DB pools are initialized. The returned
 * users can be passed to `expectRoute(...).as(tiers.admin)`.
 *
 * @param orgId - The org to enroll all tier users at (e.g., baseFixture.district.id)
 * @returns TierUsers with one representative per permission tier
 */
export async function createTierUsers(orgId: string): Promise<TierUsers> {
  const [superAdminUser, siteAdminUser, adminUser, educatorUser, studentUser, caregiverUser] = await Promise.all([
    UserFactory.create({ nameFirst: 'Tier', nameLast: 'SuperAdmin', isSuperAdmin: true }),
    UserFactory.create({ nameFirst: 'Tier', nameLast: 'SiteAdmin' }),
    UserFactory.create({ nameFirst: 'Tier', nameLast: 'Admin' }),
    UserFactory.create({ nameFirst: 'Tier', nameLast: 'Educator' }),
    UserFactory.create({ nameFirst: 'Tier', nameLast: 'Student' }),
    UserFactory.create({ nameFirst: 'Tier', nameLast: 'Caregiver' }),
  ]);

  await Promise.all([
    UserOrgFactory.create({ userId: superAdminUser.id, orgId, role: UserRole.ADMINISTRATOR }),
    UserOrgFactory.create({ userId: siteAdminUser.id, orgId, role: UserRole.SITE_ADMINISTRATOR }),
    UserOrgFactory.create({ userId: adminUser.id, orgId, role: UserRole.ADMINISTRATOR }),
    UserOrgFactory.create({ userId: educatorUser.id, orgId, role: UserRole.TEACHER }),
    UserOrgFactory.create({ userId: studentUser.id, orgId, role: UserRole.STUDENT }),
    UserOrgFactory.create({ userId: caregiverUser.id, orgId, role: UserRole.GUARDIAN }),
  ]);

  return {
    superAdmin: { authId: superAdminUser.authId! },
    siteAdmin: { authId: siteAdminUser.authId! },
    admin: { authId: adminUser.authId! },
    educator: { authId: educatorUser.authId! },
    student: { authId: studentUser.authId! },
    caregiver: { authId: caregiverUser.authId! },
  };
}

/**
 * Creates one user per permission tier, all enrolled at the given group.
 *
 * Call once in `beforeAll` after DB pools are initialized. The returned
 * users can be passed to `expectRoute(...).as(tiers.admin)`.
 *
 * @param groupId - The group to enroll all tier users at (e.g., baseFixture.group.id)
 * @returns TierUsers with one representative per permission tier
 */
export async function createGroupTierUsers(groupId: string): Promise<TierUsers> {
  const [superAdminUser, siteAdminUser, adminUser, educatorUser, studentUser, caregiverUser] = await Promise.all([
    UserFactory.create({ nameFirst: 'Tier', nameLast: 'SuperAdmin', isSuperAdmin: true }),
    UserFactory.create({ nameFirst: 'Tier', nameLast: 'SiteAdmin' }),
    UserFactory.create({ nameFirst: 'Tier', nameLast: 'Admin' }),
    UserFactory.create({ nameFirst: 'Tier', nameLast: 'Educator' }),
    UserFactory.create({ nameFirst: 'Tier', nameLast: 'Student' }),
    UserFactory.create({ nameFirst: 'Tier', nameLast: 'Caregiver' }),
  ]);

  await Promise.all([
    UserGroupFactory.create({ userId: superAdminUser.id, groupId, role: UserRole.ADMINISTRATOR }),
    UserGroupFactory.create({ userId: siteAdminUser.id, groupId, role: UserRole.SITE_ADMINISTRATOR }),
    UserGroupFactory.create({ userId: adminUser.id, groupId, role: UserRole.ADMINISTRATOR }),
    UserGroupFactory.create({ userId: educatorUser.id, groupId, role: UserRole.TEACHER }),
    UserGroupFactory.create({ userId: studentUser.id, groupId, role: UserRole.STUDENT }),
    UserGroupFactory.create({ userId: caregiverUser.id, groupId, role: UserRole.GUARDIAN }),
  ]);

  return {
    superAdmin: { authId: superAdminUser.authId! },
    siteAdmin: { authId: siteAdminUser.authId! },
    admin: { authId: adminUser.authId! },
    educator: { authId: educatorUser.authId! },
    student: { authId: studentUser.authId! },
    caregiver: { authId: caregiverUser.authId! },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Route Helper
// ═══════════════════════════════════════════════════════════════════════════

type HttpMethod = 'get' | 'post' | 'put' | 'delete';

/**
 * Creates a fluent helper for making HTTP requests and asserting responses.
 *
 * Binds to the given Express app so tests don't need to pass it each time.
 *
 * @param app - The Express application (from createTestApp)
 * @returns A function `expectRoute(method, path)` with `.as()` and `.unauthenticated()` chains
 *
 * @example
 * ```typescript
 * const expectRoute = createRouteHelper(app);
 *
 * // Authenticated request
 * const res = await expectRoute('GET', '/v1/administrations')
 *   .as(tiers.admin).toReturn(200);
 *
 * // Unauthenticated request
 * const res = await expectRoute('GET', '/v1/administrations')
 *   .unauthenticated().toReturn(401);
 * ```
 */
export function createRouteHelper(app: express.Application) {
  return function expectRoute(method: string, path: string) {
    const httpMethod = method.toLowerCase() as HttpMethod;

    return {
      as(user: TierUser) {
        return {
          async toReturn(expectedStatus: number): Promise<request.Response> {
            authenticateAs(user);
            const res = await request(app)[httpMethod](path).set('Authorization', 'Bearer token');
            expect(res.status).toBe(expectedStatus);
            return res;
          },
        };
      },
      unauthenticated() {
        return {
          async toReturn(expectedStatus: number): Promise<request.Response> {
            const res = await request(app)[httpMethod](path);
            expect(res.status).toBe(expectedStatus);
            return res;
          },
        };
      },
    };
  };
}
