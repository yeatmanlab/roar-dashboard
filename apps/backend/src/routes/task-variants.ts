import { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { TaskVariantsContract } from '@roar-platform/api-contract';
import { TaskVariantsController } from '../controllers/task-variants.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

export function registerTaskVariantsRoutes(routerInstance: Router) {
  const TaskVariantsRoutes = s.router(TaskVariantsContract, {
    list: {
      // @ts-expect-error - ts-rest middleware type incompatibility with Express
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, query }) => TaskVariantsController.list(user!, query),
    },
  });
  // @ts-expect-error - ts-rest middleware type incompatibility with Express
  createExpressEndpoints(TaskVariantsContract, TaskVariantsRoutes, routerInstance);
}
