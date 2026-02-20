import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import { TaskVariantCreateRequestSchema, TaskVariantCreateResponseSchema } from './schema';

const c = initContract();

/**
 * Contract for the /tasks endpoints.
 * Provides access to tasks and task-variant related data that the authenticated user can view.
 */
export const TasksContract = c.router(
  {
    createTaskVariant: {
      method: 'POST',
      path: '/:taskId/variants',
      pathParams: z.object({
        taskId: z.string().uuid(),
      }),
      contentType: 'application/json',
      body: TaskVariantCreateRequestSchema,
      responses: {
        201: SuccessEnvelopeSchema(TaskVariantCreateResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Create a new task variant',
      description:
        'Create a new task variant for a given task. ' +
        'The request includes an array of task-variant parameters, each with a name and a value. ' +
        'Returns 201 upon successful creation. ' +
        'Returns 409 if a variant with the same name already exists.',
    },
  },
  { pathPrefix: '/tasks' },
);
