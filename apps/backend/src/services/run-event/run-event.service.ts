import { StatusCodes } from 'http-status-codes';
import type { RunEventBody } from '@roar-dashboard/api-contract';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { logger } from '../../logger';
import { RunRepository } from '../../repositories/run.repository';
import { RunTrialsRepository } from '../../repositories/run-trials.repository';
import { RunTrialInteractionsRepository } from '../../repositories/run-trial-interactions.repository';
import { FamilyRepository } from '../../repositories/family.repository';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import type { AuthContext } from '../../types/auth-context';

type RunCompleteEventBody = Extract<RunEventBody, { type: 'complete' }>;
type RunAbortEventBody = Extract<RunEventBody, { type: 'abort' }>;
type RunTrialEventBody = Extract<RunEventBody, { type: 'trial' }>;
type RunEngagementEventBody = Extract<RunEventBody, { type: 'engagement' }>;

/**
 * RunEventService
 *
 * Handles business logic for run events.
 * Manages authorization checks and updates to run state.
 *
 * @param runRepository - Repository for accessing run data (injected for testing)
 * @param runTrialsRepository - Repository for accessing run trials (injected for testing)
 * @param runTrialInteractionsRepository - Repository for accessing run trial interactions (injected for testing)
 * @param familyRepository - Repository for accessing family relationships (injected for testing)
 * @param authorizationService - FGA authorization service (injected for testing)
 * @returns Object with event handling methods
 */
