import type { AuthContext } from '../types/auth-context';
import type {
  CreateTaskVariantRequestBody,
  UpdateTaskVariantRequestBody,
  TasksListQuery,
  Task as ContractTask,
  Json,
} from '@roar-dashboard/api-contract';
import type { Task } from '../db/schema';
import { StatusCodes } from 'http-status-codes';
import { TaskService } from '../services/task/task.service';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';

/**
 * Maps a database Task entity to the API schema.
 * Converts Date fields to ISO strings.
 *
 * @param task - The database Task entity
 * @returns The API-formatted task object
 */
function transformTask(task: Task): ContractTask {
  return {
    id: task.id,
    slug: task.slug,
    name: task.name,
    nameSimple: task.nameSimple,
    nameTechnical: task.nameTechnical,
    description: task.description,
    image: task.image,
    tutorialVideo: task.tutorialVideo,
    taskConfig: task.taskConfig as Json,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt?.toISOString() ?? null,
  };
}

const taskService = TaskService();

/**
 * Handles HTTP concerns for the /tasks endpoints.
 *
 * Responsible for transforming service results into ts-rest responses
 * and mapping known ApiError status codes to type error responses.
 * Business logic and authorization lives in TaskService.
 */
export const TasksController = {
  /**
   * List all tasks with optional filtering and sorting.
   *
   * Delegates to TaskService for business logic.
   *
   * @param authContext - User's authentication context
   * @param query - Query parameters for pagination, sorting, and filtering
   * @returns Paginated list of tasks
   */
  list: async (authContext: AuthContext, query: TasksListQuery) => {
    try {
      const { page, perPage, sortBy, sortOrder, slug, search } = query;
      const result = await taskService.list(authContext, {
        page,
        perPage,
        orderBy: { field: sortBy, direction: sortOrder },
        ...(slug && { slug }),
        ...(search && { search }),
      });

      return {
        status: StatusCodes.OK as const,
        body: {
          data: {
            items: result.items.map(transformTask),
            pagination: {
              page,
              perPage,
              totalItems: result.totalItems,
              totalPages: Math.ceil(result.totalItems / perPage),
            },
          },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [StatusCodes.BAD_REQUEST, StatusCodes.INTERNAL_SERVER_ERROR]);
      }
      throw error;
    }
  },

  /**
   * Get a single task by its slug.
   *
   * Delegates to TaskService for business logic.
   *
   * @param authContext - User's authentication context
   * @param slug - The unique slug identifier for the task
   * @returns The task with the given slug
   */
  get: async (authContext: AuthContext, taskId: string) => {
    try {
      const task = await taskService.getById(authContext, taskId);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: transformTask(task),
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [StatusCodes.NOT_FOUND, StatusCodes.INTERNAL_SERVER_ERROR]);
      }
      throw error;
    }
  },

  /**
   * Create a new task-variant for a given task id.
   *
   * Delegates to TaskService for authorization and business logic.
   * Requires super admin privileges. The variant and all its parameters
   * are created atomically within a database transaction.
   *
   * @param authContext - User's authentication context (requires super admin)
   * @param taskId - Path parameter containing the parent task's UUID
   * @param body - Request body with variant details (name, description, status, parameters)
   * @returns Response with status 201 and the newly created task variant's UUID
   *
   * @see {@link CreateTaskVariantRequestBody} - Schema for creating a new task variant
   */
  createTaskVariant: async (authContext: AuthContext, taskId: string, body: CreateTaskVariantRequestBody) => {
    try {
      const id = await taskService.createTaskVariant(authContext, taskId, body);
      return {
        status: StatusCodes.CREATED as const,
        body: {
          data: id,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.CONFLICT,
          StatusCodes.INTERNAL_SERVER_ERROR,
          StatusCodes.BAD_REQUEST,
        ]);
      }
      throw error;
    }
  },

  /**
   * Update an existing task-variant for a given task.
   *
   * Delegates to TaskService for authorization and business logic.
   * Requires super admin privileges. All fields in the request body are optional -
   * only provided fields will be updated. When parameters are provided, they replace
   * all existing parameters (not merged).
   *
   * @param authContext - User's authentication context (requires super admin)
   * @param params - Object containing taskId and variantId path parameters
   * @param body - Request body with optional fields to update (name, description, status, parameters)
   * @returns Response with status 204 No Content on success
   *
   * @see {@link UpdateTaskVariantRequestBody} - Schema for updating a task variant
   */
  updateTaskVariant: async (
    authContext: AuthContext,
    params: { taskId: string; variantId: string },
    body: UpdateTaskVariantRequestBody,
  ) => {
    try {
      await taskService.updateTaskVariant(authContext, params, body);
      return {
        status: StatusCodes.NO_CONTENT as const,
        body: undefined,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.CONFLICT,
          StatusCodes.INTERNAL_SERVER_ERROR,
          StatusCodes.BAD_REQUEST,
        ]);
      }
      throw error;
    }
  },
};
