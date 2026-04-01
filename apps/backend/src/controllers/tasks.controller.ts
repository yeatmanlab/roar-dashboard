import type { AuthContext } from '../types/auth-context';
import type {
  ListTaskVariantsQuery,
  CreateTaskVariantRequestBody,
  UpdateTaskVariantRequestBody,
  TasksListQuery,
  Task as ContractTask,
  TaskVariant as ContractTaskVariant,
  Json,
  CreateTaskRequestBody,
} from '@roar-dashboard/api-contract';
import type { Task, TaskVariant } from '../db/schema';
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

/**
 * Maps a database TaskVariant entity to the API schema (without task/parameter fields).
 * Converts Date fields to ISO strings.
 * Task fields (taskName, taskSlug, taskImage) and parameters are added separately by the controller.
 *
 * @param variant - The database TaskVariant entity
 * @returns The API-formatted task variant object without task fields or parameters
 */
function transformTaskVariant(
  variant: TaskVariant,
): Omit<ContractTaskVariant, 'taskName' | 'taskSlug' | 'taskImage' | 'parameters'> {
  return {
    id: variant.id,
    taskId: variant.taskId,
    name: variant.name,
    description: variant.description,
    status: variant.status,
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt?.toISOString() ?? null,
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
   * Get a single task by its ID.
   *
   * Delegates to TaskService for business logic.
   *
   * @param authContext - User's authentication context
   * @param taskId - The unique ID identifier for the task
   * @returns The task with the given ID
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
   * Create a new task.
   *
   * Delegates to TaskService for authorization and business logic.
   * Requires super admin privileges.
   *
   * @param authContext - User's authentication context (requires super admin)
   * @param body - Request body with task details (slug, name, nameSimple, nameTechnical, taskConfig, etc.)
   * @returns Response with status 201 and the newly created task's UUID
   */
  create: async (authContext: AuthContext, body: CreateTaskRequestBody) => {
    try {
      const result = await taskService.create(authContext, body);
      return {
        status: StatusCodes.CREATED as const,
        body: {
          data: result,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.FORBIDDEN,
          StatusCodes.CONFLICT,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * List variants for a given task.
   *
   * Delegates to TaskService for authorization and business logic.
   * Super admins see all variants; regular users see only published variants.
   *
   * @param authContext - User's authentication context
   * @param taskId - The UUID of the parent task
   * @param query - Query parameters for pagination, sorting, and searching
   * @returns Paginated list of task variants with task info
   */
  listTaskVariants: async (authContext: AuthContext, taskId: string, query: ListTaskVariantsQuery) => {
    try {
      const { page, perPage, sortBy, sortOrder, search, status } = query;
      const result = await taskService.listTaskVariants(authContext, taskId, {
        page,
        perPage,
        orderBy: { field: sortBy, direction: sortOrder },
        ...(search && { search }),
        ...(status && { status }),
      });

      const { task } = result;

      return {
        status: StatusCodes.OK as const,
        body: {
          data: {
            items: result.items.map((variant) => ({
              ...transformTaskVariant(variant),
              taskName: task.name,
              taskSlug: task.slug,
              taskImage: task.image,
              parameters: variant.parameters,
            })),
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
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.NOT_FOUND,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Get a task variant by ID
   *
   * Delegates to TaskService for authorization and business logic.
   * Super admins see all variants; regular users see only published variants.
   *
   * @param authContext - The user's authentication context
   * @param taskId  - The ID of the task; can be a task ID or a task slug
   * @param variantId - The ID of the task variant
   * @returns The requested task variant, if it exists
   */
  getTaskVariant: async (authContext: AuthContext, taskId: string, variantId: string) => {
    try {
      const result = await taskService.getTaskVariant(authContext, taskId, variantId);
      return {
        status: StatusCodes.OK as const,
        body: {
          data: {
            ...transformTaskVariant(result),
            taskName: result.task.name,
            taskSlug: result.task.slug,
            taskImage: result.task.image,
            parameters: result.parameters,
          },
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
