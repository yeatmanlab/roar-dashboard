import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { RunsContract } from '@roar-dashboard/api-contract';
import { RunsController } from '../controllers/runs.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Registers /runs routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware).
 * Authorization is handled in the service/repository layer.
 */
export function registerRunsRoutes(routerInstance: Router) {
  const RunsRoutes = s.router(RunsContract, {
    create: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, body }) => {
        const result = await RunsController.create(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          body,
        );

        return result;
      },
    },
    event: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params, body }) => {
        return RunsController.event({ userId: req.user!.id, isSuperAdmin: req.user!.isSuperAdmin }, params.runId, body);
      },
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(RunsContract, RunsRoutes, routerInstance);
}
