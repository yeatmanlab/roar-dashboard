import { StatusCodes } from 'http-status-codes';
import type { CreateRunRequestBody, RunEventBody } from '@roar-dashboard/api-contract';
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
   *
   * @param authContext - Authentication context with userId and isSuperAdmin
   * @param body - Request body with task_variant_id, task_version, administration_id, and optional metadata
   * @returns Response with status 201 and run_id on success, or error response on failure
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
  /**
   * Handle a run event (complete).
   *
   * Marks a run as complete with optional metadata.
   *
   * @param authContext - Authentication context with userId and isSuperAdmin
   * @param runId - UUID of the run to post the event to
   * @param body - Event body with type 'complete' and optional metadata
   * @returns Response with status 200 and { status: 'ok' } on success, or error response on failure
   */
  event: async (authContext: AuthContext, runId: string, body: RunEventBody) => {
    try {
      const eventType = (body as { type?: unknown }).type;
      if (eventType === 'complete') {
        await runEventsService.completeRun(authContext, runId, body);
      } else if (eventType === 'abort') {
        await runEventsService.abortRun(authContext, runId, body);
      } else {
        // Should never happen due to contract validation, but defense-in-depth:
        throw new ApiError('Invalid event type', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          context: { runId, type: eventType },
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
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },
};
