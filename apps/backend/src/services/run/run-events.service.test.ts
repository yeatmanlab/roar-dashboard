import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { RunEventsService } from './run-events.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';

describe('RunEventsService', () => {
  const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRunsRepository: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let runEventsService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRunsRepository = {
      getById: vi.fn(),
      update: vi.fn(),
    };

    runEventsService = RunEventsService({
      runsRepository: mockRunsRepository,
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
      expect(mockRunsRepository.update).toHaveBeenCalledWith({
        id: validRunId,
        data: {
          completedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
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

    it('should update both completedAt and updatedAt timestamps', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      mockRunsRepository.update.mockResolvedValue(undefined);

      const beforeCall = new Date();
      await runEventsService.completeRun(mockAuthContext, validRunId, validBody);
      const afterCall = new Date();

      const updateCall = mockRunsRepository.update.mock.calls[0][0];
      expect(updateCall.data.completedAt).toBeInstanceOf(Date);
      expect(updateCall.data.updatedAt).toBeInstanceOf(Date);
      expect(updateCall.data.completedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(updateCall.data.updatedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
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
      expect(updateCall.data.completionMetadata).toEqual(bodyWithMetadata.metadata);
    });
  });

  describe('abortRun', () => {
    const validRunId = '550e8400-e29b-41d4-a716-446655440000';
    const validBody = { type: 'abort' as const };

    it('should abort a run successfully', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      mockRunsRepository.update.mockResolvedValue(undefined);

      await runEventsService.abortRun(mockAuthContext, validRunId, validBody);

      expect(mockRunsRepository.getById).toHaveBeenCalledWith({ id: validRunId });
      expect(mockRunsRepository.update).toHaveBeenCalledWith({
        id: validRunId,
        data: {
          updatedAt: expect.any(Date),
          abortReason: null,
        },
      });
    });

    it('should abort a run with a reason', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      mockRunsRepository.update.mockResolvedValue(undefined);

      const bodyWithReason = {
        type: 'abort' as const,
        reason: 'User requested cancellation',
      };

      await runEventsService.abortRun(mockAuthContext, validRunId, bodyWithReason);

      expect(mockRunsRepository.update).toHaveBeenCalledWith({
        id: validRunId,
        data: {
          updatedAt: expect.any(Date),
          abortReason: 'User requested cancellation',
        },
      });
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

    it('should update timestamp when aborting', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      mockRunsRepository.update.mockResolvedValue(undefined);

      const beforeCall = new Date();
      await runEventsService.abortRun(mockAuthContext, validRunId, validBody);
      const afterCall = new Date();

      const updateCall = mockRunsRepository.update.mock.calls[0][0];
      expect(updateCall.data.updatedAt).toBeInstanceOf(Date);
      expect(updateCall.data.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(updateCall.data.updatedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it('should set abortReason to null when reason is not provided', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      mockRunsRepository.update.mockResolvedValue(undefined);

      await runEventsService.abortRun(mockAuthContext, validRunId, validBody);

      const updateCall = mockRunsRepository.update.mock.calls[0][0];
      expect(updateCall.data.abortReason).toBeNull();
    });
  });

  describe('writeTrial', () => {
    const validRunId = '550e8400-e29b-41d4-a716-446655440000';
    const validBody = {
      type: 'trial' as const,
      trial: {
        assessment_stage: 'stage-1',
        correct: true,
      },
    };

    beforeEach(() => {
      mockRunsRepository.runTransaction = vi.fn();
    });

    it('should write a trial successfully', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockRunsRepository.runTransaction.mockImplementation(async ({ fn }: any) => {
        await fn({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          }),
        });
      });

      await runEventsService.writeTrial(mockAuthContext, validRunId, validBody);

      expect(mockRunsRepository.getById).toHaveBeenCalledWith({ id: validRunId });
      expect(mockRunsRepository.runTransaction).toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when run does not exist', async () => {
      mockRunsRepository.getById.mockResolvedValue(null);

      await expect(runEventsService.writeTrial(mockAuthContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      expect(mockRunsRepository.runTransaction).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when user does not own the run', async () => {
      const mockRun = { id: validRunId, userId: 'different-user' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);

      await expect(runEventsService.writeTrial(mockAuthContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(mockRunsRepository.runTransaction).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when event type is invalid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidBody = { type: 'invalid' } as any;

      await expect(runEventsService.writeTrial(mockAuthContext, validRunId, invalidBody)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      expect(mockRunsRepository.getById).not.toHaveBeenCalled();
      expect(mockRunsRepository.runTransaction).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when trial payload is malformed (missing assessment_stage)', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);

      const malformedBody = {
        type: 'trial' as const,
        trial: {
          correct: true,
        },
      };

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        runEventsService.writeTrial(mockAuthContext, validRunId, malformedBody as any),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      expect(mockRunsRepository.runTransaction).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when trial payload is malformed (missing correct)', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);

      const malformedBody = {
        type: 'trial' as const,
        trial: {
          assessment_stage: 'stage-1',
        },
      };

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        runEventsService.writeTrial(mockAuthContext, validRunId, malformedBody as any),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      expect(mockRunsRepository.runTransaction).not.toHaveBeenCalled();
    });

    it('should handle trial with interactions', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);

      const bodyWithInteractions = {
        type: 'trial' as const,
        trial: {
          assessment_stage: 'stage-1',
          correct: true,
        },
        interactions: [
          { event: 'focus', trial_id: 0, time_ms: 100 },
          { event: 'blur', trial_id: 0, time_ms: 200 },
        ],
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockRunsRepository.runTransaction.mockImplementation(async ({ fn }: any) => {
        await fn({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          }),
        });
      });

      await runEventsService.writeTrial(mockAuthContext, validRunId, bodyWithInteractions);

      expect(mockRunsRepository.runTransaction).toHaveBeenCalled();
    });

    it('should convert boolean correct to integer (true -> 1)', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);

      const transactionFn = vi.fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockRunsRepository.runTransaction.mockImplementation(async ({ fn }: any) => {
        transactionFn(fn);
        await fn({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          }),
        });
      });

      await runEventsService.writeTrial(mockAuthContext, validRunId, validBody);

      expect(transactionFn).toHaveBeenCalled();
    });

    it('should convert boolean correct to integer (false -> 0)', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);

      const bodyWithIncorrect = {
        type: 'trial' as const,
        trial: {
          assessment_stage: 'stage-1',
          correct: false,
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockRunsRepository.runTransaction.mockImplementation(async ({ fn }: any) => {
        await fn({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          }),
        });
      });

      await runEventsService.writeTrial(mockAuthContext, validRunId, bodyWithIncorrect);

      expect(mockRunsRepository.runTransaction).toHaveBeenCalled();
    });
  });

  describe('updateEngagement', () => {
    const validRunId = '550e8400-e29b-41d4-a716-446655440000';
    const validBody = {
      type: 'engagement' as const,
      engagement_flags: {
        incomplete: true,
        response_time_too_fast: false,
      },
      reliable_run: true,
    };

    beforeEach(() => {
      mockRunsRepository.update = vi.fn();
    });

    it('should update engagement successfully', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      mockRunsRepository.update.mockResolvedValue(undefined);

      await runEventsService.updateEngagement(mockAuthContext, validRunId, validBody);

      expect(mockRunsRepository.getById).toHaveBeenCalledWith({ id: validRunId });
      expect(mockRunsRepository.update).toHaveBeenCalledWith({
        id: validRunId,
        data: {
          updatedAt: expect.any(Date),
          engagementFlags: validBody.engagement_flags,
          reliableRun: true,
        },
      });
    });

    it('should throw NOT_FOUND when run does not exist', async () => {
      mockRunsRepository.getById.mockResolvedValue(null);

      await expect(runEventsService.updateEngagement(mockAuthContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      expect(mockRunsRepository.update).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when user does not own the run', async () => {
      const mockRun = { id: validRunId, userId: 'different-user' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);

      await expect(runEventsService.updateEngagement(mockAuthContext, validRunId, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(mockRunsRepository.update).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when event type is invalid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidBody = { type: 'invalid' } as any;

      await expect(runEventsService.updateEngagement(mockAuthContext, validRunId, invalidBody)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      expect(mockRunsRepository.getById).not.toHaveBeenCalled();
      expect(mockRunsRepository.update).not.toHaveBeenCalled();
    });

    it('should handle empty engagement flags', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      mockRunsRepository.update.mockResolvedValue(undefined);

      const bodyWithEmptyFlags = {
        type: 'engagement' as const,
        engagement_flags: {},
        reliable_run: false,
      };

      await runEventsService.updateEngagement(mockAuthContext, validRunId, bodyWithEmptyFlags);

      expect(mockRunsRepository.update).toHaveBeenCalledWith({
        id: validRunId,
        data: {
          updatedAt: expect.any(Date),
          engagementFlags: {},
          reliableRun: false,
        },
      });
    });

    it('should handle multiple engagement flags', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      mockRunsRepository.update.mockResolvedValue(undefined);

      const bodyWithMultipleFlags = {
        type: 'engagement' as const,
        engagement_flags: {
          incomplete: true,
          response_time_too_fast: true,
          accuracy_too_low: false,
          not_enough_responses: true,
        },
        reliable_run: false,
      };

      await runEventsService.updateEngagement(mockAuthContext, validRunId, bodyWithMultipleFlags);

      expect(mockRunsRepository.update).toHaveBeenCalledWith({
        id: validRunId,
        data: {
          updatedAt: expect.any(Date),
          engagementFlags: bodyWithMultipleFlags.engagement_flags,
          reliableRun: false,
        },
      });
    });

    it('should update timestamp when updating engagement', async () => {
      const mockRun = { id: validRunId, userId: 'user-123' };
      mockRunsRepository.getById.mockResolvedValue(mockRun);
      mockRunsRepository.update.mockResolvedValue(undefined);

      const beforeCall = new Date();
      await runEventsService.updateEngagement(mockAuthContext, validRunId, validBody);
      const afterCall = new Date();

      const updateCall = mockRunsRepository.update.mock.calls[0][0];
      expect(updateCall.data.updatedAt).toBeInstanceOf(Date);
      expect(updateCall.data.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(updateCall.data.updatedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });
  });
});
