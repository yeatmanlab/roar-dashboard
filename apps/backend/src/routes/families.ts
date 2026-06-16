import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { FamiliesContract } from '@roar-platform/api-contract';
import { FamiliesController } from '../controllers/families.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Registers /families routes on the provided Express router.
 *
 * Most routes require authentication (AuthGuardMiddleware) — the `create` route is the
 * exception. `POST /v1/families` is the public ROAR@Home self-registration endpoint and
 * intentionally has no auth middleware: the caretaker has no identity at the moment they
 * call it. Service-layer guards (email uniqueness, one-family-per-caretaker via the
 * `families_created_by_uniq_idx` partial unique index) are the safety net.
 *
 * Authorization for the guarded routes is handled in the service layer.
 */
export function registerFamiliesRoutes(routerInstance: Router) {
  const FamiliesRoutes = s.router(FamiliesContract, {
    create: {
      handler: async ({ body }) => FamiliesController.create(body),
    },
    addChildren: {
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { familyId }, body }) =>
        FamiliesController.addChildren(user!, familyId, body),
    },
    listUsers: {
      // @ts-expect-error - ts-rest middleware type incompatibility with Express
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { familyId }, query }) =>
        FamiliesController.listUsers(user!, familyId, query),
    },
  });

  createExpressEndpoints(FamiliesContract, FamiliesRoutes, routerInstance);
}
