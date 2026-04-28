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
      handler: async ({ req: { user }, query }) => AdministrationsController.list(user!, query),
    },
    get: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { id } }) => AdministrationsController.get(user!, id),
    },
    getAssignees: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { id } }) => AdministrationsController.getAssignees(user!, id),
    },
    listTaskVariants: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { id }, query }) =>
        AdministrationsController.listTaskVariants(user!, id, query),
    },
    listAgreements: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { id }, query }) =>
        AdministrationsController.listAgreements(user!, id, query),
    },
    getTree: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { id }, query }) => AdministrationsController.getTree(user!, id, query),
    },
    delete: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { id } }) => AdministrationsController.delete(user!, id),
    },
    progressReports: {
      getStudentProgress: {
        // @ts-expect-error - Express v4/v5 types mismatch in monorepo
        middleware: [AuthGuardMiddleware],
        handler: async ({ req: { user }, params: { id }, query }) =>
          AdministrationsController.listProgressStudents(user!, id, query),
      },
      getProgressOverview: {
        // @ts-expect-error - Express v4/v5 types mismatch in monorepo
        middleware: [AuthGuardMiddleware],
        handler: async ({ req: { user }, params: { id }, query }) =>
          AdministrationsController.getProgressOverview(user!, id, query),
      },
    },
    scoreReports: {
      getOverview: {
        // @ts-expect-error - Express v4/v5 types mismatch in monorepo
        middleware: [AuthGuardMiddleware],
        handler: async ({ req: { user }, params: { id }, query }) =>
          AdministrationsController.getScoreOverview(user!, id, query),
      },
      listStudents: {
        // @ts-expect-error - Express v4/v5 types mismatch in monorepo
        middleware: [AuthGuardMiddleware],
        handler: async ({ req: { user }, params: { id }, query }) =>
          AdministrationsController.listStudentScores(user!, id, query),
      },
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(AdministrationsContract, AdministrationsRoutes, routerInstance);
}
