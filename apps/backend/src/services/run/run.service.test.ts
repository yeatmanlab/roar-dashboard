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
  let runRepository: MockRunRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let administrationService: MockedObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let administrationAccessControls: MockedObject<any>;
  let runService: ReturnType<typeof RunService>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let taskVariantRepository: MockedObject<any>;

  const validRequestBody = {
    taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
    taskVersion: '1.0.0',
    administrationId: '660e8400-e29b-41d4-a716-446655440001',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    authContext = { userId: 'user-123', isSuperAdmin: false };

    runRepository = createMockRunRepository();

    administrationService = {
      verifyAdministrationAccess: vi.fn(),
    };

    taskVariantRepository = {
      getTaskIdByVariantId: vi.fn(),
    };

    administrationAccessControls = {
      getUserRolesForAdministration: vi.fn(),
    };

    runService = RunService({
      runRepository: runRepository,
      administrationService: administrationService,
      taskVariantRepository: taskVariantRepository,
      administrationAccessControls: administrationAccessControls,
    });
  });

  describe('create', () => {
    it('should create a run successfully with all parameters', async () => {
      administrationService.verifyAdministrationAccess.mockResolvedValue(undefined);
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      taskVariantRepository.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runRepository.create.mockResolvedValue({ id: 'run-uuid-123' });

      const result = await runService.create(authContext, validRequestBody);

      expect(result).toEqual({ id: 'run-uuid-123' });
      expect(administrationService.verifyAdministrationAccess).toHaveBeenCalledWith(
        { userId: 'user-123', isSuperAdmin: false },
        '660e8400-e29b-41d4-a716-446655440001',
      );
      expect(administrationAccessControls.getUserRolesForAdministration).toHaveBeenCalledWith(
        'user-123',
        '660e8400-e29b-41d4-a716-446655440001',
      );
      expect(taskVariantRepository.getTaskIdByVariantId).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
      expect(runRepository.create).toHaveBeenCalledWith({
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
      administrationService.verifyAdministrationAccess.mockRejectedValue(
        new ApiError('Administration not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      await expect(runService.create(authContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw FORBIDDEN when user lacks permission to create run', async () => {
      administrationService.verifyAdministrationAccess.mockResolvedValue(undefined);
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['teacher']);
      taskVariantRepository.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });

      await expect(runService.create(authContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should work for super admin users and bypass permission checks', async () => {
      const superAdminContext = { userId: 'user-123', isSuperAdmin: true };
      administrationService.verifyAdministrationAccess.mockResolvedValue(undefined);
      taskVariantRepository.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runRepository.create.mockResolvedValue({ id: 'run-uuid-123' });

      const result = await runService.create(superAdminContext, validRequestBody);

      expect(result).toEqual({ id: 'run-uuid-123' });
      expect(administrationService.verifyAdministrationAccess).toHaveBeenCalledWith(
        superAdminContext,
        '660e8400-e29b-41d4-a716-446655440001',
      );
      expect(administrationAccessControls.getUserRolesForAdministration).not.toHaveBeenCalled();
    });

    it('should include metadata in run creation when provided', async () => {
      const bodyWithMetadata = {
        taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
        taskVersion: '1.0.0',
        administrationId: '660e8400-e29b-41d4-a716-446655440001',
        metadata: { source: 'dashboard', sessionId: 'sess-789' },
      };

      administrationService.verifyAdministrationAccess.mockResolvedValue(undefined);
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      taskVariantRepository.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-789' });
      runRepository.create.mockResolvedValue({ id: 'run-uuid-789' });

      await runService.create(authContext, bodyWithMetadata);

      expect(runRepository.create).toHaveBeenCalledWith({
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

    it('should throw UNPROCESSABLE_ENTITY when taskVariantRepository is not configured', async () => {
      const serviceWithoutTaskVariantRepository = RunService({
        runRepository: runRepository,
        administrationService: administrationService,
        administrationAccessControls: administrationAccessControls,
      });

      administrationService.verifyAdministrationAccess.mockResolvedValue(undefined);
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);

      await expect(serviceWithoutTaskVariantRepository.create(authContext, validRequestBody)).rejects.toThrow();
    });

    it('should throw FORBIDDEN when user lacks access to administration', async () => {
      administrationService.verifyAdministrationAccess.mockRejectedValue(
        new ApiError('You do not have permission to access this administration', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      await expect(runService.create(authContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should throw UNPROCESSABLE_ENTITY when task variant does not exist', async () => {
      administrationService.verifyAdministrationAccess.mockResolvedValue(undefined);
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      taskVariantRepository.getTaskIdByVariantId.mockRejectedValue(
        new ApiError('Invalid task_variant_id', {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );

      await expect(runService.create(authContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw INTERNAL_SERVER_ERROR when getTaskIdByVariantId fails with non-ApiError', async () => {
      const dbError = new Error('Database connection failed');
      administrationService.verifyAdministrationAccess.mockResolvedValue(undefined);
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      taskVariantRepository.getTaskIdByVariantId.mockRejectedValue(dbError);

      await expect(runService.create(authContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should throw INTERNAL_SERVER_ERROR when create fails', async () => {
      const dbError = new Error('Failed to insert run');
      administrationService.verifyAdministrationAccess.mockResolvedValue(undefined);
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      taskVariantRepository.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runRepository.create.mockRejectedValue(dbError);

      await expect(runService.create(authContext, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should re-throw ApiError from create without wrapping', async () => {
      const apiError = new ApiError('Duplicate run', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
      administrationService.verifyAdministrationAccess.mockResolvedValue(undefined);
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      taskVariantRepository.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runRepository.create.mockRejectedValue(apiError);

      await expect(runService.create(authContext, validRequestBody)).rejects.toBe(apiError);
    });

    it('should pass userId from auth context to repository', async () => {
      const customAuthContext = { userId: 'custom-user-999', isSuperAdmin: false };
      administrationService.verifyAdministrationAccess.mockResolvedValue(undefined);
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      taskVariantRepository.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runRepository.create.mockResolvedValue({ id: 'run-uuid-123' });

      await runService.create(customAuthContext, validRequestBody);

      expect(runRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'custom-user-999',
          }),
        }),
      );
    });

    it('should handle empty metadata object', async () => {
      const bodyWithEmptyMetadata = {
        taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
        taskVersion: '1.0.0',
        administrationId: '660e8400-e29b-41d4-a716-446655440001',
        metadata: {},
      };

      administrationService.verifyAdministrationAccess.mockResolvedValue(undefined);
      administrationAccessControls.getUserRolesForAdministration.mockResolvedValue(['student']);
      taskVariantRepository.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runRepository.create.mockResolvedValue({ id: 'run-uuid-123' });

      await runService.create(authContext, bodyWithEmptyMetadata);

      expect(runRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: {},
          }),
        }),
      );
    });
  });
});
