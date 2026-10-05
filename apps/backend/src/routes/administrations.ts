import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { AdministrationsContract } from '@roar-platform/api-contract';
import { AdministrationsController } from '../controllers/administrations.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';
import { asTsRestMiddleware } from '../middleware/auth-guard/as-ts-rest-middleware';

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
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, query }) => AdministrationsController.list(user!, query),
    },
    create: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, body }) => AdministrationsController.create(user!, body),
    },
    get: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { id } }) => AdministrationsController.get(user!, id),
    },
    getAssignees: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { id } }) => AdministrationsController.getAssignees(user!, id),
    },
    listTaskVariants: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { id }, query }) =>
        AdministrationsController.listTaskVariants(user!, id, query),
    },
    listAgreements: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { id }, query }) =>
        AdministrationsController.listAgreements(user!, id, query),
    },
    getTree: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { id }, query }) => AdministrationsController.getTree(user!, id, query),
    },
    delete: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { id } }) => AdministrationsController.delete(user!, id),
    },
    update: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { id }, body }) => AdministrationsController.update(user!, id, body),
    },
    aggregateSupportCategories: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { id }, query }) =>
        AdministrationsController.aggregateSupportCategories(user!, id, query),
    },
    progressReports: {
      getStudentProgress: {
        middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
        handler: async ({ req: { user }, params: { id }, query }) =>
          AdministrationsController.listProgressStudents(user!, id, query),
      },
      getProgressOverview: {
        middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
        handler: async ({ req: { user }, params: { id }, query }) =>
          AdministrationsController.getProgressOverview(user!, id, query),
      },
    },
    scoreReports: {
      getOverview: {
        middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
        handler: async ({ req: { user }, params: { id }, query }) =>
          AdministrationsController.getScoreOverview(user!, id, query),
      },
      getScoreFacets: {
        middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
        handler: async ({ req: { user }, params: { id }, query }) =>
          AdministrationsController.getScoreFacets(user!, id, query),
      },
      listStudents: {
        middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
        handler: async ({ req: { user }, params: { id }, query }) =>
          AdministrationsController.listStudentScores(user!, id, query),
      },
      getIndividualStudentReport: {
        middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
        handler: async ({ req: { user }, params: { id, userId }, query }) =>
          AdministrationsController.getIndividualStudentReport(user!, id, userId, query),
      },
      listTaskSubscores: {
        middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
        handler: async ({ req: { user }, params: { id, taskId }, query }) =>
          AdministrationsController.listTaskSubscores(user!, id, taskId, query),
      },
    },
  });

  createExpressEndpoints(AdministrationsContract, AdministrationsRoutes, routerInstance);
}
