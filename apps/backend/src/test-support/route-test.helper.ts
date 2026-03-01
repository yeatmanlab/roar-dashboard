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
 * import { authenticateAs } from '../test-support/route-test.helper';
 * import { baseFixture } from '../test-support/fixtures';
 *
 * // Create app in beforeAll — after DB pools are initialized by vitest.setup.ts.
 * // Route modules instantiate services at import time which capture CoreDbClient,
 * // so they must be imported after initializeDatabasePools() completes.
 * let app: express.Application;
 * beforeAll(async () => {
 *   const { createTestApp } = await import('../test-support/route-test.helper');
 *   const { registerAdministrationsRoutes } = await import('./administrations');
 *   app = createTestApp(registerAdministrationsRoutes);
 * });
 *
 * it('returns administrations for authenticated user', async () => {
 *   authenticateAs(baseFixture.districtAdmin);
 *   const response = await request(app)
 *     .get('/v1/administrations')
 *     .set('Authorization', 'Bearer token')
 *     .expect(200);
 *   expect(response.body.data).toBeDefined();
 * });
 * ```
 */
import express from 'express';
import type { Router } from 'express';
import { vi } from 'vitest';
import { AuthService } from '../services/auth/auth.service';
import { errorHandler } from '../error-handler';

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
