import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { ProgressReportsContract } from '@roar-dashboard/api-contract';
import { ReportsController } from '../controllers/reports.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Registers /administrations/:id/reports routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware).
 * Authorization is handled in the service layer.
 */
export function registerReportsRoutes(routerInstance: Router) {
  const ReportsRoutes = s.router(ProgressReportsContract, {
    getStudentProgress: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params, query }) =>
        ReportsController.listProgressStudents(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          params.id,
          query,
        ),
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(ProgressReportsContract, ReportsRoutes, routerInstance);
}
