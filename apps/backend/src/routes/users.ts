import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { UsersContract } from '@roar-dashboard/api-contract';
import { UsersController } from '../controllers';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Users routes registration handler.
 *
 * Registers the users routes on the provided router instance using the provided contract.
 *
 * @param routerInstance - The router instance to register the routes on.
 */
export function registerUsersRoutes(routerInstance: Router) {
  const UsersRoutes = s.router(UsersContract, {
    getById: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ params: { id } }) => UsersController.getById(id),
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(UsersContract, UsersRoutes, routerInstance);
}
