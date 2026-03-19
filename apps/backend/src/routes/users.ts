import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { UsersContract } from '@roar-dashboard/api-contract';
import { UsersController } from '../controllers/users.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Registers /users routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware)
 * Authorization is handled in the service and repository layers.
 */
export function registerUserRoutes(routerInstance: Router) {
  const UserRoutes = s.router(UsersContract, {
    get: {
      middleware: [AuthGuardMiddleware],
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      handler: async ({ req: { user }, params: { id } }) => UsersController.get(user!, id),
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(UsersContract, UserRoutes, routerInstance);
}
