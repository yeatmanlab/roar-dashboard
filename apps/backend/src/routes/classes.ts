import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { ClassesContract } from '@roar-dashboard/api-contract';
import { ClassesController } from '../controllers/classes.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Registers /classes routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware).
 * Authorization is handled in the service/repository layer.
 */
export function registerClassesRoutes(routerInstance: Router) {
  const ClassesRoutes = s.router(ClassesContract, {
    listUsers: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params, query }) =>
        ClassesController.listUsers(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          params.classId,
          query,
        ),
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(ClassesContract, ClassesRoutes, routerInstance);
}
