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
});
