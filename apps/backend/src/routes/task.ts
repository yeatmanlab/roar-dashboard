import { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { TasksContract } from '@roar-dashboard/api-contract';
import { TasksController } from '../controllers/tasks.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

export function registerTasksRoutes(routerInstance: Router) {
  const TasksRoutes = s.router(TasksContract, {
    createTaskVariant: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params, body }) =>
        TasksController.createTaskVariant(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          { ...body, taskId: params.taskId },
        ),
    },
  });
  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(TasksContract, TasksRoutes, routerInstance);
}
