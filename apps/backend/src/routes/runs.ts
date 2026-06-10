import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { RunsContract } from '@roar-platform/api-contract';
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
      // @ts-expect-error - ts-rest middleware type incompatibility with Express
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params, body }) => RunsController.create(req.user!, params.userId, body),
    },

    event: {
      // @ts-expect-error - ts-rest middleware type incompatibility with Express
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params, body }) => RunsController.event(req.user!, params.userId, params.runId, body),
    },
  });

  createExpressEndpoints(RunsContract, RunsRoutes, routerInstance);
}
