import { StatusCodes } from 'http-status-codes';
import type { RunEventBody } from '@roar-dashboard/api-contract';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { logger } from '../../logger';
import { RunsRepository } from '../../repositories/runs.repository';
import { RunTrialsRepository } from '../../repositories/run-trials.repository';
import { RunTrialInteractionsRepository } from '../../repositories/run-trial-interactions.repository';
import type { AuthContext } from '../../types/auth-context';
import { runEventTypeEnum } from '@roar-dashboard/api-contract';

const RunEventType = runEventTypeEnum.enum;

/**
 * RunEventsService
 *
 * Handles business logic for run events.
 * Manages authorization checks and updates to run state.
 *
 * @param runsRepository - Repository for accessing run data (injected for testing)
 * @param runTrialsRepository - Repository for accessing run trials (injected for testing)
 * @param runTrialInteractionsRepository - Repository for accessing run trial interactions (injected for testing)
 * @returns Object with event handling methods
 */
export function RunEventsService({
  runsRepository = new RunsRepository(),
  runTrialsRepository = new RunTrialsRepository(),
  runTrialInteractionsRepository = new RunTrialInteractionsRepository(),
}: {
  runsRepository?: RunsRepository;
  runTrialsRepository?: RunTrialsRepository;
  runTrialInteractionsRepository?: RunTrialInteractionsRepository;
} = {}): {
  completeRun: (authContext: AuthContext, runId: string, body: RunEventBody) => Promise<void>;
  abortRun: (authContext: AuthContext, runId: string, body: RunEventBody) => Promise<void>;
  writeTrial: (authContext: AuthContext, runId: string, body: RunEventBody) => Promise<void>;
  updateEngagement: (authContext: AuthContext, runId: string, body: RunEventBody) => Promise<void>;
} {
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
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { runId, userId },
      });
    }

    return run;
  }

  /**
   * Updates engagement flags and reliability status for a run.
   *
   * Validates the event type, verifies user ownership, and updates the run record.
   *
   * @throws ApiError with BAD_REQUEST (400) if event type is invalid
   * @throws ApiError bubbled from assertRunOwnedByUser (e.g., NOT_FOUND / FORBIDDEN) if ownership/run checks fail
   * @throws ApiError with INTERNAL_SERVER_ERROR (500) if database update fails
   */
  async function updateEngagement(authContext: AuthContext, runId: string, body: RunEventBody): Promise<void> {
    if (body.type !== RunEventType.engagement) {
      throw new ApiError('Invalid event type', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { runId, type: body.type },
      });
    }

    try {
      await assertRunOwnedByUser(runId, authContext.userId);

      await runsRepository.update({
        id: runId,
        data: {
          engagementFlags: body.engagementFlags,
          reliableRun: body.reliableRun,
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
        'Failed to update engagement',
      );

      throw new ApiError('Failed to update engagement', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId: authContext.userId, runId },
        cause: error,
      });
    }
  }

  /**
   * Records a trial event for a run.
   *
   * Validates the event type, verifies user ownership, and persists trial data
   * along with optional interaction events in a transaction.
   *
   * @throws ApiError with BAD_REQUEST (400) if event type is invalid
   * @throws ApiError with BAD_REQUEST (400) if trial payload is malformed
   * @throws ApiError bubbled from assertRunOwnedByUser (e.g., NOT_FOUND / FORBIDDEN) if run ownership checks fail
   * @throws ApiError with INTERNAL_SERVER_ERROR (500) if database transaction fails or any unexpected error occurs
   */
  async function writeTrial(authContext: AuthContext, runId: string, body: RunEventBody): Promise<void> {
    if (body.type !== RunEventType.trial) {
      throw new ApiError('Invalid event type', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { runId, type: body.type },
      });
    }

    try {
      await assertRunOwnedByUser(runId, authContext.userId);

      if (!body.trial?.assessmentStage || typeof body.trial.correct !== 'number') {
        throw new ApiError('Malformed trial payload', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          context: { runId },
        });
      }

      await runTrialsRepository.runTransaction({
        fn: async (tx) => {
          const createdTrial = await runTrialsRepository.create({
            data: {
              runId,
              assessmentStage: body.trial.assessmentStage,
              correct: body.trial.correct,
              metadata: body.trial,
            },
            transaction: tx,
          });

          // This part is optional
          if (body.interactions && body.interactions.length > 0) {
            const interactionPromises = body.interactions.map((i) =>
              runTrialInteractionsRepository.create({
                data: {
                  trialId: createdTrial.id,
                  interactionType: i.event,
                  timeMs: i.timeMs,
                },
                transaction: tx,
              }),
            );

            await Promise.all(interactionPromises);
          }
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
        'Failed to write trial',
      );

      throw new ApiError('Failed to write trial', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId: authContext.userId, runId },
        cause: error,
      });
    }
  }

  /**
   * Marks a run as aborted.
   *
   * Validates the event type, verifies user ownership, and updates the run's
   * abort status with the provided abort timestamp. Currently only supports 'abort' event type.
   *
   * @param authContext - Authentication context with userId and isSuperAdmin
   * @param runId - UUID of the run to abort
   * @throws ApiError with BAD_REQUEST (400) if event type is invalid
   * @throws ApiError with NOT_FOUND (404) if run doesn't exist
   * @throws ApiError with FORBIDDEN (403) if user doesn't own the run
   * @throws ApiError with INTERNAL_SERVER_ERROR (500) if database update fails
   */
  async function abortRun(authContext: AuthContext, runId: string, body: RunEventBody): Promise<void> {
    if (body.type !== RunEventType.abort) {
      throw new ApiError('Invalid event type', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { runId, type: body.type },
      });
    }

    try {
      await assertRunOwnedByUser(runId, authContext.userId);
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
        'Failed to abort run',
      );

      throw new ApiError('Failed to abort run', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId: authContext.userId, runId },
        cause: error,
      });
    }
  }

  /**
   * Marks a run as complete.
   *
   * Validates the event type, verifies user ownership, and updates the run's
   * completion timestamp. Currently only supports 'complete' event type.
   *
   * @throws ApiError with BAD_REQUEST (400) if event type is invalid
   * @throws ApiError bubbled from assertRunOwnedByUser (e.g., NOT_FOUND / FORBIDDEN) if run ownership checks fail
   * @throws ApiError with INTERNAL_SERVER_ERROR (500) if database update fails or any unexpected error occurs
   */
  async function completeRun(authContext: AuthContext, runId: string, body: RunEventBody): Promise<void> {
    if (body.type !== RunEventType.complete) {
      throw new ApiError('Invalid event type', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { runId, type: body.type },
      });
    }

    try {
      await assertRunOwnedByUser(runId, authContext.userId);

      await runsRepository.update({
        id: runId,
        data: {
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

  return { completeRun, abortRun, writeTrial, updateEngagement };
}
