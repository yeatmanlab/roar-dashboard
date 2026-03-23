import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { AdminContract } from '@roar-dashboard/api-contract';
import { AdminController } from '../controllers/admin.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Registers /admin routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware).
 * Authorization (super-admin only) is handled in the service layer.
 */
export function registerAdminRoutes(routerInstance: Router) {
  const AdminRoutes = s.router(AdminContract, {
    backfillFga: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, query }) =>
        AdminController.backfillFga({ userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin }, query),
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(AdminContract, AdminRoutes, routerInstance);
}
