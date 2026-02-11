import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { DistrictsContract } from '@roar-dashboard/api-contract';
import { DistrictsController } from '../controllers/districts.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Registers /districts routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware).
 * Authorization is handled in the service/repository layer.
 */
export function registerDistrictsRoutes(routerInstance: Router) {
  const DistrictsRoutes = s.router(DistrictsContract, {
<<<<<<< HEAD
    list: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, query }) =>
        DistrictsController.list({ userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin }, query),
=======
    getById: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params, query }) =>
        DistrictsController.getById(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          params.id,
          query,
        ),
>>>>>>> 8bdcae21 (add get district by id endpoint)
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(DistrictsContract, DistrictsRoutes, routerInstance);
}
