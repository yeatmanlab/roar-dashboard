import { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { TaskVariantsContract } from '@roar-dashboard/api-contract';
import { TaskVariantsController } from '../controllers/task-variants.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

export function registerTaskVariantsRoutes(routerInstance: Router) {
  const TaskVariantsRoutes = s.router(TaskVariantsContract, {
    list: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, query }) => TaskVariantsController.list(user!, query),
    },
  });
  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(TaskVariantsContract, TaskVariantsRoutes, routerInstance);
}
