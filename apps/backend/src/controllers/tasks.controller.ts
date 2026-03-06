import type { AuthContext } from '../types/auth-context';
import type { CreateTaskVariantRequestBody, UpdateTaskVariantRequestBody } from '@roar-dashboard/api-contract';
import { StatusCodes } from 'http-status-codes';
import { TaskService } from '../services/task/task.service';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';

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
   * Create a new task-variant for a given task id.
   *
   * Delegates to TaskService for authorization and business logic.
   *
   * @param authContext - User's authentication context.
   * @param taskId - Path parameter containing the task ID
   * @param body - Request body with variant details
   * @returns An object containing the newly created task variant's UUID.
   *
   * @see {@link CreateTaskVariantRequestBody} - Parameters for creating a new task variant.
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
   * Update an existing task-variant for a given task id.
   *
   * Delegates to TaskService for authorization and business logic.
   * All fields in the request are optional - only provided fields will be updated.
   *
   * @param authContext - User's authentication context.
   * @param data - Parameters for TaskVariantUpdateRequest interface
   * @returns 204 No Content on success.
   *
   * @see {@link UpdateTaskVariantRequest} - Parameters for updating a task variant.
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
