import type { RequestHandler, Router } from 'express';
import { createExpressEndpoints, initServer } from '@ts-rest/express';
import { AuthContract } from '@roar-platform/api-contract';
import { AuthController } from '../controllers/auth.controller';
import { RevalidatedPublicCacheControlMiddleware } from '../middleware/cache-control/immutable-public-cache-control.middleware';
import { createIpRateLimitMiddleware } from '../middleware/rate-limit/ip-rate-limit.middleware';

const s = initServer();

interface AuthRouteOptions {
  registrationAgreementRateLimit?: RequestHandler;
  registrationRateLimit?: RequestHandler;
}

/**
 * Registers the intentionally public registration routes.
 *
 * No AuthGuardMiddleware is applied: a registrant must fetch and accept the
 * required legal documents before their Firebase identity exists. Contract
 * validation and service-layer agreement validation bound this public surface.
 */
export function registerAuthRoutes(
  routerInstance: Router,
  {
    registrationAgreementRateLimit = createIpRateLimitMiddleware({ windowMs: 60_000, maxRequests: 60 }),
    registrationRateLimit = createIpRateLimitMiddleware({ windowMs: 15 * 60_000, maxRequests: 5 }),
  }: AuthRouteOptions = {},
) {
  const AuthRoutes = s.router(AuthContract, {
    getRegistrationAgreements: {
      middleware: [registrationAgreementRateLimit, RevalidatedPublicCacheControlMiddleware],
      handler: async ({ query }) => AuthController.getRegistrationAgreements(query),
    },
    register: {
      middleware: [registrationRateLimit],
      handler: async ({ body }) => AuthController.register(body),
    },
  });

  createExpressEndpoints(AuthContract, AuthRoutes, routerInstance);
}
