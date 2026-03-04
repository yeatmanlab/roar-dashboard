import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { RunEventsService } from './run-events.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import type { AuthContext } from '../../types/auth-context';
import {
  MockRunRepository,
  createMockRunRepository,
  MockRunTrialRepository,
  createMockRunTrialRepository,
  MockRunTrialInteractionsRepository,
  createMockRunTrialInteractionsRepository,
} from '../../test-support/repositories';
import { RunFactory } from '../../test-support/factories/run.factory';

vi.mock('../../logger');

/**
 * RunEventsService Tests
 *
 * Tests the business logic for handling run events.
 * Verifies authorization checks, error handling, and state updates.
 */
describe('RunEventsService', () => {
  let authContext: AuthContext;
  let runsRepository: MockRunRepository;
  let runTrialsRepository: MockRunTrialRepository;
  let runTrialInteractionsRepository: MockRunTrialInteractionsRepository;
  let runEventsService: ReturnType<typeof RunEventsService>;

  beforeEach(() => {
    vi.clearAllMocks();

    authContext = { userId: 'user-123', isSuperAdmin: false };

    runsRepository = createMockRunRepository();

    runTrialsRepository = createMockRunTrialRepository();

    runTrialInteractionsRepository = createMockRunTrialInteractionsRepository();

    runEventsService = RunEventsService({
      runsRepository: runsRepository,
      runTrialsRepository: runTrialsRepository,
      runTrialInteractionsRepository: runTrialInteractionsRepository,
    });
  });

  describe('completeRun', () => {
    const validRunId = '550e8400-e29b-41d4-a716-446655440000';
    const validBody = { type: 'complete' as const };

    it('should complete a run successfully', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);
      runsRepository.update.mockResolvedValue(undefined);

      await runEventsService.completeRun(authContext, validRunId, validBody);

      expect(runsRepository.getById).toHaveBeenCalledWith({ id: validRunId });
      expect(runsRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: validRunId,
          data: expect.objectContaining({
            completedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NOT_FOUND when run does not exist', async () => {
      runsRepository.getById.mockResolvedValue(null);

      await expect(runEventsService.completeRun(authContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      expect(runsRepository.update).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when user does not own the run', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'different-user' });
      runsRepository.getById.mockResolvedValue(mockRun);

      await expect(runEventsService.completeRun(authContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(runsRepository.update).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when event type is invalid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidBody = { type: 'invalid' } as any;

      await expect(runEventsService.completeRun(authContext, validRunId, invalidBody)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      expect(runsRepository.getById).not.toHaveBeenCalled();
      expect(runsRepository.update).not.toHaveBeenCalled();
    });

    it('should include metadata in error context when run is not found', async () => {
      runsRepository.getById.mockResolvedValue(null);

      try {
        await runEventsService.completeRun(authContext, validRunId, validBody);
      } catch (error) {
        if (error instanceof ApiError) {
          expect(error.context).toEqual({
            runId: validRunId,
            userId: authContext.userId,
          });
        }
      }
    });

    it('should handle optional metadata in event body', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);
      runsRepository.update.mockResolvedValue(undefined);

      const bodyWithMetadata = {
        type: 'complete' as const,
        metadata: { source: 'mobile', sessionId: 'sess-456' },
      };

      await runEventsService.completeRun(authContext, validRunId, bodyWithMetadata);

      expect(runsRepository.update).toHaveBeenCalled();
      const updateCall = runsRepository.update.mock.calls[0]![0];
      expect(updateCall.data.metadata).toEqual(bodyWithMetadata.metadata);
    });

    it('should return 500 when database update fails', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);
      runsRepository.update.mockRejectedValue(new Error('Database connection lost'));

      await expect(runEventsService.completeRun(authContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should re-throw ApiError exceptions', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);
      const apiError = new ApiError('Custom error', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      runsRepository.update.mockRejectedValue(apiError);

      await expect(runEventsService.completeRun(authContext, validRunId, validBody)).rejects.toBe(apiError);
    });
  });

  describe('abortRun', () => {
    const validRunId = '550e8400-e29b-41d4-a716-446655440000';
    const validBody = { type: 'abort' as const };

    it('should abort a run successfully', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);
      runsRepository.update.mockResolvedValue(undefined);

      await runEventsService.abortRun(authContext, validRunId, validBody);

      expect(runsRepository.getById).toHaveBeenCalledWith({ id: validRunId });
      expect(runsRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: validRunId,
          data: expect.objectContaining({
            abortedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NOT_FOUND when run does not exist', async () => {
      runsRepository.getById.mockResolvedValue(null);

      await expect(runEventsService.abortRun(authContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      expect(runsRepository.update).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when user does not own the run', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'different-user' });
      runsRepository.getById.mockResolvedValue(mockRun);

      await expect(runEventsService.abortRun(authContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(runsRepository.update).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when event type is invalid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidBody = { type: 'invalid' } as any;

      await expect(runEventsService.abortRun(authContext, validRunId, invalidBody)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      expect(runsRepository.getById).not.toHaveBeenCalled();
      expect(runsRepository.update).not.toHaveBeenCalled();
    });

    it('should complete successfully when run is owned by user', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);

      await expect(runEventsService.abortRun(authContext, validRunId, validBody)).resolves.toBeUndefined();
    });

    it('should include metadata in error context when run is not found', async () => {
      runsRepository.getById.mockResolvedValue(null);

      try {
        await runEventsService.abortRun(authContext, validRunId, validBody);
      } catch (error) {
        if (error instanceof ApiError) {
          expect(error.context).toEqual({
            runId: validRunId,
            userId: authContext.userId,
          });
        }
      }
    });

    it('should return 500 when database update fails', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);
      runsRepository.update.mockRejectedValue(new Error('Database connection lost'));

      await expect(runEventsService.abortRun(authContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should re-throw ApiError exceptions', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);
      const apiError = new ApiError('Custom error', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      runsRepository.update.mockRejectedValue(apiError);

      await expect(runEventsService.abortRun(authContext, validRunId, validBody)).rejects.toBe(apiError);
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

    it('should write a trial successfully', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);

      const createdTrial = { id: 'trial-123' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runTrialsRepository.runTransaction.mockImplementation(async ({ fn }: any) => {
        await fn({});
      });
      runTrialsRepository.create.mockResolvedValue(createdTrial);

      await runEventsService.writeTrial(authContext, validRunId, validBody);

      expect(runsRepository.getById).toHaveBeenCalledWith({ id: validRunId });
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

    it('should throw NOT_FOUND when run does not exist', async () => {
      runsRepository.getById.mockResolvedValue(null);

      await expect(runEventsService.writeTrial(authContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      expect(runTrialsRepository.runTransaction).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when user does not own the run', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'different-user' });
      runsRepository.getById.mockResolvedValue(mockRun);

      await expect(runEventsService.writeTrial(authContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(runTrialsRepository.runTransaction).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when event type is invalid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidBody = { type: 'invalid' } as any;

      await expect(runEventsService.writeTrial(authContext, validRunId, invalidBody)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      expect(runsRepository.getById).not.toHaveBeenCalled();
      expect(runTrialsRepository.runTransaction).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when trial payload is malformed (missing assessment_stage)', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);

      const malformedBody = {
        type: 'trial' as const,
        trial: {
          assessmentStage: undefined,
          correct: 1,
        },
      };

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        runEventsService.writeTrial(authContext, validRunId, malformedBody as any),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      expect(runTrialsRepository.runTransaction).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when trial payload is malformed (missing correct)', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);

      const malformedBody = {
        type: 'trial' as const,
        trial: {
          assessmentStage: 'test',
        },
      };

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        runEventsService.writeTrial(authContext, validRunId, malformedBody as any),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      expect(runTrialsRepository.runTransaction).not.toHaveBeenCalled();
    });

    it('should handle trial with interactions', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);

      const bodyWithInteractions = {
        type: 'trial' as const,
        trial: {
          assessmentStage: 'practice' as const,
          correct: 1,
        },
        interactions: [
          { event: 'focus' as const, trialId: 0, timeMs: 100 },
          { event: 'blur' as const, trialId: 0, timeMs: 200 },
        ],
      };

      const createdTrial = { id: 'trial-123' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runTrialsRepository.runTransaction.mockImplementation(async ({ fn }: any) => {
        await fn({});
      });
      runTrialsRepository.create.mockResolvedValue(createdTrial);
      runTrialInteractionsRepository.create.mockResolvedValue({ id: 'interaction-1' });

      await runEventsService.writeTrial(authContext, validRunId, bodyWithInteractions);

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
      runsRepository.getById.mockResolvedValue(mockRun);

      const dbError = new Error('Database connection lost');
      runTrialsRepository.runTransaction.mockRejectedValue(dbError);

      await expect(runEventsService.writeTrial(authContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should re-throw ApiError when thrown during transaction', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);

      const apiError = new ApiError('Custom error', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      runTrialsRepository.runTransaction.mockRejectedValue(apiError);

      await expect(runEventsService.writeTrial(authContext, validRunId, validBody)).rejects.toBe(apiError);
    });
  });

  describe('updateEngagement', () => {
    const validRunId = '550e8400-e29b-41d4-a716-446655440000';
    const validBody = {
      type: 'engagement' as const,
      engagementFlags: {
        incomplete: 'incomplete' as const,
        response_time_too_fast: 'response_time_too_fast' as const,
      },
      reliableRun: true,
    };

    beforeEach(() => {
      runsRepository.update = vi.fn();
    });

    it('should update engagement successfully', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);
      runsRepository.update.mockResolvedValue(undefined);

      await runEventsService.updateEngagement(authContext, validRunId, validBody);

      expect(runsRepository.getById).toHaveBeenCalledWith({ id: validRunId });
      expect(runsRepository.update).toHaveBeenCalledWith({
        id: validRunId,
        data: {
          engagementFlags: validBody.engagementFlags,
          reliableRun: true,
        },
      });
    });

    it('should throw NOT_FOUND when run does not exist', async () => {
      runsRepository.getById.mockResolvedValue(null);

      await expect(runEventsService.updateEngagement(authContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      expect(runsRepository.update).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when user does not own the run', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'different-user' });
      runsRepository.getById.mockResolvedValue(mockRun);

      await expect(runEventsService.updateEngagement(authContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(runsRepository.update).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when event type is invalid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidBody = { type: 'invalid' } as any;

      await expect(runEventsService.updateEngagement(authContext, validRunId, invalidBody)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      expect(runsRepository.getById).not.toHaveBeenCalled();
      expect(runsRepository.update).not.toHaveBeenCalled();
    });

    it('should handle empty engagement flags', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);
      runsRepository.update.mockResolvedValue(undefined);

      const bodyWithEmptyFlags = {
        type: 'engagement' as const,
        engagementFlags: {},
        reliableRun: false,
      };

      await runEventsService.updateEngagement(authContext, validRunId, bodyWithEmptyFlags);

      expect(runsRepository.update).toHaveBeenCalledWith({
        id: validRunId,
        data: {
          engagementFlags: {},
          reliableRun: false,
        },
      });
    });

    it('should handle multiple engagement flags', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);
      runsRepository.update.mockResolvedValue(undefined);

      const bodyWithMultipleFlags = {
        type: 'engagement' as const,
        engagementFlags: {
          incomplete: 'incomplete' as const,
          response_time_too_fast: 'response_time_too_fast' as const,
          accuracy_too_low: 'accuracy_too_low' as const,
          not_enough_responses: 'not_enough_responses' as const,
        },
        reliableRun: false,
      };

      await runEventsService.updateEngagement(authContext, validRunId, bodyWithMultipleFlags);

      expect(runsRepository.update).toHaveBeenCalledWith({
        id: validRunId,
        data: {
          engagementFlags: bodyWithMultipleFlags.engagementFlags,
          reliableRun: false,
        },
      });
    });

    it('should return 500 when database update fails', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);

      const dbError = new Error('Database connection lost');
      runsRepository.update.mockRejectedValue(dbError);

      await expect(runEventsService.updateEngagement(authContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should re-throw ApiError when thrown during update', async () => {
      const mockRun = RunFactory.build({ id: validRunId, userId: 'user-123' });
      runsRepository.getById.mockResolvedValue(mockRun);

      const apiError = new ApiError('Custom error', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      runsRepository.update.mockRejectedValue(apiError);

      await expect(runEventsService.updateEngagement(authContext, validRunId, validBody)).rejects.toBe(apiError);
    });
  });
});
