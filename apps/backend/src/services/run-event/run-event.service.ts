import { StatusCodes } from 'http-status-codes';
import { getTableColumns } from 'drizzle-orm';
import type { RunEventBody } from '@roar-platform/api-contract';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { logger } from '../../logger';
import { RunRepository } from '../../repositories/run.repository';
import { RunTrialsRepository } from '../../repositories/run-trials.repository';
import { RunTrialInteractionsRepository } from '../../repositories/run-trial-interactions.repository';
import { RunScoresRepository } from '../../repositories/run-scores.repository';
import { FamilyRepository } from '../../repositories/family.repository';
import { RunService } from '../run/run.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaRelation } from '../authorization/fga-constants';
import { verifyTargetUserAccess } from '../authorization/verify-target-user-access';
import type { AuthContext } from '../../types/auth-context';
import { runTrials } from '../../db/schema';
import type { NewRunScore } from '../../db/schema';
import { camelizeKeys } from '../../utils/camelize-keys.util';
import { sanitizeJsonbMaxValues } from '../../utils/sanitize-jsonb.util';

const TRIAL_COLUMN_KEYS = new Set(Object.keys(getTableColumns(runTrials)));
const EXCLUDED_TRIAL_FIELDS = new Set<string>(['id', 'runId', 'createdAt', 'updatedAt']);

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
 * @param runScoresRepository - Repository for upserting run scores (injected for testing)
 * @param runService - Service for run-level operations such as recomputing use_for_reporting (injected for testing)
 * @param familyRepository - Repository for accessing family relationships (injected for testing)
 * @param authorizationService - FGA authorization service (injected for testing)
 * @returns Object with event handling methods
 */
export function RunEventService({
  runRepository = new RunRepository(),
  runTrialsRepository = new RunTrialsRepository(),
  runTrialInteractionsRepository = new RunTrialInteractionsRepository(),
  runScoresRepository = new RunScoresRepository(),
  runService = RunService(),
  familyRepository = new FamilyRepository(),
  authorizationService = AuthorizationService(),
}: {
  runRepository?: RunRepository;
  runTrialsRepository?: RunTrialsRepository;
  runTrialInteractionsRepository?: RunTrialInteractionsRepository;
  runScoresRepository?: RunScoresRepository;
  runService?: ReturnType<typeof RunService>;
  familyRepository?: FamilyRepository;
  authorizationService?: ReturnType<typeof AuthorizationService>;
} = {}) {
  /**
   * Verifies that the authenticated user has access to post events for the target user's run.
   *
   * Allows:
   * 1. Users posting events to their own runs
   * 2. Super admins posting events for any user
   * 3. Parents/guardians posting events for their children (via CAN_CREATE_RUN_FOR_CHILD permission)
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param targetUserId - The user ID who owns the run
   * @throws {ApiError} FORBIDDEN if user lacks permission
   */
  async function verifyUserAccess(authContext: AuthContext, targetUserId: string): Promise<void> {
    await verifyTargetUserAccess(
      authContext,
      targetUserId,
      FgaRelation.CAN_CREATE_RUN_FOR_CHILD,
      familyRepository,
      authorizationService,
    );
  }

  /**
   * Verifies that a run exists and is owned by the specified user.
   *
   * Note: Authorization is checked separately in `verifyUserAccess`. This function only verifies
   * the run exists and belongs to the target user (not the requester). Super admins and parents
   * with CAN_CREATE_RUN_FOR_CHILD permission can post events for other users' runs.
   *
   * @param runId - UUID of the run to verify
   * @param targetUserId - User ID from the path parameter (the owner of the run)
   * @returns The run object if verification succeeds
   * @throws ApiError with NOT_FOUND (404) if run doesn't exist
   * @throws ApiError with FORBIDDEN (403) if run doesn't belong to target user
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
   * Verifies user ownership, and persists trial data along with optional interaction events
   * and optional run-level score snapshots in a single transaction. If `body.scores` is
   * provided, each entry is upserted into `run_scores` keyed on
   * `(run_id, type, domain, name, assessment_stage)` — the natural key — so that re-sending
   * the same score for the same trial replaces the previous value rather than inserting a
   * duplicate. Empty/missing `scores` is a no-op.
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
    const run = await assertRunOwnedByUser(runId, targetUserId);

    const runTrialFields: Record<string, unknown> = {};
    const metadata: Record<string, unknown> = {};

    // Normalize trial keys to camelCase. skipAliases drops snake_case keys when their
    // camelCase equivalent is present — the SDK-normalized value takes priority.
    // Schema-matching keys go to runTrialFields; everything else lands in metadata.
    const normalizedTrial = camelizeKeys(body.trial, { skipAliases: true });
    for (const [camelKey, value] of Object.entries(normalizedTrial)) {
      if (TRIAL_COLUMN_KEYS.has(camelKey) && !EXCLUDED_TRIAL_FIELDS.has(camelKey)) {
        runTrialFields[camelKey] = value;
      } else {
        metadata[camelKey] = sanitizeJsonbMaxValues(value);
      }
    }

    try {
      await runTrialsRepository.runTransaction({
        fn: async (tx) => {
          const createdTrial = await runTrialsRepository.create({
            data: {
              ...runTrialFields,
              runId,
              metadata,
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

          if (body.scores && body.scores.length > 0) {
            const scoreRows: NewRunScore[] = body.scores.map((s) => ({
              runId,
              type: s.type,
              domain: s.domain,
              name: s.name,
              value: s.value,
              assessmentStage: s.assessmentStage ?? null,
              categoryScore: s.categoryScore ?? null,
            }));

            await runScoresRepository.upsertMany({
              data: scoreRows,
              transaction: tx,
            });
          }

          // Last step of the transaction so the recompute sees this trial's score writes.
          // Anonymous runs short-circuit inside RunService.recomputeBestRunForVariant.
          await runService.recomputeBestRunForVariant({
            userId: run.userId,
            administrationId: run.administrationId,
            taskVariantId: run.taskVariantId,
            transaction: tx,
          });
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
