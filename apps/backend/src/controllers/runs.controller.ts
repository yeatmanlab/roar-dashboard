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
   * Handle a run event (complete, abort, trial, or engagement).
   *
   * Routes the event to the appropriate RunEventsService method based on event type.
   * Supports four event types:
   * - complete: Mark run as complete with optional metadata
   * - abort: Mark run as aborted with optional reason
   * - trial: Record a trial event with optional interactions
   * - engagement: Update engagement flags and reliability status
   *
   * @param authContext - Authentication context with userId and isSuperAdmin
   * @param runId - UUID of the run to post the event to
   * @param body - Event body with type and type-specific fields
   * @returns Response with status 200 and { status: 'ok' } on success, or error response on failure
   */
  event: async (authContext: AuthContext, runId: string, body: RunEventBody) => {
    try {
      if (body.type === 'complete') {
        await runEventsService.completeRun(authContext, runId, body);
      } else if (body.type === 'abort') {
        await runEventsService.abortRun(authContext, runId, body);
      } else if (body.type === 'trial') {
        await runEventsService.writeTrial(authContext, runId, body);
      } else if (body.type === 'engagement') {
        await runEventsService.updateEngagement(authContext, runId, body);
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