export function RunEventService({
  runRepository = new RunRepository(),
  runTrialsRepository = new RunTrialsRepository(),
  runTrialInteractionsRepository = new RunTrialInteractionsRepository(),
  familyRepository = new FamilyRepository(),
  authorizationService = AuthorizationService(),
}: {
  runRepository?: RunRepository;
  runTrialsRepository?: RunTrialsRepository;
  runTrialInteractionsRepository?: RunTrialInteractionsRepository;
  familyRepository?: FamilyRepository;
  authorizationService?: ReturnType<typeof AuthorizationService>;
} = {}) {
  /**
   * Verify that the authenticated user owns the target user (strict ownership).
   *
   * Run events are user-initiated actions, not admin operations. This enforces strict
   * ownership: only the run owner can post events to their own runs. Even super admins
   * cannot post events on behalf of other users.
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param targetUserId - The user ID to verify access for
   * @throws {ApiError} FORBIDDEN if user is not the run owner
   */
  async function verifyUserAccess(authContext: AuthContext, targetUserId: string): Promise<void> {
    const { userId: requesterUserId } = authContext;

    if (requesterUserId === targetUserId) {
      // User owns the run — allow access
      return;
    }

    // Requester is posting an event for a different user (e.g., parent posting for child).
    // Check if requester has can_create_run_for_child permission on any family containing the target user.
    const targetFamilyIds = await familyRepository.getFamilyIdsForUser(targetUserId);
    const familyObjects = targetFamilyIds.map((id) => `${FgaType.FAMILY}:${id}`);
    const hasAccess = await authorizationService.hasAnyPermission(
      requesterUserId,
      FgaRelation.CAN_CREATE_RUN_FOR_CHILD,
      familyObjects,
    );

    if (!hasAccess) {
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { requesterUserId, targetUserId },
      });
    }
  }

  /**
   * Verifies that a run exists and is owned by the specified user.
   *
   * Ownership is strict — run events are personal session actions tied to the participant's assessment session.
   * This intentionally deviates from the standard super admin bypass pattern.
   *
   * @param runId - UUID of the run to verify
   * @param targetUserId - User ID from the path parameter (the owner of the run)
   * @returns The run object if verification succeeds
   * @throws ApiError with NOT_FOUND (404) if run doesn't exist
   * @throws ApiError with FORBIDDEN (403) if user doesn't own the run
   */
  async function assertRunOwnedByUser(runId: string, targetUserId: string) {
    const run = await runRepository.getById({ id: runId });

    if (!run) {
      throw new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { runId, targetUserId },
      });
    }

    if (run.userId !== targetUserId) {
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { runId, targetUserId },
      });
    }

    return run;
  }

  /**
   * Updates engagement flags and reliability status for a run.
   *
   * Verifies user ownership, and updates the run record.
   *
   * @note Not idempotent — each call creates a separate update; repeated calls do not deduplicate.
   * @throws ApiError bubbled from assertRunOwnedByUser (e.g., NOT_FOUND / FORBIDDEN) if ownership/run checks fail
   * @throws ApiError with INTERNAL_SERVER_ERROR (500) if database update fails
   */
  async function updateEngagement(
    authContext: AuthContext,
    targetUserId: string,
    runId: string,
    body: RunEngagementEventBody,
  ): Promise<void> {
    await verifyUserAccess(authContext, targetUserId);
    await assertRunOwnedByUser(runId, targetUserId);

    try {
      await runRepository.update({
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
            event: body,
          },
        },
        'Failed to update engagement',
      );

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
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
   * Verifies user ownership, and persists trial data
   * along with optional interaction events in a transaction.
   *
   * @throws ApiError bubbled from assertRunOwnedByUser (e.g., NOT_FOUND / FORBIDDEN) if run ownership checks fail
   * @throws ApiError with INTERNAL_SERVER_ERROR (500) if database transaction fails or any unexpected error occurs
   */
  async function writeTrial(
    authContext: AuthContext,
    targetUserId: string,
    runId: string,
    body: RunTrialEventBody,
  ): Promise<void> {
    await verifyUserAccess(authContext, targetUserId);
    await assertRunOwnedByUser(runId, targetUserId);

    try {
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

          if (body.interactions && body.interactions.length > 0) {
            await Promise.all(
              body.interactions.map((i) =>
                runTrialInteractionsRepository.create({
                  data: {
                    trialId: createdTrial.id,
                    interactionType: i.event,
                    timeMs: i.timeMs,
                  },
                  transaction: tx,
                }),
              ),
            );
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
            event: body,
          },
        },
        'Failed to write trial',
      );

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
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
   * Verifies user ownership and that the run is not already in a terminal state,
   * then updates the run's abort status.
   *
   * @throws ApiError with CONFLICT (409) if the run is already completed or aborted
   * @throws ApiError bubbled from assertRunOwnedByUser (e.g., NOT_FOUND / FORBIDDEN) if run ownership checks fail
   * @throws ApiError with INTERNAL_SERVER_ERROR (500) if database update fails or any unexpected error occurs
   */
  async function abortRun(
    authContext: AuthContext,
    targetUserId: string,
    runId: string,
    body: RunAbortEventBody,
  ): Promise<void> {
    await verifyUserAccess(authContext, targetUserId);
    const run = await assertRunOwnedByUser(runId, targetUserId);

    if (run.completedAt || run.abortedAt) {
      throw new ApiError(ApiErrorMessage.CONFLICT, {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
        context: { runId, userId: authContext.userId },
      });
    }

    try {
      await runRepository.update({
        id: runId,
        data: {
          abortedAt: new Date(),
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
            event: body,
          },
        },
        'Failed to abort run',
      );

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
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
   * Verifies user ownership and that the run is not already in a terminal state,
   * then updates the run's completion timestamp.
   *
   * @throws ApiError with CONFLICT (409) if the run is already completed or aborted
   * @throws ApiError bubbled from assertRunOwnedByUser (e.g., NOT_FOUND / FORBIDDEN) if run ownership checks fail
   * @throws ApiError with INTERNAL_SERVER_ERROR (500) if database update fails or any unexpected error occurs
   */
  async function completeRun(
    authContext: AuthContext,
    targetUserId: string,
    runId: string,
    body: RunCompleteEventBody,
  ): Promise<void> {
    await verifyUserAccess(authContext, targetUserId);
    const run = await assertRunOwnedByUser(runId, targetUserId);

    if (run.completedAt || run.abortedAt) {
      throw new ApiError(ApiErrorMessage.CONFLICT, {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
        context: { runId, userId: authContext.userId },
      });
    }

    try {
      await runRepository.update({
        id: runId,
        data: {
          completedAt: new Date(),
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
            event: body,
          },
        },
        'Failed to complete run',
      );

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId: authContext.userId, runId },
        cause: error,
      });
    }
  }

  return { completeRun, abortRun, writeTrial, updateEngagement };
}
