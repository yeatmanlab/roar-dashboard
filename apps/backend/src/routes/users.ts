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
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { id } }) => UsersController.get(user!, id),
    },
    create: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, body }) => UsersController.create(user!, body),
    },
    update: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { id }, body }) => UsersController.update(user!, id, body),
    },
    recordUserAgreement: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { userId }, body }) =>
        UsersController.recordUserAgreement(user!, userId, body),
    },
    listUserAdministrations: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { userId }, query }) =>
        UsersController.listUserAdministrations(user!, userId, query),
    },
    getUserAdministration: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { userId, administrationId } }) =>
        UsersController.getUserAdministration(user!, userId, administrationId),
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(UsersContract, UserRoutes, routerInstance);
}
