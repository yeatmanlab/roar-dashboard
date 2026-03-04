import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import {
  TaskVariantCreateRequestSchema,
  TaskVariantCreateResponseSchema,
  TaskVariantUpdateRequestSchema,
  TaskVariantUpdateResponseSchema,
} from './schema';

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
    updateTaskVariant: {
      method: 'PATCH',
      path: '/:taskId/variants/:variantId',
      pathParams: z.object({
        taskId: z.string().uuid(),
        variantId: z.string().uuid(),
      }),
      contentType: 'application/json',
      body: TaskVariantUpdateRequestSchema,
      responses: {
        200: SuccessEnvelopeSchema(TaskVariantUpdateResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Update an existing task variant',
      description:
        'Update an existing task variant for a given task. ' +
        'All fields are optional - only provided fields will be updated. ' +
        'When updating parameters, the entire parameters array must be provided (it replaces existing parameters). ' +
        'Returns 200 upon successful update. ' +
        'Returns 404 if the task or variant does not exist. ' +
        'Returns 409 if updating the name would conflict with an existing variant name for the same task.',
    },
  },
  { pathPrefix: '/tasks' },
);
