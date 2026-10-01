import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { AgreementsContract } from '@roar-platform/api-contract';
import { AgreementsController } from '../controllers/agreements.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';
import { ImmutablePublicCacheControlMiddleware } from '../middleware/cache-control/public-cache-control.middleware';

const s = initServer();

/**
 * Registers /agreements routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware).
 * Authorization is handled in the service layer — all authenticated users
 * may list and read agreements, as they are system-wide resources required for
 * consent/onboarding flows.
 */
export function registerAgreementsRoutes(routerInstance: Router) {
  const AgreementsRoutes = s.router(AgreementsContract, {
    list: {
      // @ts-expect-error - ts-rest middleware type incompatibility with Express
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, query }) => AgreementsController.list(user!, query),
    },
    getVersionContent: {
      middleware: [AuthGuardMiddleware, ImmutablePublicCacheControlMiddleware],
      handler: async ({ req: { user }, params }) => AgreementsController.getVersionContent(user!, params),
    },
  });

  createExpressEndpoints(AgreementsContract, AgreementsRoutes, routerInstance);
}
