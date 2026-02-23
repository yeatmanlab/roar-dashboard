import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedObject } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { RunService } from './run.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import type { AuthContext } from '../../types/auth-context';
import { MockRunRepository, createMockRunRepository } from '../../test-support/repositories';

describe('RunService', () => {
  let authContext: AuthContext;
  let runsRepository: MockRunRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let administrationService: MockedObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let administrationAccessControls: MockedObject<any>;
  let runsService: ReturnType<typeof RunService>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let taskService: MockedObject<any>;

  const validRequestBody = {
    task_variant_id: '550e8400-e29b-41d4-a716-446655440000',
    task_version: '1.0.0',
    administration_id: '660e8400-e29b-41d4-a716-446655440001',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    authContext = { userId: 'user-123', isSuperAdmin: false };

    runsRepository = createMockRunRepository();

    administrationService = {
      getById: vi.fn(),
      list: vi.fn(),
    };

    taskService = {
      getTaskIdByVariantId: vi.fn(),
    };

    administrationAccessControls = {
      getUserRolesForAdministration: vi.fn(),
    };

    runsService = RunService({
      runsRepository: runsRepository,
      administrationService: administrationService,
      taskService: taskService,
      administrationAccessControls: administrationAccessControls,
    });
  });

  describe('create', () => {
    it('should create a run successfully with all parameters', async () => {
      administrationService.getById.mockResolvedValue({ id: 'admin-1' });
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      taskService.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runsRepository.create.mockResolvedValue({ id: 'run-uuid-123' });

      const result = await runsService.create(authContext, validRequestBody);

      expect(result).toEqual({ runId: 'run-uuid-123' });
      expect(administrationService.getById).toHaveBeenCalledWith(authContext, '660e8400-e29b-41d4-a716-446655440001');
      expect(administrationAccessControls.getUserRolesForAdministration).toHaveBeenCalledWith(
        'user-123',
        '660e8400-e29b-41d4-a716-446655440001',
      );
      expect(taskService.getTaskIdByVariantId).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
      expect(runsRepository.create).toHaveBeenCalledWith({
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
      administrationService.getById.mockRejectedValue(
        new ApiError('Administration not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      await expect(runsService.create(authContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw FORBIDDEN when user lacks permission to create run', async () => {
      administrationService.getById.mockResolvedValue({ id: 'admin-1' });
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['teacher']);
      taskService.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });

      await expect(runsService.create(authContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should work for super admin users and bypass permission checks', async () => {
      const superAdminContext = { userId: 'user-123', isSuperAdmin: true };
      administrationService.getById.mockResolvedValue({ id: 'admin-1' });
      taskService.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runsRepository.create.mockResolvedValue({ id: 'run-uuid-123' });

      const result = await runsService.create(superAdminContext, validRequestBody);

      expect(result).toEqual({ runId: 'run-uuid-123' });
      expect(administrationService.getById).toHaveBeenCalledWith(
        superAdminContext,
        '660e8400-e29b-41d4-a716-446655440001',
      );
      expect(administrationAccessControls.getUserRolesForAdministration).not.toHaveBeenCalled();
    });

    it('should include metadata in run creation when provided', async () => {
      const bodyWithMetadata = {
        task_variant_id: '550e8400-e29b-41d4-a716-446655440000',
        task_version: '1.0.0',
        administration_id: '660e8400-e29b-41d4-a716-446655440001',
        metadata: { source: 'dashboard', sessionId: 'sess-789' },
      };

      administrationService.getById.mockResolvedValue({ id: 'admin-1' });
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      taskService.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-789' });
      runsRepository.create.mockResolvedValue({ id: 'run-uuid-789' });

      await runsService.create(authContext, bodyWithMetadata);

      expect(runsRepository.create).toHaveBeenCalledWith({
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

    it('should throw INTERNAL_SERVER_ERROR when taskService is not configured', async () => {
      const serviceWithoutTaskService = RunService({
        runsRepository: runsRepository,
        administrationService: administrationService,
        administrationAccessControls: administrationAccessControls,
      });

      await expect(serviceWithoutTaskService.create(authContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should throw FORBIDDEN when user lacks access to administration', async () => {
      administrationService.getById.mockRejectedValue(
        new ApiError('You do not have permission to access this administration', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      await expect(runsService.create(authContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should throw UNPROCESSABLE_ENTITY when task variant does not exist', async () => {
      administrationService.getById.mockResolvedValue({ id: 'admin-1' });
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      taskService.getTaskIdByVariantId.mockRejectedValue(
        new ApiError('Invalid task_variant_id', {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );

      await expect(runsService.create(authContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw error when getTaskIdByVariantId fails with non-ApiError', async () => {
      const dbError = new Error('Database connection failed');
      administrationService.getById.mockResolvedValue({ id: 'admin-1' });
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      taskService.getTaskIdByVariantId.mockRejectedValue(dbError);

      await expect(runsService.create(authContext, validRequestBody)).rejects.toBe(dbError);
    });

    it('should throw INTERNAL_SERVER_ERROR when create fails', async () => {
      const dbError = new Error('Failed to insert run');
      administrationService.getById.mockResolvedValue({ id: 'admin-1' });
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      taskService.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runsRepository.create.mockRejectedValue(dbError);

      await expect(runsService.create(authContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should re-throw ApiError from create without wrapping', async () => {
      const apiError = new ApiError('Duplicate run', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
      administrationService.getById.mockResolvedValue({ id: 'admin-1' });
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      taskService.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runsRepository.create.mockRejectedValue(apiError);

      await expect(runsService.create(authContext, validRequestBody)).rejects.toBe(apiError);
    });

    it('should pass userId from auth context to repository', async () => {
      const customAuthContext = { userId: 'custom-user-999', isSuperAdmin: false };
      administrationService.getById.mockResolvedValue({ id: 'admin-1' });
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      taskService.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runsRepository.create.mockResolvedValue({ id: 'run-uuid-123' });

      await runsService.create(customAuthContext, validRequestBody);

      expect(runsRepository.create).toHaveBeenCalledWith(
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

      administrationService.getById.mockResolvedValue({ id: 'admin-1' });
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      taskService.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runsRepository.create.mockResolvedValue({ id: 'run-uuid-123' });

      await runsService.create(authContext, bodyWithEmptyMetadata);

      expect(runsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: {},
          }),
        }),
      );
    });
  });
});
