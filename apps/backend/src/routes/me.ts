import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { MeContract } from '@roar-dashboard/api-contract';
import { MeController } from '../controllers/me.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Me routes registration handler.
 *
 * Registers the /me route on the provided router instance.
 *
 * @param routerInstance - The router instance to register the routes on.
 */
export function registerMeRoutes(routerInstance: Router) {
  const MeRoutes = s.router(MeContract, {
    get: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req }) => MeController.get(req.user!.userId),
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(MeContract, MeRoutes, routerInstance);
}
