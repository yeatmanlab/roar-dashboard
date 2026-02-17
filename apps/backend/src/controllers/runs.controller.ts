import { StatusCodes } from 'http-status-codes';
import type { CreateRunRequestBody } from '@roar-dashboard/api-contract';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import { RunService } from '../services/run/run.service';
import { RunEventsService } from '../services/run/run-events.service';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import type { AuthContext } from '../types/auth-context';

const runService = RunService();
const runEventsService = RunEventsService();

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
  create: async (authContext: AuthContext, body: CreateRunRequestBody) => {
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
          StatusCodes.UNPROCESSABLE_ENTITY,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },
  event: async (authContext: AuthContext, runId: string, body: RunEventBody) => {
    try {
      if (body.type === 'complete') {
        await runEventsService.completeRun(authContext, runId, body);
      } else if (body.type === 'abort') {
        await runEventsService.abortRun(authContext, runId, body);
      } else if (body.type === 'trial') {
        await runEventsService.writeTrial(authContext, runId, body);
      } else {
        // Should never happen due to contract validation, but defense-in-depth:
        throw new ApiError('Invalid event type', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          context: { runId, type: (body as any).type },
        });
      }

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
