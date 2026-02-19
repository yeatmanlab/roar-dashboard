import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { GroupsContract } from '@roar-dashboard/api-contract';
import { GroupsController } from '../controllers/groups.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

/**
 * Registers /groups routes on the provided Express router.
 *
 * All routes require authentication (AuthGuardMiddleware).
 * Authorization is handled in the service layer.
 */
export function registerGroupsRoutes(routerInstance: Router) {
  const GroupsRoutes = s.router(GroupsContract, {
    getInvitationCode: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params }) =>
        GroupsController.getInvitationCode(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          params.groupId,
        ),
    },
  });

  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(GroupsContract, GroupsRoutes, routerInstance);
}
