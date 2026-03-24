import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { SystemContract } from '@roar-dashboard/api-contract';
import { SystemController } from '../controllers/system.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Registers /system routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware).
 * Authorization (super-admin only) is handled in the service layer.
 */
export function registerSystemRoutes(routerInstance: Router) {
  const SystemRoutes = s.router(SystemContract, {
    syncFga: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, query }) =>
        SystemController.syncFga({ userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin }, query),
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(SystemContract, SystemRoutes, routerInstance);
}
