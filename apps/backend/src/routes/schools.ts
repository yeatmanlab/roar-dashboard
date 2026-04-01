import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { SchoolsContract } from '@roar-dashboard/api-contract';
import { SchoolsController } from '../controllers/schools.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Registers /schools routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware).
 * Authorization is handled in the service/repository layer.
 */
export function registerSchoolsRoutes(routerInstance: Router) {
  const SchoolsRoutes = s.router(SchoolsContract, {
    list: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, query }) => SchoolsController.list(user!, query),
    },
    get: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { schoolId } }) => SchoolsController.getById(user!, schoolId),
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(SchoolsContract, SchoolsRoutes, routerInstance);
}
