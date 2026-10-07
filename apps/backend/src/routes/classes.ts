import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { ClassesContract } from '@roar-platform/api-contract';
import { ClassesController } from '../controllers/classes.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';
import { asTsRestMiddleware } from '../middleware/auth-guard/as-ts-rest-middleware';

const s = initServer();

/**
 * Registers /classes routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware).
 * Authorization is handled in the service/repository layer.
 */
export function registerClassesRoutes(routerInstance: Router) {
  const ClassesRoutes = s.router(ClassesContract, {
    create: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, body }) => ClassesController.create(user!, body),
    },
    get: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req, params }) =>
        ClassesController.get({ userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin }, params.classId),
    },
    update: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req, params, body }) =>
        ClassesController.update(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          params.classId,
          body,
        ),
    },
    listUsers: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req, params, query }) =>
        ClassesController.listUsers(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          params.classId,
          query,
        ),
    },
  });

  createExpressEndpoints(ClassesContract, ClassesRoutes, routerInstance);
}
