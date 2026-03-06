import type { AuthContext } from '../types/auth-context';
import type { CreateTaskVariantData, UpdateTaskVariantData } from '../services/task/task.service';
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
