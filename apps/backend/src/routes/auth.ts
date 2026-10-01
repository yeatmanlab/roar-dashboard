import type { RequestHandler, Router } from 'express';
import { createExpressEndpoints, initServer } from '@ts-rest/express';
import { AuthContract } from '@roar-platform/api-contract';
import { AuthController } from '../controllers/auth.controller';
import { RevalidatedPublicCacheControlMiddleware } from '../middleware/cache-control/public-cache-control.middleware';
import {
  createEmailRateLimitMiddleware,
  createIpRateLimitMiddleware,
} from '../middleware/rate-limit/ip-rate-limit.middleware';
import {
  REGISTRATION_AGREEMENTS_RATE_LIMIT,
  REGISTRATION_SUBMISSION_EMAIL_RATE_LIMIT,
  REGISTRATION_SUBMISSION_IP_RATE_LIMIT,
} from '../constants/registration-rate-limits';

const s = initServer();

interface AuthRouteOptions {
  registrationAgreementRateLimit?: RequestHandler;
  registrationRateLimit?: RequestHandler;
  registrationEmailRateLimit?: RequestHandler;
}

/**
 * Registers the intentionally public registration routes.
 *
 * No AuthGuardMiddleware is applied: a registrant must fetch and accept the
 * required legal documents before their Firebase identity exists. Contract
 * validation and service-layer agreement validation bound this public surface.
 *
 * @param routerInstance - Express router on which to register the auth contract
 * @param options - Optional middleware overrides used by focused route tests
 * @returns Nothing
 */
export function registerAuthRoutes(
  routerInstance: Router,
  {
    registrationAgreementRateLimit = createIpRateLimitMiddleware(REGISTRATION_AGREEMENTS_RATE_LIMIT),
    registrationRateLimit = createIpRateLimitMiddleware(REGISTRATION_SUBMISSION_IP_RATE_LIMIT),
    registrationEmailRateLimit = createEmailRateLimitMiddleware(REGISTRATION_SUBMISSION_EMAIL_RATE_LIMIT),
  }: AuthRouteOptions = {},
) {
  const AuthRoutes = s.router(AuthContract, {
    getRegistrationAgreements: {
      middleware: [registrationAgreementRateLimit, RevalidatedPublicCacheControlMiddleware],
      handler: async ({ query }) => AuthController.getRegistrationAgreements(query),
    },
    register: {
      middleware: [registrationRateLimit, registrationEmailRateLimit],
      handler: async ({ body }) => AuthController.register(body),
    },
  });

  createExpressEndpoints(AuthContract, AuthRoutes, routerInstance);
}
