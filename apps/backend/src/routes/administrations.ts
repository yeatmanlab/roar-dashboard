import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { AdministrationsContract } from '@roar-dashboard/api-contract';
import { AdministrationsController } from '../controllers/administrations.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Administrations routes registration handler.
 *
 * Registers the /administrations routes on the provided router instance.
 *
 * @param routerInstance - The router instance to register the routes on.
 */
export function registerAdministrationsRoutes(routerInstance: Router) {
  const AdministrationsRoutes = s.router(AdministrationsContract, {
    list: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, query }) =>
        AdministrationsController.list({ userId: req.user!.id, isSuperAdmin: req.user!.isSuperAdmin }, query),
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(AdministrationsContract, AdministrationsRoutes, routerInstance);
}
