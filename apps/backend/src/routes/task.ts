import { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { TasksContract } from '@roar-platform/api-contract';
import { TasksController } from '../controllers/tasks.controller';
import { AuthGuardMiddleware } from '../middleware/auth-guard/auth-guard.middleware';
import { asTsRestMiddleware } from '../middleware/auth-guard/as-ts-rest-middleware';

const s = initServer();

export function registerTasksRoutes(routerInstance: Router) {
  const TasksRoutes = s.router(TasksContract, {
    list: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, query }) =>
        TasksController.list({ userId: user!.userId, isSuperAdmin: user!.isSuperAdmin }, query),
    },
    get: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { taskId } }) =>
        TasksController.get({ userId: user!.userId, isSuperAdmin: user!.isSuperAdmin }, taskId),
    },
    create: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, body }) =>
        // user is guaranteed to exist because AuthGuardMiddleware runs before this handler
        TasksController.create(user!, body),
    },
    update: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { taskId }, body }) => TasksController.update(user!, taskId, body),
    },
    listTaskVariants: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { taskId }, query }) =>
        TasksController.listTaskVariants(user!, taskId, query),
    },
    getTaskVariant: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { taskId, variantId } }) =>
        TasksController.getTaskVariant(user!, taskId, variantId),
    },
    createTaskVariant: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { taskId }, body }) =>
        // user is guaranteed to exist because AuthGuardMiddleware runs before this handler
        TasksController.createTaskVariant(user!, taskId, body),
    },
    updateTaskVariant: {
      middleware: [asTsRestMiddleware(AuthGuardMiddleware)],
      handler: async ({ req: { user }, params: { taskId, variantId }, body }) =>
        // user is guaranteed to exist because AuthGuardMiddleware runs before this handler
        TasksController.updateTaskVariant(user!, { taskId, variantId }, body),
    },
  });
  createExpressEndpoints(TasksContract, TasksRoutes, routerInstance);
}
