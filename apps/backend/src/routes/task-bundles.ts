import { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { TaskBundlesContract } from '@roar-dashboard/api-contract';
import { TaskBundlesController } from '../controllers/task-bundles.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

export function registerTaskBundlesRoutes(routerInstance: Router) {
  const TaskBundlesRoutes = s.router(TaskBundlesContract, {
    list: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, query }) => TaskBundlesController.list(user!, query),
    },
  });
  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(TaskBundlesContract, TaskBundlesRoutes, routerInstance);
}
