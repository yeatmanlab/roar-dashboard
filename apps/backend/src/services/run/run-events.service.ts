import { StatusCodes } from 'http-status-codes';
import type { RunEventBody } from '@roar-dashboard/api-contract';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { RunsRepository } from '../../repositories/runs.repository';
import { runTrials, runTrialInteractions } from '../../db/schema/assessment';

interface AuthContext {
  userId: string;
  isSuperAdmin: boolean;
}

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((run as any).userId !== userId) {
      throw new ApiError('Forbidden', {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { runId, userId },
      });
    }

    return run;
  }

  /**
   * Records a trial event for a run.
   *
   * Validates the event type, verifies user ownership, and persists trial data
   * along with optional interaction events in a transaction. Converts boolean
   * correctness to integer format for storage.
   *
   * @param authContext - Authentication context with userId and isSuperAdmin
   * @param runId - UUID of the run to record the trial for
   * @param body - Event body containing trial data and optional interactions
   * @throws ApiError with BAD_REQUEST (400) if event type is invalid
   * @throws ApiError with BAD_REQUEST (400) if trial payload is malformed
   * @throws ApiError with NOT_FOUND (404) if run doesn't exist
   * @throws ApiError with FORBIDDEN (403) if user doesn't own the run
   * @throws ApiError with INTERNAL_SERVER_ERROR (500) if database transaction fails
   */
  async function writeTrial(authContext: AuthContext, runId: string, body: RunEventBody): Promise<void> {
    if (body.type !== 'trial') {
      throw new ApiError('Invalid event type', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        context: { runId, type: (body as any).type },
      });
    }

    await assertRunOwnedByUser(runId, authContext.userId);

    // Defense-in-depth (contract already checks required fields)
    if (!body.trial?.assessment_stage || typeof body.trial.correct !== 'boolean') {
      throw new ApiError('Malformed trial payload', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { runId },
      });
    }

    const now = new Date();
    const correctInt = body.trial.correct ? 1 : 0;

    await runsRepository.runTransaction({
      fn: async (tx) => {
        const [createdTrial] = await tx
          .insert(runTrials)
          .values({
            runId,
            assessmentStage: body.trial.assessment_stage,
            correct: correctInt,
            createdAt: now,
            updatedAt: now,
            payload: body.trial,
          })
          .returning({ id: runTrials.id });

        const trialId = createdTrial.id;

        // This part is optional
        if (body.interactions && body.interactions.length > 0) {
          const rows = body.interactions.map((i) => ({
            runId,
            trialId,
            event: i.event,
            trialIndex: i.trial_id ?? null,
            timeMs: i.time_ms,
            createdAt: now,
          }));

          await tx.insert(runTrialInteractions).values(rows);
        }
      },
    });
  }

  /**
   * Marks a run as aborted.
   *
   * Validates the event type, verifies user ownership, and updates the run's
   * abort status with an optional reason. Currently only supports 'abort' event type.
   *
   * @param authContext - Authentication context with userId and isSuperAdmin
   * @param runId - UUID of the run to abort
   * @param body - Event body containing type and optional reason
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        context: { runId, type: (body as any).type },
      });
    }
    await assertRunOwnedByUser(runId, authContext.userId);

    const now = new Date();

    await runsRepository.update({
      id: runId,
      data: {
        updatedAt: now,
        abortReason: body.reason ?? null,
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
    // type="complete"
    if (body.type !== 'complete') {
      throw new ApiError('Invalid event type', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        context: { runId, type: (body as any).type },
      });
    }

    await assertRunOwnedByUser(runId, authContext.userId);

    const now = new Date();

    await runsRepository.update({
      id: runId,
      data: {
        completedAt: now,
        updatedAt: now,
        ...(body.metadata ? { completionMetadata: body.metadata } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  }

  return { completeRun, abortRun, writeTrial };
}
