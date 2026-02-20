import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { RunEventsService } from './run-events.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';

vi.mock('../../logger');

/**
 * RunEventsService Tests
 *
 * Tests the business logic for handling run events.
 * Verifies authorization checks, error handling, and state updates.
 */
describe('RunEventsService', () => {
  const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRunsRepository: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRunTrialsRepository: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRunTrialInteractionsRepository: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let runEventsService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRunsRepository = {
      getById: vi.fn(),
      update: vi.fn(),
    };

    mockRunTrialsRepository = {
      create: vi.fn(),
      runTransaction: vi.fn(),
    };

    mockRunTrialInteractionsRepository = {
      create: vi.fn(),
    };

    runEventsService = RunEventsService({
      runsRepository: mockRunsRepository,
      runTrialsRepository: mockRunTrialsRepository,
      runTrialInteractionsRepository: mockRunTrialInteractionsRepository,
    });
  });

  describe('completeRun', () => {
    const validRunId = '550e8400-e29b-41d4-a716-446655440000';
    const validBody = { type: 'complete' as const };

    it('should complete a run successfully', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      mockRunsRepository.update.mockResolvedValue(undefined);

      await runEventsService.completeRun(mockAuthContext, validRunId, validBody);

      expect(mockRunsRepository.getById).toHaveBeenCalledWith({ id: validRunId });
      const updateCall = mockRunsRepository.update.mock.calls[0][0];
      expect(updateCall.id).toBe(validRunId);
      expect(updateCall.data.completedAt).toBeInstanceOf(Date);
    });

    it('should throw NOT_FOUND when run does not exist', async () => {
      mockRunsRepository.getById.mockResolvedValue(null);

      await expect(runEventsService.completeRun(mockAuthContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      expect(mockRunsRepository.update).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when user does not own the run', async () => {
      const mockRun = { id: validRunId, userId: 'different-user' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);

      await expect(runEventsService.completeRun(mockAuthContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(mockRunsRepository.update).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when event type is invalid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidBody = { type: 'invalid' } as any;

      await expect(runEventsService.completeRun(mockAuthContext, validRunId, invalidBody)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      expect(mockRunsRepository.getById).not.toHaveBeenCalled();
      expect(mockRunsRepository.update).not.toHaveBeenCalled();
    });

    it('should include metadata in error context when run is not found', async () => {
      mockRunsRepository.getById.mockResolvedValue(null);

      try {
        await runEventsService.completeRun(mockAuthContext, validRunId, validBody);
      } catch (error) {
        if (error instanceof ApiError) {
          expect(error.context).toEqual({
            runId: validRunId,
            userId: mockAuthContext.userId,
          });
        }
      }
    });

    it('should set completedAt timestamp', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      mockRunsRepository.update.mockResolvedValue(undefined);

      const beforeCall = new Date();
      await runEventsService.completeRun(mockAuthContext, validRunId, validBody);
      const afterCall = new Date();

      const updateCall = mockRunsRepository.update.mock.calls[0][0];
      expect(updateCall.data.completedAt).toBeInstanceOf(Date);
      expect(updateCall.data.completedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(updateCall.data.completedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it('should handle optional metadata in event body', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      mockRunsRepository.update.mockResolvedValue(undefined);

      const bodyWithMetadata = {
        type: 'complete' as const,
        metadata: { source: 'mobile', sessionId: 'sess-456' },
      };

      await runEventsService.completeRun(mockAuthContext, validRunId, bodyWithMetadata);

      expect(mockRunsRepository.update).toHaveBeenCalled();
      const updateCall = mockRunsRepository.update.mock.calls[0][0];
      expect(updateCall.data.metadata).toEqual(bodyWithMetadata.metadata);
    });
  });

  describe('abortRun', () => {
    const validRunId = '550e8400-e29b-41d4-a716-446655440000';
    const abortedAtTime = new Date('2024-01-15T10:30:00Z');
    const validBody = { type: 'abort' as const, abortedAt: abortedAtTime };

    it('should abort a run successfully', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      mockRunsRepository.update.mockResolvedValue(undefined);

      await runEventsService.abortRun(mockAuthContext, validRunId, validBody);

      expect(mockRunsRepository.getById).toHaveBeenCalledWith({ id: validRunId });
      const updateCall = mockRunsRepository.update.mock.calls[0][0];
      expect(updateCall.id).toBe(validRunId);
      expect(updateCall.data.abortedAt).toBe(abortedAtTime);
    });

    it('should abort a run with different abortedAt time', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      mockRunsRepository.update.mockResolvedValue(undefined);

      const differentTime = new Date('2024-01-15T11:45:00Z');
      const bodyWithDifferentTime = {
        type: 'abort' as const,
        abortedAt: differentTime,
      };

      await runEventsService.abortRun(mockAuthContext, validRunId, bodyWithDifferentTime);

      const updateCall = mockRunsRepository.update.mock.calls[0][0];
      expect(updateCall.id).toBe(validRunId);
      expect(updateCall.data.abortedAt).toBe(differentTime);
    });

    it('should throw NOT_FOUND when run does not exist', async () => {
      mockRunsRepository.getById.mockResolvedValue(null);

      await expect(runEventsService.abortRun(mockAuthContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      expect(mockRunsRepository.update).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when user does not own the run', async () => {
      const mockRun = { id: validRunId, userId: 'different-user' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);

      await expect(runEventsService.abortRun(mockAuthContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(mockRunsRepository.update).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when event type is invalid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidBody = { type: 'invalid' } as any;

      await expect(runEventsService.abortRun(mockAuthContext, validRunId, invalidBody)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      expect(mockRunsRepository.getById).not.toHaveBeenCalled();
      expect(mockRunsRepository.update).not.toHaveBeenCalled();
    });

    it('should set abortedAt timestamp', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      mockRunsRepository.update.mockResolvedValue(undefined);

      await runEventsService.abortRun(mockAuthContext, validRunId, validBody);

      const updateCall = mockRunsRepository.update.mock.calls[0][0];
      expect(updateCall.data.abortedAt).toBe(abortedAtTime);
    });

    it('should return 500 when database update fails', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      mockRunsRepository.update.mockRejectedValue(new Error('Database connection lost'));

      await expect(runEventsService.abortRun(mockAuthContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should re-throw ApiError exceptions', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      const apiError = new ApiError('Custom error', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockRunsRepository.update.mockRejectedValue(apiError);

      await expect(runEventsService.abortRun(mockAuthContext, validRunId, validBody)).rejects.toBe(apiError);
    });
  });

  describe('writeTrial', () => {
    const validRunId = '550e8400-e29b-41d4-a716-446655440000';
    const validBody = {
      type: 'trial' as const,
      trial: {
        assessment_stage: 'test' as const,
        correct: 1,
      },
    };

    it('should write a trial successfully', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);

      const createdTrial = { id: 'trial-123' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockRunTrialsRepository.runTransaction.mockImplementation(async ({ fn }: any) => {
        await fn({});
      });
      mockRunTrialsRepository.create.mockResolvedValue(createdTrial);

      await runEventsService.writeTrial(mockAuthContext, validRunId, validBody);

      expect(mockRunsRepository.getById).toHaveBeenCalledWith({ id: validRunId });
      expect(mockRunTrialsRepository.runTransaction).toHaveBeenCalled();
      expect(mockRunTrialsRepository.create).toHaveBeenCalledWith(
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
      mockRunsRepository.getById.mockResolvedValue(null);

      await expect(runEventsService.writeTrial(mockAuthContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      expect(mockRunTrialsRepository.runTransaction).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when user does not own the run', async () => {
      const mockRun = { id: validRunId, userId: 'different-user' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);

      await expect(runEventsService.writeTrial(mockAuthContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(mockRunTrialsRepository.runTransaction).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when event type is invalid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidBody = { type: 'invalid' } as any;

      await expect(runEventsService.writeTrial(mockAuthContext, validRunId, invalidBody)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      expect(mockRunsRepository.getById).not.toHaveBeenCalled();
      expect(mockRunTrialsRepository.runTransaction).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when trial payload is malformed (missing assessment_stage)', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);

      const malformedBody = {
        type: 'trial' as const,
        trial: {
          correct: 1,
        },
      };

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        runEventsService.writeTrial(mockAuthContext, validRunId, malformedBody as any),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      expect(mockRunTrialsRepository.runTransaction).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when trial payload is malformed (missing correct)', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);

      const malformedBody = {
        type: 'trial' as const,
        trial: {
          assessment_stage: 'test',
        },
      };

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        runEventsService.writeTrial(mockAuthContext, validRunId, malformedBody as any),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      expect(mockRunTrialsRepository.runTransaction).not.toHaveBeenCalled();
    });

    it('should handle trial with interactions', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);

      const bodyWithInteractions = {
        type: 'trial' as const,
        trial: {
          assessment_stage: 'practice' as const,
          correct: 1,
        },
        interactions: [
          { event: 'focus', trial_id: 0, time_ms: 100 },
          { event: 'blur', trial_id: 0, time_ms: 200 },
        ],
      };

      const createdTrial = { id: 'trial-123' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockRunTrialsRepository.runTransaction.mockImplementation(async ({ fn }: any) => {
        await fn({});
      });
      mockRunTrialsRepository.create.mockResolvedValue(createdTrial);
      mockRunTrialInteractionsRepository.create.mockResolvedValue({ id: 'interaction-1' });

      await runEventsService.writeTrial(mockAuthContext, validRunId, bodyWithInteractions);

      expect(mockRunTrialsRepository.runTransaction).toHaveBeenCalled();
      expect(mockRunTrialsRepository.create).toHaveBeenCalled();
      // Verify interactions were created
      expect(mockRunTrialInteractionsRepository.create).toHaveBeenCalledTimes(2);
      expect(mockRunTrialInteractionsRepository.create).toHaveBeenCalledWith(
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
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);

      const dbError = new Error('Database connection lost');
      mockRunTrialsRepository.runTransaction.mockRejectedValue(dbError);

      await expect(runEventsService.writeTrial(mockAuthContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should re-throw ApiError when thrown during transaction', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);

      const apiError = new ApiError('Custom error', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockRunTrialsRepository.runTransaction.mockRejectedValue(apiError);

      await expect(runEventsService.writeTrial(mockAuthContext, validRunId, validBody)).rejects.toBe(apiError);
    });
  });
});
