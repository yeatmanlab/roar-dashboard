import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { AdministrationsContract } from '@roar-dashboard/api-contract';
import { AdministrationsController } from '../controllers/administrations.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Registers /administrations routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware).
 * Authorization is handled in the service/repository layer.
 */
export function registerAdministrationsRoutes(routerInstance: Router) {
  const AdministrationsRoutes = s.router(AdministrationsContract, {
    list: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, query }) =>
        AdministrationsController.list({ userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin }, query),
    },
    get: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params }) =>
        AdministrationsController.get({ userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin }, params.id),
    },
    listDistricts: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params, query }) =>
        AdministrationsController.listDistricts(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          params.id,
          query,
        ),
    },
    listSchools: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params, query }) =>
        AdministrationsController.listSchools(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          params.id,
          query,
        ),
    },
    listClasses: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params, query }) =>
        AdministrationsController.listClasses(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          params.id,
          query,
        ),
    },
    listGroups: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params, query }) =>
        AdministrationsController.listGroups(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          params.id,
          query,
        ),
    },
    listTaskVariants: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params, query }) =>
        AdministrationsController.listTaskVariants(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          params.id,
          query,
        ),
    },
    listAgreements: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params, query }) =>
        AdministrationsController.listAgreements(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          params.id,
          query,
        ),
    },
    delete: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params }) =>
        AdministrationsController.delete({ userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin }, params.id),
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(AdministrationsContract, AdministrationsRoutes, routerInstance);
}
