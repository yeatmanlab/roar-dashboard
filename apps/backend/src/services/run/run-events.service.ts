import { StatusCodes } from 'http-status-codes';
import type { RunEventBody } from '@roar-dashboard/api-contract';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { logger } from '../../logger';
import { RunsRepository } from '../../repositories/runs.repository';
import type { AuthContext } from '../../types/auth-context';

/**
 * RunEventsService
 *
 * Handles business logic for run events.
 * Manages authorization checks and updates to run state.
 *
 * @param runsRepository - Repository for accessing run data (injected for testing)
 * @returns Object with event handling methods
 */
export function RunEventsService({
  runsRepository = new RunsRepository(),
}: {
  runsRepository?: RunsRepository;
} = {}) {
  /**
   * Verifies that a run exists and is owned by the specified user.
   *
   * @param runId - UUID of the run to verify
   * @param userId - User ID to check ownership against
   * @returns The run object if verification succeeds
   * @throws ApiError with NOT_FOUND (404) if run doesn't exist
   * @throws ApiError with FORBIDDEN (403) if user doesn't own the run
   */
  async function assertRunOwnedByUser(runId: string, userId: string) {
    const run = await runsRepository.getById({ id: runId });

    if (!run) {
      throw new ApiError('Run not found', {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { runId, userId },
      });
    }

    if (run.userId !== userId) {
      throw new ApiError('Forbidden', {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { runId, userId },
      });
    }

    return run;
  }

  /**
   * Marks a run as aborted.
   *
   * Validates the event type, verifies user ownership, and updates the run's
   * abort status with the provided abort timestamp. Currently only supports 'abort' event type.
   *
   * @param authContext - Authentication context with userId and isSuperAdmin
   * @param runId - UUID of the run to abort
   * @param body - Event body containing type and abortedAt timestamp
   * @throws ApiError with BAD_REQUEST (400) if event type is invalid
   * @throws ApiError with NOT_FOUND (404) if run doesn't exist
   * @throws ApiError with FORBIDDEN (403) if user doesn't own the run
   * @throws ApiError with INTERNAL_SERVER_ERROR (500) if database update fails
   */
  async function abortRun(authContext: AuthContext, runId: string, body: RunEventBody): Promise<void> {
    if (body.type !== 'abort') {
      throw new ApiError('Invalid event type', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { runId, type: body.type },
      });
    }
    await assertRunOwnedByUser(runId, authContext.userId);

    await runsRepository.update({
      id: runId,
      data: {
        abortedAt: body.abortedAt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  }

  /**
   * Marks a run as complete.
   *
   * Validates the event type, verifies user ownership, and updates the run's
   * completion timestamp. Currently only supports 'complete' event type.
   *
   * @param authContext - Authentication context with userId and isSuperAdmin
   * @param runId - UUID of the run to complete
   * @param body - Event body containing type and optional metadata
   * @throws ApiError with BAD_REQUEST (400) if event type is invalid
   * @throws ApiError with NOT_FOUND (404) if run doesn't exist
   * @throws ApiError with FORBIDDEN (403) if user doesn't own the run
   * @throws ApiError with INTERNAL_SERVER_ERROR (500) if database update fails
   */
  async function completeRun(authContext: AuthContext, runId: string, body: RunEventBody): Promise<void> {
    if (body.type !== 'complete') {
      throw new ApiError('Invalid event type', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { runId, type: body.type },
      });
    }

    try {
      await assertRunOwnedByUser(runId, authContext.userId);

      const now = new Date();

      await runsRepository.update({
        id: runId,
        data: {
          completedAt: now,
          ...(body.metadata ? { metadata: body.metadata } : {}),
        },
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        {
          err: error,
          context: {
            userId: authContext.userId,
            runId,
            eventType: body.type,
          },
        },
        'Failed to complete run',
      );

      throw new ApiError('Failed to complete run', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId: authContext.userId, runId },
        cause: error,
      });
    }
  }

  return { completeRun, abortRun };
}
