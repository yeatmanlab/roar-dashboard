import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { UsersContract } from '@roar-platform/api-contract';
import { UsersController } from '../controllers/users.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';
import { AnonTokenMiddleware } from '../middleware/anon-token/anon-token.middleware';
import { asTsRestMiddleware } from '../middleware/auth-guard/as-ts-rest-middleware';

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
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { id } }) => UsersController.get(user!, id),
    },
    create: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, body }) => UsersController.create(user!, body),
    },
    bulkImport: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, body }) => UsersController.bulkImport(user!, body),
    },
    update: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { id }, body }) => UsersController.update(user!, id, body),
    },
    recordUserAgreement: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { userId }, body }) =>
        UsersController.recordUserAgreement(user!, userId, body),
    },
    listUserAdministrations: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { userId }, query }) =>
        UsersController.listUserAdministrations(user!, userId, query),
    },
    getUserAdministration: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { userId, administrationId } }) =>
        UsersController.getUserAdministration(user!, userId, administrationId),
    },
    listUserAdministrationAgreements: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { userId, administrationId }, query }) =>
        UsersController.listUserAdministrationAgreements(user!, userId, administrationId, query),
    },
    listUserMemberships: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { userId } }) => UsersController.listUserMemberships(user!, userId),
    },
    scoreReports: {
      getGuardianStudentReport: {
        middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
        handler: async ({ req: { user }, params: { userId } }) =>
          UsersController.getGuardianStudentReport(user!, userId),
      },
    },
    createAnonymous: {
      middleware: [asTsRestMiddleware(AnonTokenMiddleware)],
      handler: async ({ req: { decodedAnonymousUser } }) => UsersController.createAnonymous(decodedAnonymousUser!.uid),
    },
  });

  createExpressEndpoints(UsersContract, UserRoutes, routerInstance);
}
