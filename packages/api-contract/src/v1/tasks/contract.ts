import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import {
  CreateTaskVariantRequestBodySchema,
  CreateTaskVariantResponseSchema,
  UpdateTaskVariantRequestBodySchema,
  UpdateTaskVariantResponseSchema,
  TasksListQuerySchema,
  TasksListResponseSchema,
  TaskIdParamSchema,
  TaskSchema,
} from './schema';

const c = initContract();

/**
 * Contract for the /tasks endpoints.
 * Provides access to tasks and task-variant related data that the authenticated user can view.
 */
export const TasksContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/',
      query: TasksListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(TasksListResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List tasks',
      description:
        'Returns a paginated list of tasks. ' +
        'Supports pagination (page, perPage), filtering by exact slug match, and searching by name or description. ' +
        'Results can be sorted by name (default), slug, createdAt, or updatedAt in ascending or descending order. ' +
        'Returns 200 with paginated results on success. ' +
        'Returns 400 if the request parameters are invalid. ' +
        'Returns 500 if a server error occurs.',
    },
    get: {
      method: 'GET',
      path: '/:taskId',
      pathParams: TaskIdParamSchema,
      responses: {
        200: SuccessEnvelopeSchema(TaskSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get a task by ID',
      description:
        'Returns a single task by its UUID. ' +
        'The taskId path parameter must be a valid UUID. ' +
        'Returns 200 with the task on success. ' +
        'Returns 400 if the ID is invalid. ' +
        'Returns 404 if no task exists with the given ID. ' +
        'Returns 500 if a server error occurs.',
    },
    createTaskVariant: {
      method: 'POST',
      path: '/:taskId/variants',
      pathParams: z.object({
        taskId: z.string().uuid(),
      }),
      contentType: 'application/json',
      body: CreateTaskVariantRequestBodySchema,
      responses: {
        201: SuccessEnvelopeSchema(CreateTaskVariantResponseSchema),
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
      body: UpdateTaskVariantRequestBodySchema,
      responses: {
        204: UpdateTaskVariantResponseSchema,
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
        'Returns 204 No Content upon successful update. ' +
        'Returns 404 if the task or variant does not exist. ' +
        'Returns 409 if updating the name would conflict with an existing variant name for the same task.',
    },
  },
  { pathPrefix: '/tasks' },
);
