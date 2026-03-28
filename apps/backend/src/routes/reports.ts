import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { ScoreReportsContract } from '@roar-dashboard/api-contract';
import { AdministrationsController } from '../controllers/administrations.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Registers /administrations/:administrationId/reports/scores routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware).
 * Authorization is handled in the service layer.
 */
export function registerReportsRoutes(routerInstance: Router) {
  const ScoreRoutes = s.router(ScoreReportsContract, {
    getOverview: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params, query }) =>
        AdministrationsController.getScoreOverview(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          params.administrationId,
          query,
        ),
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(ScoreReportsContract, ScoreRoutes, routerInstance);
}
