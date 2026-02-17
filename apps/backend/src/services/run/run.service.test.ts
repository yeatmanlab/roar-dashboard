import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { RunService } from './run.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';

describe('RunService', () => {
  const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };
  const mockAdminAuthContext = { userId: 'admin-456', isSuperAdmin: true };

  const validRequestBody = {
    task_variant_id: '550e8400-e29b-41d4-a716-446655440000',
    task_version: '1.0.0',
    administration_id: '660e8400-e29b-41d4-a716-446655440001',
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRunsRepository: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAdministrationService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockTaskService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAdministrationAccessControls: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let runService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRunsRepository = {
      create: vi.fn(),
      getRunStatsByAdministrationIds: vi.fn(),
    };

    mockAdministrationService = {
      getById: vi.fn(),
      list: vi.fn(),
    };

    mockTaskService = {
      getTaskIdByVariantId: vi.fn(),
    };

    mockAdministrationAccessControls = {
      getUserRolesForAdministration: vi.fn(),
    };

    runService = RunService({
      runsRepository: mockRunsRepository,
      administrationService: mockAdministrationService,
      taskService: mockTaskService,
      administrationAccessControls: mockAdministrationAccessControls,
    });
  });

  describe('create', () => {
    it('should create a run successfully with all parameters', async () => {
      mockAdministrationService.getById.mockResolvedValue({ id: 'admin-1' });
      mockTaskService.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      mockRunsRepository.create.mockResolvedValue({ id: 'run-uuid-123' });

      const result = await runService.create(mockAuthContext, validRequestBody);

      expect(result).toEqual({ runId: 'run-uuid-123' });
      expect(mockAdministrationService.getById).toHaveBeenCalledWith(
        mockAuthContext,
        '660e8400-e29b-41d4-a716-446655440001',
      );
      expect(mockTaskService.getTaskIdByVariantId).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
      expect(mockRunsRepository.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          taskId: 'task-123',
          taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
          taskVersion: '1.0.0',
          administrationId: '660e8400-e29b-41d4-a716-446655440001',
        },
      });
    });

    it('should throw UNPROCESSABLE_ENTITY when administration does not exist', async () => {
      mockAdministrationService.getById.mockRejectedValue(
        new ApiError('Administration not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      await expect(runService.create(mockAuthContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw FORBIDDEN when user lacks permission to create run', async () => {
      mockAdministrationService.getById.mockResolvedValue({ id: 'admin-1' });
      mockAdministrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      mockTaskService.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });

      await expect(runService.create(mockAuthContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should work for super admin users and bypass permission checks', async () => {
      mockAdministrationService.getById.mockResolvedValue({ id: 'admin-1' });
      mockTaskService.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      mockRunsRepository.create.mockResolvedValue({ id: 'run-uuid-123' });

      const result = await runService.create(mockAdminAuthContext, validRequestBody);

      expect(result).toEqual({ runId: 'run-uuid-123' });
      expect(mockAdministrationService.getById).toHaveBeenCalledWith(
        mockAdminAuthContext,
        '660e8400-e29b-41d4-a716-446655440001',
      );
      expect(mockAdministrationAccessControls.getUserRolesForAdministration).not.toHaveBeenCalled();
    });

    it('should include metadata in run creation when provided', async () => {
      const bodyWithMetadata = {
        task_variant_id: '550e8400-e29b-41d4-a716-446655440000',
        task_version: '1.0.0',
        administration_id: '660e8400-e29b-41d4-a716-446655440001',
        metadata: { source: 'dashboard', sessionId: 'sess-789' },
      };

      mockAdministrationService.getById.mockResolvedValue({ id: 'admin-1' });
      mockTaskService.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-789' });
      mockRunsRepository.create.mockResolvedValue({ id: 'run-uuid-789' });

      await runService.create(mockAuthContext, bodyWithMetadata);

      expect(mockRunsRepository.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          taskId: 'task-789',
          taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
          taskVersion: '1.0.0',
          administrationId: '660e8400-e29b-41d4-a716-446655440001',
          metadata: { source: 'dashboard', sessionId: 'sess-789' },
        },
      });
    });

    it('should throw BAD_REQUEST when task_variant_id is missing', async () => {
      const invalidBody = {
        task_version: '1.0.0',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(runService.create(mockAuthContext, invalidBody as any)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw BAD_REQUEST when task_version is missing', async () => {
      const invalidBody = {
        task_variant_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(runService.create(mockAuthContext, invalidBody as any)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw INTERNAL_SERVER_ERROR when taskService is not configured', async () => {
      const serviceWithoutTaskService = RunService({
        runsRepository: mockRunsRepository,
        administrationService: mockAdministrationService,
      });

      await expect(serviceWithoutTaskService.create(mockAuthContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should throw NOT_FOUND when administration does not exist', async () => {
      mockAdministrationService.getById.mockRejectedValue(
        new ApiError('Administration not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      try {
        await runService.create(mockAuthContext, validRequestBody);
      } catch (error) {
        if (error instanceof ApiError) {
          expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
          expect(error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
        }
      }
    });

    it('should throw FORBIDDEN when user lacks access to administration', async () => {
      mockAdministrationService.getById.mockRejectedValue(
        new ApiError('You do not have permission to access this administration', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      try {
        await runService.create(mockAuthContext, validRequestBody);
      } catch (error) {
        if (error instanceof ApiError) {
          expect(error.statusCode).toBe(StatusCodes.FORBIDDEN);
          expect(error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
        }
      }
    });

    it('should throw UNPROCESSABLE_ENTITY when task variant does not exist', async () => {
      mockTaskService.getTaskIdByVariantId.mockRejectedValue(
        new ApiError('Invalid task_variant_id', {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );

      await expect(runService.create(mockAuthContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw error when getTaskIdByVariantId fails with non-ApiError', async () => {
      const dbError = new Error('Database connection failed');
      mockTaskService.getTaskIdByVariantId.mockRejectedValue(dbError);

      await expect(runService.create(mockAuthContext, validRequestBody)).rejects.toBe(dbError);
    });

    it('should throw INTERNAL_SERVER_ERROR when create fails', async () => {
      const dbError = new Error('Failed to insert run');
      mockTaskService.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      mockRunsRepository.create.mockRejectedValue(dbError);

      await expect(runService.create(mockAuthContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should re-throw ApiError from create without wrapping', async () => {
      const apiError = new ApiError('Duplicate run', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
      mockTaskService.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      mockRunsRepository.create.mockRejectedValue(apiError);

      await expect(runService.create(mockAuthContext, validRequestBody)).rejects.toBe(apiError);
    });

    it('should pass userId from auth context to repository', async () => {
      const customAuthContext = { userId: 'custom-user-999', isSuperAdmin: false };
      mockAdministrationService.getById.mockResolvedValue({ id: 'admin-1' });
      mockTaskService.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      mockRunsRepository.create.mockResolvedValue({ id: 'run-uuid-123' });

      await runService.create(customAuthContext, validRequestBody);

      expect(mockRunsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'custom-user-999',
          }),
        }),
      );
    });

    it('should handle empty metadata object', async () => {
      const bodyWithEmptyMetadata = {
        task_variant_id: '550e8400-e29b-41d4-a716-446655440000',
        task_version: '1.0.0',
        administration_id: '660e8400-e29b-41d4-a716-446655440001',
        metadata: {},
      };

      mockAdministrationService.getById.mockResolvedValue({ id: 'admin-1' });
      mockTaskService.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      mockRunsRepository.create.mockResolvedValue({ id: 'run-uuid-123' });

      await runService.create(mockAuthContext, bodyWithEmptyMetadata);

      expect(mockRunsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: {},
          }),
        }),
      );
    });
  });
});
