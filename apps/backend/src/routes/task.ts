import { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { TasksContract } from '@roar-dashboard/api-contract';
import { TasksController } from '../controllers/tasks.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';

const s = initServer();

export function registerTasksRoutes(routerInstance: Router) {
  const TasksRoutes = s.router(TasksContract, {
    list: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, query }) =>
        TasksController.list({ userId: user!.userId, isSuperAdmin: user!.isSuperAdmin }, query),
    },
    get: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { taskId } }) =>
        TasksController.get({ userId: user!.userId, isSuperAdmin: user!.isSuperAdmin }, taskId),
    },
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
    listVariants: {
      // @ts-expect-error - Express v4/v5 types mismatch in monorepo
      middleware: [AuthGuardMiddleware],
      handler: async ({ req: { user }, params: { taskId }, query }) =>
        TasksController.listVariants({ userId: user!.userId, isSuperAdmin: user!.isSuperAdmin }, taskId, query),
    },
  });
  // @ts-expect-error - Express v4/v5 types mismatch in monorepo
  createExpressEndpoints(TasksContract, TasksRoutes, routerInstance);
}
