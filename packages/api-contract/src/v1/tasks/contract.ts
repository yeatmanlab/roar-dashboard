import { initContract } from '@ts-rest/core';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import {
  CreateTaskVariantRequestBodySchema,
  CreateTaskVariantResponseSchema,
  CreateTaskVariantPathParamSchema,
  UpdateTaskVariantRequestBodySchema,
  UpdateTaskVariantResponseSchema,
  UpdateTaskVariantPathParamSchema,
  TasksListQuerySchema,
  TasksListResponseSchema,
  GetTaskPathParamSchema,
  CreateTaskRequestBodySchema,
  CreateTaskResponseSchema,
  UpdateTaskRequestBodySchema,
  UpdateTaskResponseSchema,
  GetTaskVariantPathParamSchema,
  TaskSchema,
  ListTaskVariantsQuerySchema,
  ListTaskVariantsResponseSchema,
  GetTaskVariantResponseSchema,
  TaskVariantsListQuerySchema,
  TaskVariantsListResponseSchema,
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
      pathParams: GetTaskPathParamSchema,
      responses: {
        200: SuccessEnvelopeSchema(TaskSchema),
        401: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get a task by ID or slug',
      description:
        'Returns a single task by its UUID or slug. ' +
        'Supports task lookup by task UUID or slug (case-sensitive). ' +
        'Returns 200 with the task on success. ' +
        'Returns 404 if no task exists with the given ID or slug. ' +
        'Returns 500 if a server error occurs.',
    },
    create: {
      method: 'POST',
      path: '/',
      contentType: 'application/json',
      body: CreateTaskRequestBodySchema,
      responses: {
        201: SuccessEnvelopeSchema(CreateTaskResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Create a new task',
      description:
        'Creates a new task. Requires super admin privileges. ' +
        'The slug must be unique and follow the format: lowercase alphanumeric with hyphens. ' +
        'Returns 201 with the created task ID on success. ' +
        'Returns 400 if the request body is malformed. ' +
        'Returns 403 if the user is not a super admin. ' +
        'Returns 409 if a task with the same slug already exists. ' +
        'Returns 500 if a server error occurs.',
    },
    update: {
      method: 'PATCH',
      path: '/:taskId',
      pathParams: GetTaskPathParamSchema,
      contentType: 'application/json',
      body: UpdateTaskRequestBodySchema,
      responses: {
        200: SuccessEnvelopeSchema(UpdateTaskResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        422: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Update an existing task by ID or slug',
      description:
        'Updates mutable fields on a task, looked up by UUID or slug (case-sensitive). ' +
        'Requires super admin privileges. ' +
        'The fields id, slug, createdAt, and updatedAt are immutable and will be rejected. ' +
        'Returns 200 with the updated task ID on success. ' +
        'Returns 400 if the request body is malformed or contains immutable fields. ' +
        'Returns 404 if no task exists with the given ID or slug. ' +
        'Returns 422 if immutable fields bypass contract validation (defense-in-depth). ' +
        'Returns 500 if a server error occurs.',
    },
    listTaskVariants: {
      method: 'GET',
      path: '/:taskId/variants',
      pathParams: GetTaskPathParamSchema,
      query: ListTaskVariantsQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(ListTaskVariantsResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List variants for a task',
      description:
        'Returns a paginated list of variants for the specified task. ' +
        'Supports task lookup by task UUID or slug (case-sensitive). ' +
        'All users can see published variants. Super admins can see all variants (draft, published, deprecated). ' +
        'Supports pagination (page, perPage), searching by name or description, and sorting by name, status, createdAt, or updatedAt. ' +
        'Returns 404 if the task does not exist.',
    },
    getTaskVariant: {
      method: 'GET',
      path: '/:taskId/variants/:variantId',
      pathParams: GetTaskVariantPathParamSchema,
      responses: {
        200: SuccessEnvelopeSchema(GetTaskVariantResponseSchema),
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get a task variant',
      description:
        'Returns the variant with the specified ID for the specified task. ' +
        'Supports task variant lookup by task slug or task UUID. ' +
        'Returns 404 if the task or variant does not exist. ' +
        'Returns 500 if an internal server error occurs.',
    },
    createTaskVariant: {
      method: 'POST',
      path: '/:taskId/variants',
      pathParams: CreateTaskVariantPathParamSchema,
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
      pathParams: UpdateTaskVariantPathParamSchema,
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

/**
 * Contract for the /task-variants endpoints.
 * Super-admin-only access to published task variants across all tasks.
 */
export const TaskVariantsContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/',
      query: TaskVariantsListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(TaskVariantsListResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List all published task variants',
      description:
        'Returns a paginated list of all published task variants across all tasks. Requires super admin privileges. ' +
        'Supports pagination (page, perPage), free-text search across variant name, variant description, task name, task slug, and task description, ' +
        'sorting by variant.name (default, asc), variant.createdAt, variant.updatedAt, task.name, or task.slug, ' +
        'structured filter expressions (?filter=field:operator:value) for task.id (eq, neq, in) and task.slug (eq, neq, in, contains), ' +
        'and optional embed of variant parameters (?embed=parameters). ' +
        'Returns 400 if query parameters are invalid. ' +
        'Returns 403 if the caller is not a super admin. ' +
        'Returns 500 if a server error occurs.',
    },
  },
  { pathPrefix: '/task-variants' },
);
