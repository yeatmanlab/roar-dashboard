import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { GroupsContract } from '@roar-platform/api-contract';
import { GroupsController } from '../controllers/groups.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';
import { asTsRestMiddleware } from '../middleware/auth-guard/as-ts-rest-middleware';

const s = initServer();

/**
 * Registers /groups routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware).
 * Authorization is handled in the service layer.
 */
export function registerGroupsRoutes(routerInstance: Router) {
  const GroupsRoutes = s.router(GroupsContract, {
    create: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, body }) => GroupsController.create(user!, body),
    },
    list: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req, query }) =>
        GroupsController.list({ userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin }, query),
    },
    get: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req, params }) =>
        GroupsController.getById({ userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin }, params.groupId),
    },
    update: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req, params, body }) =>
        GroupsController.update(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          params.groupId,
          body,
        ),
    },
    getInvitationCode: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req, params }) =>
        GroupsController.getInvitationCode(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          params.groupId,
        ),
    },
    listUsers: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req, params, query }) =>
        GroupsController.listUsers(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          params.groupId,
          query,
        ),
    },
  });

  createExpressEndpoints(GroupsContract, GroupsRoutes, routerInstance);
}
