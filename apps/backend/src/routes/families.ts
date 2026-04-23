import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { FamiliesContract } from '@roar-dashboard/api-contract';
import { FamiliesController } from '../controllers/families.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Registers /families routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware).
 * Authorization is handled in the service layer.
 */
export function registerFamiliesRoutes(routerInstance: Router) {
  const FamiliesRoutes = s.router(FamiliesContract, {
    listUsers: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { familyId }, query }) =>
        FamiliesController.listUsers(user!, familyId, query),
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(FamiliesContract, FamiliesRoutes, routerInstance);
}
