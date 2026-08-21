import { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { TaskBundlesContract } from '@roar-platform/api-contract';
import { TaskBundlesController } from '../controllers/task-bundles.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

export function registerTaskBundlesRoutes(routerInstance: Router) {
  const TaskBundlesRoutes = s.router(TaskBundlesContract, {
    list: {
      // @ts-expect-error - ts-rest middleware type incompatibility with Express
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, query }) => TaskBundlesController.list(user!, query),
    },
  });
  createExpressEndpoints(TaskBundlesContract, TaskBundlesRoutes, routerInstance);
}
