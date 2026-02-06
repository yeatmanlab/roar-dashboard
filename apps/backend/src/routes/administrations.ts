import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { AdministrationsContract } from '@roar-dashboard/api-contract';
import { AdministrationsController } from '../controllers/administrations.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Registers /administrations routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware).
 * Authorization is handled in the service/repository layer.
 */
export function registerAdministrationsRoutes(routerInstance: Router) {
  const AdministrationsRoutes = s.router(AdministrationsContract, {
    list: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, query }) =>
        AdministrationsController.list({ userId: req.user!.id, isSuperAdmin: req.user!.isSuperAdmin }, query),
    },
    get: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params }) =>
        AdministrationsController.get({ userId: req.user!.id, isSuperAdmin: req.user!.isSuperAdmin }, params.id),
    },
    listDistricts: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params, query }) =>
        AdministrationsController.listDistricts(
          { userId: req.user!.id, isSuperAdmin: req.user!.isSuperAdmin },
          params.id,
          query,
        ),
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(AdministrationsContract, AdministrationsRoutes, routerInstance);
}
