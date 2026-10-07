import { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { TaskVariantsContract } from '@roar-platform/api-contract';
import { TaskVariantsController } from '../controllers/task-variants.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';
import { asTsRestMiddleware } from '../middleware/auth-guard/as-ts-rest-middleware';

const s = initServer();

export function registerTaskVariantsRoutes(routerInstance: Router) {
  const TaskVariantsRoutes = s.router(TaskVariantsContract, {
    list: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, query }) => TaskVariantsController.list(user!, query),
    },
    getByIdWithTaskDetails: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { variantId } }) =>
        TaskVariantsController.getByIdWithTaskDetails(user!, variantId),
    },
  });
  createExpressEndpoints(TaskVariantsContract, TaskVariantsRoutes, routerInstance);
}
