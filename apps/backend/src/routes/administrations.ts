import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { AdministrationsContract } from '@roar-platform/api-contract';
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
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, query }) => AdministrationsController.list(user!, query),
    },
    create: {
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, body }) => AdministrationsController.create(user!, body),
    },
    get: {
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { id } }) => AdministrationsController.get(user!, id),
    },
    getAssignees: {
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { id } }) => AdministrationsController.getAssignees(user!, id),
    },
    listTaskVariants: {
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { id }, query }) =>
        AdministrationsController.listTaskVariants(user!, id, query),
    },
    listAgreements: {
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { id }, query }) =>
        AdministrationsController.listAgreements(user!, id, query),
    },
    getTree: {
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { id }, query }) => AdministrationsController.getTree(user!, id, query),
    },
    delete: {
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { id } }) => AdministrationsController.delete(user!, id),
    },
    update: {
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { id }, body }) => AdministrationsController.update(user!, id, body),
    },
    progressReports: {
      getStudentProgress: {
        middleware: [AuthGuardMiddleware],
        handler: async ({ req: { user }, params: { id }, query }) =>
          AdministrationsController.listProgressStudents(user!, id, query),
      },
      getProgressOverview: {
        middleware: [AuthGuardMiddleware],
        handler: async ({ req: { user }, params: { id }, query }) =>
          AdministrationsController.getProgressOverview(user!, id, query),
      },
    },
    scoreReports: {
      getOverview: {
        middleware: [AuthGuardMiddleware],
        handler: async ({ req: { user }, params: { id }, query }) =>
          AdministrationsController.getScoreOverview(user!, id, query),
      },
      getScoreFacets: {
        middleware: [AuthGuardMiddleware],
        handler: async ({ req: { user }, params: { id }, query }) =>
          AdministrationsController.getScoreFacets(user!, id, query),
      },
      listStudents: {
        middleware: [AuthGuardMiddleware],
        handler: async ({ req: { user }, params: { id }, query }) =>
          AdministrationsController.listStudentScores(user!, id, query),
      },
      getIndividualStudentReport: {
        middleware: [AuthGuardMiddleware],
        handler: async ({ req: { user }, params: { id, userId }, query }) =>
          AdministrationsController.getIndividualStudentReport(user!, id, userId, query),
      },
    },
  });

  createExpressEndpoints(AdministrationsContract, AdministrationsRoutes, routerInstance);
}
