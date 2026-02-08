import { StatusCodes } from 'http-status-codes';
import type { RunEventBody, StartRunRequestBody } from '@roar-dashboard/api-contract';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import { RunService } from '../services/run/run.service';
import { RunEventsService } from '../services/run/run-events.service';

const runService = RunService();
const runEventsService = RunEventsService();

interface AuthContext {
  userId: string;
  isSuperAdmin: boolean;
}

/**
 * RunsController
 *
 * Handles HTTP concerns for the /runs endpoint and /runs/:runId/event endpoints.
 * Delegates business logic and authorization to RunService and RunEventsService.
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
  event: async (authContext: AuthContext, runId: string, body: RunEventBody) => {
    try {
      await runEventsService.completeRun(authContext, runId, body);

      return {
        status: StatusCodes.OK as const,
        body: { data: { status: 'ok' as const } },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.UNAUTHORIZED,
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
        ]);
      }
      throw error;
    }
  },
};
