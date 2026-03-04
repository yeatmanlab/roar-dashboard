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
      handler: async ({ req: { user }, params: { taskId }, body }) =>
        // user is guaranteed to exist because AuthGuardMiddleware runs before this handler
        TasksController.createTaskVariant(user!, taskId, body),
    },
    updateTaskVariant: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { taskId, variantId }, body }) =>
        // user is guaranteed to exist because AuthGuardMiddleware runs before this handler
        TasksController.updateTaskVariant(user!, { taskId, variantId }, body),
    },
    updateTaskVariant: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req, params, body }) =>
        TasksController.updateTaskVariant(
          { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
          {
            taskId: params.taskId,
            variantId: params.variantId,
            ...(body.name !== undefined && { name: body.name }),
            ...(body.description !== undefined && { description: body.description }),
            ...(body.status !== undefined && { status: body.status }),
            ...(body.parameters !== undefined && { parameters: body.parameters }),
          },
        ),
    },
  });
  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(TasksContract, TasksRoutes, routerInstance);
}
