import type { NextFunction, Request, Response, Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { AgreementsContract } from '@roar-dashboard/api-contract';
import { AgreementsController } from '../controllers/agreements.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Middleware that sets aggressive cache headers for immutable agreement version content.
 * Agreement version content is tied to a specific Git commit SHA and never changes.
 *
 * Uses `public` because TOS content is not user-specific — all users see the same
 * markdown for a given version. CDNs and shared caches can safely store the response.
 *
 * @param _req - The Express request object (unused)
 * @param res - The Express response object
 * @param next - The Express next function
 */
function setCacheControlHeaderMiddleware(_req: Request, res: Response, next: NextFunction) {
  res.set('Cache-Control', 'public, max-age=86400, immutable');
  next();
}

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
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, query }) => AgreementsController.list(user!, query),
    },
    getVersionContent: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware, setCacheControlHeaderMiddleware],
      handler: async ({ req: { user }, params }) => AgreementsController.getVersionContent(user!, params),
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(AgreementsContract, AgreementsRoutes, routerInstance);
}
