import type { AuthContext } from '../types/auth-context';
import type { CreateTaskVariantData, UpdateTaskVariantData } from '../services/task/task.service';
import type { TasksListQuery, Task as ContractTask } from '@roar-dashboard/api-contract';
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
    createdAt: task.createdAt.toISOString(),
    updatedAt: (task.updatedAt ?? task.createdAt).toISOString(),
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
        return toErrorResponse(error, [StatusCodes.INTERNAL_SERVER_ERROR]);
      }
      throw error;
    }
  },

  /**
   * Create a new task-variant for a given task id.
   *
   * Delegates to TaskService for authoirzation and business logic.
   *
   * @param authContext - User's authentication context.
   * @param data - Parameters for CreateTaskVariantData interface
   * @returns An object containing the newly created task variant's UUID.
   *
   * @see {@link CreateTaskVariantData} - Parameters for creating a new task variant.
   */
  createTaskVariant: async (authContext: AuthContext, data: CreateTaskVariantData) => {
    try {
      const id = await taskService.createTaskVariant(authContext, data);
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
   * Update an existing task-variant for a given task id.
   *
   * Delegates to TaskService for authorization and business logic.
   * All fields in the request are optional - only provided fields will be updated.
   *
   * @param authContext - User's authentication context.
   * @param data - Parameters for UpdateTaskVariantData interface
   * @returns An object indicating success.
   *
   * @see {@link UpdateTaskVariantData} - Parameters for updating a task variant.
   */
  updateTaskVariant: async (authContext: AuthContext, data: UpdateTaskVariantData) => {
    try {
      const result = await taskService.updateTaskVariant(authContext, data);
      return {
        status: StatusCodes.OK as const,
        body: {
          data: result,
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
};
