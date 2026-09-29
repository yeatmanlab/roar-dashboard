import type { Router } from 'express';
import { createExpressEndpoints, initServer } from '@ts-rest/express';
import { AuthContract } from '@roar-platform/api-contract';
import { AuthController } from '../controllers/auth.controller';
import { ImmutablePublicCacheControlMiddleware } from '../middleware/cache-control/immutable-public-cache-control.middleware';

const s = initServer();

/**
 * Registers the intentionally public registration routes.
 *
 * No AuthGuardMiddleware is applied: a registrant must fetch and accept the
 * required legal documents before their Firebase identity exists. Contract
 * validation and service-layer agreement validation bound this public surface.
 */
export function registerAuthRoutes(routerInstance: Router) {
  const AuthRoutes = s.router(AuthContract, {
    getRegistrationAgreements: {
      middleware: [ImmutablePublicCacheControlMiddleware],
      handler: async ({ query }) => AuthController.getRegistrationAgreements(query),
    },
    register: {
      handler: async ({ body }) => AuthController.register(body),
    },
  });

  createExpressEndpoints(AuthContract, AuthRoutes, routerInstance);
}
