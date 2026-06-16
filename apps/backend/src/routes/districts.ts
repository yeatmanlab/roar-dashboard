import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { DistrictsContract } from '@roar-platform/api-contract';
import { DistrictsController } from '../controllers/districts.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

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
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, body }) => DistrictsController.create(user!, body),
    },
    list: {
      // @ts-expect-error - ts-rest middleware type incompatibility with Express
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, query }) => DistrictsController.list(user!, query),
    },
    get: {
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { id } }) => DistrictsController.getById(user!, id),
    },
    listSchools: {
      // @ts-expect-error - ts-rest middleware type incompatibility with Express
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { districtId }, query }) =>
        DistrictsController.listSchools(user!, districtId, query),
    },
    listUsers: {
      // @ts-expect-error - ts-rest middleware type incompatibility with Express
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { districtId }, query }) =>
        DistrictsController.listUsers(user!, districtId, query),
    },
  });

  createExpressEndpoints(DistrictsContract, DistrictsRoutes, routerInstance);
}
