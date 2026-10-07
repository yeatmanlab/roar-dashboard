import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { DistrictsContract } from '@roar-platform/api-contract';
import { DistrictsController } from '../controllers/districts.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';
import { asTsRestMiddleware } from '../middleware/auth-guard/as-ts-rest-middleware';

const s = initServer();

/**
 * Registers /districts routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware).
 * Authorization is handled in the service/repository layer.
 */
export function registerDistrictsRoutes(routerInstance: Router) {
  const DistrictsRoutes = s.router(DistrictsContract, {
    create: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, body }) => DistrictsController.create(user!, body),
    },
    list: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, query }) => DistrictsController.list(user!, query),
    },
    get: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { id } }) => DistrictsController.getById(user!, id),
    },
    update: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { id }, body }) => DistrictsController.update(user!, id, body),
    },
    listSchools: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { districtId }, query }) =>
        DistrictsController.listSchools(user!, districtId, query),
    },
    listUsers: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { districtId }, query }) =>
        DistrictsController.listUsers(user!, districtId, query),
    },
  });

  createExpressEndpoints(DistrictsContract, DistrictsRoutes, routerInstance);
}
