import { StatusCodes } from 'http-status-codes';
import type { StartRunRequestBody } from '@roar-dashboard/api-contract';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import { RunService } from '../services/run/run.service';

const runService = RunService();

interface AuthContext {
  userId: string;
  isSuperAdmin: boolean;
}

/**
 * RunsController
 *
 * Handles HTTP concerns for the /runs endpoint.
 * Delegates business logic and authorization to RunService.
 * Maps ApiError status codes to typed error responses via toErrorResponse.
 */
export const RunsController = {
  /**
   * Create a new run (assessment session instance).
   */
  create: async (authContext: AuthContext, body: StartRunRequestBody) => {
    try {
      const { runId } = await runService.create(authContext, body);

      return {
        status: StatusCodes.CREATED as const,
        body: {
          data: { run_id: runId },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.UNAUTHORIZED,
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },
};
