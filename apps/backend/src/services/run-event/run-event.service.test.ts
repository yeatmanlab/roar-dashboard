import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { RunEventService } from './run-event.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import type { AuthContext } from '../../types/auth-context';
import {
  MockRunRepository,
  createMockRunRepository,
  MockRunTrialRepository,
  createMockRunTrialRepository,
  MockRunTrialInteractionsRepository,
  createMockRunTrialInteractionsRepository,
  MockFamilyRepository,
  createMockFamilyRepository,
} from '../../test-support/repositories';
import type { MockAuthorizationService } from '../../test-support/services';
import { createMockAuthorizationService } from '../../test-support/services';
import { RunFactory } from '../../test-support/factories/run.factory';
import { FgaRelation } from '../authorization/fga-constants';

/**
 * RunEventService Tests
 *
 * Tests the business logic for handling run events.
 * Verifies authorization checks, error handling, and state updates.
 */
describe('RunEventService', () => {
  let authContext: AuthContext;
  let runRepository: MockRunRepository;
  let runTrialsRepository: MockRunTrialRepository;
  let runTrialInteractionsRepository: MockRunTrialInteractionsRepository;
  let familyRepository: MockFamilyRepository;
  let authorizationService: MockAuthorizationService;
  let runEventsService: ReturnType<typeof RunEventService>;

  beforeEach(() => {
    vi.clearAllMocks();

    authContext = { userId: 'user-123', isSuperAdmin: false };

    runRepository = createMockRunRepository();

    runTrialsRepository = createMockRunTrialRepository();

    runTrialInteractionsRepository = createMockRunTrialInteractionsRepository();

    familyRepository = createMockFamilyRepository();
    familyRepository.getFamilyIdsForUser.mockResolvedValue(['family-123']);

    authorizationService = createMockAuthorizationService();
    authorizationService.hasAnyPermission.mockResolvedValue(true);

    runEventsService = RunEventService({
      runRepository: runRepository,
      runTrialsRepository: runTrialsRepository,
      runTrialInteractionsRepository: runTrialInteractionsRepository,
      familyRepository: familyRepository,
      authorizationService: authorizationService,
    });
  });

  describe('verifyUserAccess', () => {
    it('should allow access when requester owns the run', async () => {
      const targetUserId = 'user-123';
      await runEventsService.completeRun(authContext, targetUserId, 'run-123', {
        type: 'complete' as const,
      });

      // If no error is thrown, the access check passed
      // (completeRun calls verifyUserAccess internally)
      expect(familyRepository.getFamilyIdsForUser).not.toHaveBeenCalled();
      expect(authorizationService.hasAnyPermission).not.toHaveBeenCalled();
    });

    it('should check CAN_CREATE_RUN_FOR_CHILD when requester differs from target user', async () => {
      const requesterContext = { userId: 'parent-456', isSuperAdmin: false };
      const targetUserId = 'child-789';
      const validRunId = '550e8400-e29b-41d4-a716-446655440000';
      const mockRun = RunFactory.build({ id: validRunId, userId: targetUserId });
      runRepository.getById.mockResolvedValue(mockRun);
      runRepository.update.mockResolvedValue(undefined);

      await runEventsService.completeRun(requesterContext, targetUserId, validRunId, {
        type: 'complete' as const,
      });

      expect(familyRepository.getFamilyIdsForUser).toHaveBeenCalledWith(targetUserId);
      expect(authorizationService.hasAnyPermission).toHaveBeenCalledWith(
        'parent-456',
        FgaRelation.CAN_CREATE_RUN_FOR_CHILD,
        ['family:family-123'],
      );
    });

    it('should throw FORBIDDEN when requester lacks CAN_CREATE_RUN_FOR_CHILD permission', async () => {
      const requesterContext = { userId: 'parent-456', isSuperAdmin: false };
      const targetUserId = 'child-789';
      authorizationService.hasAnyPermission.mockResolvedValue(false);

      await expect(
        runEventsService.completeRun(requesterContext, targetUserId, 'run-123', {
          type: 'complete' as const,
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        message: ApiErrorMessage.FORBIDDEN,
      });

      expect(familyRepository.getFamilyIdsForUser).toHaveBeenCalledWith(targetUserId);
      expect(authorizationService.hasAnyPermission).toHaveBeenCalledWith(
        'parent-456',
        FgaRelation.CAN_CREATE_RUN_FOR_CHILD,
        ['family:family-123'],
      );
    });

    it('should handle multiple family IDs when checking CAN_CREATE_RUN_FOR_CHILD', async () => {
      const requesterContext = { userId: 'parent-456', isSuperAdmin: false };
      const targetUserId = 'child-789';
      const validRunId = '550e8400-e29b-41d4-a716-446655440000';
      const mockRun = RunFactory.build({ id: validRunId, userId: targetUserId });

      familyRepository.getFamilyIdsForUser.mockResolvedValue(['family-123', 'family-456', 'family-789']);
      runRepository.getById.mockResolvedValue(mockRun);
      runRepository.update.mockResolvedValue(undefined);

      await runEventsService.completeRun(requesterContext, targetUserId, validRunId, {
        type: 'complete' as const,
      });

      expect(authorizationService.hasAnyPermission).toHaveBeenCalledWith(
        'parent-456',
        FgaRelation.CAN_CREATE_RUN_FOR_CHILD,
        ['family:family-123', 'family:family-456', 'family:family-789'],
      );
    });

    it('should throw FORBIDDEN when target user has no families and requester differs', async () => {
      const requesterContext = { userId: 'parent-456', isSuperAdmin: false };
      const targetUserId = 'child-789';

      familyRepository.getFamilyIdsForUser.mockResolvedValue([]);
      authorizationService.hasAnyPermission.mockResolvedValue(false);

      await expect(
        runEventsService.completeRun(requesterContext, targetUserId, 'run-123', {
          type: 'complete' as const,
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(authorizationService.hasAnyPermission).toHaveBeenCalledWith(
        'parent-456',
        FgaRelation.CAN_CREATE_RUN_FOR_CHILD,
        [],
      );
    });
  });

  describe('completeRun', () => {
    const validRunId = '550e8400-e29b-41d4-a716-446655440000';
    const validBody = { type: 'complete' as const };
    const targetUserId = 'user-123';

    it('should complete a run successfully', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: targetUserId });
      runRepository.getById.mockResolvedValue(mockRun);
      runRepository.update.mockResolvedValue(undefined);

      await runEventsService.completeRun(authContext, targetUserId, validRunId, validBody);

      expect(runRepository.getById).toHaveBeenCalledWith({ id: validRunId });
      expect(runRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: validRunId,
          data: expect.objectContaining({
            completedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw FORBIDDEN when user does not own the run', async () => {
      const differentUserId = 'user-456';
      await expect(
        runEventsService.completeRun(authContext, differentUserId, validRunId, validBody),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(runRepository.getById).not.toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when run does not exist', async () => {
      runRepository.getById.mockResolvedValue(null);

      await expect(
        runEventsService.completeRun(authContext, targetUserId, validRunId, validBody),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      expect(runRepository.update).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when run is owned by a different user', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'different-user' });
      runRepository.getById.mockResolvedValue(mockRun);

      await expect(
        runEventsService.completeRun(authContext, targetUserId, validRunId, validBody),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(runRepository.update).not.toHaveBeenCalled();
    });

    it('should throw CONFLICT when run is already completed', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123', completedAt: new Date() });
      runRepository.getById.mockResolvedValue(mockRun);

      await expect(
        runEventsService.completeRun(authContext, targetUserId, validRunId, validBody),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
      });

      expect(runRepository.update).not.toHaveBeenCalled();
    });

    it('should throw CONFLICT when run is already aborted', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123', abortedAt: new Date() });
      runRepository.getById.mockResolvedValue(mockRun);

      await expect(
        runEventsService.completeRun(authContext, targetUserId, validRunId, validBody),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
      });

      expect(runRepository.update).not.toHaveBeenCalled();
    });

    it('should include metadata in error context when run is not found', async () => {
      runRepository.getById.mockResolvedValue(null);

      try {
        await runEventsService.completeRun(authContext, 'user-123', validRunId, validBody);
      } catch (error) {
        if (error instanceof ApiError) {
          expect(error.context).toEqual({
            runId: validRunId,
            targetUserId: 'user-123',
          });
        }
      }
    });

    it('should handle optional metadata in event body', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runRepository.getById.mockResolvedValue(mockRun);
      runRepository.update.mockResolvedValue(undefined);

      const bodyWithMetadata = {
        type: 'complete' as const,
        metadata: { source: 'mobile', sessionId: 'sess-456' },
      };

      await runEventsService.completeRun(authContext, 'user-123', validRunId, bodyWithMetadata);

      expect(runRepository.update).toHaveBeenCalled();
      const updateCall = runRepository.update.mock.calls[0]![0];
      expect(updateCall.data.metadata).toEqual(bodyWithMetadata.metadata);
    });

    it('should return 500 when database update fails', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runRepository.getById.mockResolvedValue(mockRun);
      runRepository.update.mockRejectedValue(new Error('Database connection lost'));

      await expect(
        runEventsService.completeRun(authContext, targetUserId, validRunId, validBody),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should re-throw ApiError exceptions', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runRepository.getById.mockResolvedValue(mockRun);
      const apiError = new ApiError('Custom error', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      runRepository.update.mockRejectedValue(apiError);

      await expect(runEventsService.completeRun(authContext, targetUserId, validRunId, validBody)).rejects.toBe(
        apiError,
      );
    });
  });

  describe('abortRun', () => {
    const validRunId = '550e8400-e29b-41d4-a716-446655440000';
    const validBody = { type: 'abort' as const };
    const targetUserId = 'user-123';

    it('should abort a run successfully', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: targetUserId });
      runRepository.getById.mockResolvedValue(mockRun);
      runRepository.update.mockResolvedValue(undefined);

      await runEventsService.abortRun(authContext, targetUserId, validRunId, validBody);

      expect(runRepository.getById).toHaveBeenCalledWith({ id: validRunId });
      expect(runRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: validRunId,
          data: expect.objectContaining({
            abortedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NOT_FOUND when run does not exist', async () => {
      runRepository.getById.mockResolvedValue(null);

      await expect(runEventsService.abortRun(authContext, targetUserId, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      expect(runRepository.update).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when user does not own the run', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'different-user' });
      runRepository.getById.mockResolvedValue(mockRun);

      await expect(runEventsService.abortRun(authContext, targetUserId, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(runRepository.update).not.toHaveBeenCalled();
    });

    it('should throw CONFLICT when run is already aborted', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123', abortedAt: new Date() });
      runRepository.getById.mockResolvedValue(mockRun);

      await expect(runEventsService.abortRun(authContext, targetUserId, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
      });

      expect(runRepository.update).not.toHaveBeenCalled();
    });

    it('should throw CONFLICT when run is already completed', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123', completedAt: new Date() });
      runRepository.getById.mockResolvedValue(mockRun);

      await expect(runEventsService.abortRun(authContext, targetUserId, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
      });

      expect(runRepository.update).not.toHaveBeenCalled();
    });

    it('should return 500 when database update fails', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runRepository.getById.mockResolvedValue(mockRun);
      runRepository.update.mockRejectedValue(new Error('Database connection lost'));

      await expect(runEventsService.abortRun(authContext, targetUserId, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should re-throw ApiError exceptions', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runRepository.getById.mockResolvedValue(mockRun);
      const apiError = new ApiError('Custom error', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      runRepository.update.mockRejectedValue(apiError);

      await expect(runEventsService.abortRun(authContext, targetUserId, validRunId, validBody)).rejects.toBe(apiError);
    });
  });

  describe('writeTrial', () => {
    const validRunId = '550e8400-e29b-41d4-a716-446655440000';
    const validBody = {
      type: 'trial' as const,
      trial: {
        assessmentStage: 'test' as const,
        correct: 1,
      },
    };
    const targetUserId = 'user-123';

    it('should write a trial successfully', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: targetUserId });
      runRepository.getById.mockResolvedValue(mockRun);

      const createdTrial = { id: 'trial-123' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runTrialsRepository.runTransaction.mockImplementation(async ({ fn }: any) => {
        await fn({});
      });
      runTrialsRepository.create.mockResolvedValue(createdTrial);

      await runEventsService.writeTrial(authContext, targetUserId, validRunId, validBody);

      expect(runRepository.getById).toHaveBeenCalledWith({ id: validRunId });
      expect(runTrialsRepository.runTransaction).toHaveBeenCalled();
      expect(runTrialsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            runId: validRunId,
            assessmentStage: 'test',
            correct: 1,
          }),
        }),
      );
    });

    it('should handle trial with interactions', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runRepository.getById.mockResolvedValue(mockRun);

      const bodyWithInteractions = {
        type: 'trial' as const,
        trial: {
          assessmentStage: 'practice' as const,
          correct: 1,
        },
        interactions: [
          { event: 'focus' as const, timeMs: 100 },
          { event: 'blur' as const, timeMs: 200 },
        ],
      };

      const createdTrial = { id: 'trial-123' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runTrialsRepository.runTransaction.mockImplementation(async ({ fn }: any) => {
        await fn({});
      });
      runTrialsRepository.create.mockResolvedValue(createdTrial);
      runTrialInteractionsRepository.create.mockResolvedValue({ id: 'interaction-1' });

      await runEventsService.writeTrial(authContext, targetUserId, validRunId, bodyWithInteractions);

      expect(runTrialsRepository.runTransaction).toHaveBeenCalled();
      expect(runTrialsRepository.create).toHaveBeenCalled();
      // Verify interactions were created
      expect(runTrialInteractionsRepository.create).toHaveBeenCalledTimes(2);
      expect(runTrialInteractionsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trialId: 'trial-123',
            interactionType: 'focus',
            timeMs: 100,
          }),
        }),
      );
    });

    it('should return 500 when database transaction fails', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runRepository.getById.mockResolvedValue(mockRun);

      const dbError = new Error('Database connection lost');
      runTrialsRepository.runTransaction.mockRejectedValue(dbError);

      await expect(runEventsService.writeTrial(authContext, targetUserId, validRunId, validBody)).rejects.toMatchObject(
        {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        },
      );
    });

    it('should re-throw ApiError when thrown during transaction', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runRepository.getById.mockResolvedValue(mockRun);

      const apiError = new ApiError('Custom error', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      runTrialsRepository.runTransaction.mockRejectedValue(apiError);

      await expect(runEventsService.writeTrial(authContext, targetUserId, validRunId, validBody)).rejects.toBe(
        apiError,
      );
    });
  });

  describe('updateEngagement', () => {
    const validRunId = '550e8400-e29b-41d4-a716-446655440000';
    const validBody = {
      type: 'engagement' as const,
      engagementFlags: {
        incomplete: true,
        responseTimeTooFast: true,
        accuracyTooLow: false,
        notEnoughResponses: false,
      },
      reliableRun: true,
    };
    const targetUserId = 'user-123';

    beforeEach(() => {
      runRepository.update = vi.fn();
    });

    it('should update engagement successfully', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: targetUserId });
      runRepository.getById.mockResolvedValue(mockRun);
      runRepository.update.mockResolvedValue(undefined);

      await runEventsService.updateEngagement(authContext, targetUserId, validRunId, validBody);

      expect(runRepository.getById).toHaveBeenCalledWith({ id: validRunId });
      expect(runRepository.update).toHaveBeenCalledWith({
        id: validRunId,
        data: {
          engagementFlags: validBody.engagementFlags,
          reliableRun: true,
        },
      });
    });

    it('should handle empty engagement flags', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runRepository.getById.mockResolvedValue(mockRun);
      runRepository.update.mockResolvedValue(undefined);

      const bodyWithEmptyFlags = {
        type: 'engagement' as const,
        engagementFlags: {},
        reliableRun: false,
      };

      await runEventsService.updateEngagement(authContext, targetUserId, validRunId, bodyWithEmptyFlags);

      expect(runRepository.update).toHaveBeenCalledWith({
        id: validRunId,
        data: {
          engagementFlags: {},
          reliableRun: false,
        },
      });
    });

    it('should handle multiple engagement flags', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runRepository.getById.mockResolvedValue(mockRun);
      runRepository.update.mockResolvedValue(undefined);

      const bodyWithMultipleFlags = {
        type: 'engagement' as const,
        engagementFlags: {
          incomplete: true,
          responseTimeTooFast: true,
          accuracyTooLow: true,
          notEnoughResponses: true,
        },
        reliableRun: false,
      };

      await runEventsService.updateEngagement(authContext, targetUserId, validRunId, bodyWithMultipleFlags);

      expect(runRepository.update).toHaveBeenCalledWith({
        id: validRunId,
        data: {
          engagementFlags: bodyWithMultipleFlags.engagementFlags,
          reliableRun: false,
        },
      });
    });

    it('should return 500 when database update fails', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runRepository.getById.mockResolvedValue(mockRun);

      const dbError = new Error('Database connection lost');
      runRepository.update.mockRejectedValue(dbError);

      await expect(
        runEventsService.updateEngagement(authContext, targetUserId, validRunId, validBody),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should re-throw ApiError when thrown during update', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runRepository.getById.mockResolvedValue(mockRun);

      const apiError = new ApiError('Custom error', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      runRepository.update.mockRejectedValue(apiError);

      await expect(runEventsService.updateEngagement(authContext, targetUserId, validRunId, validBody)).rejects.toBe(
        apiError,
      );
    });
  });
});
