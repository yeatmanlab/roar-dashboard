import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { RunService } from './run.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import type { AuthContext } from '../../types/auth-context';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import type {
  MockRunRepository,
  MockTaskVariantRepository,
  MockFamilyRepository,
} from '../../test-support/repositories';
import {
  createMockRunRepository,
  createMockTaskVariantRepository,
  createMockFamilyRepository,
} from '../../test-support/repositories';
import type { MockAdministrationService, MockAuthorizationService } from '../../test-support/services';
import { createMockAdministrationService, createMockAuthorizationService } from '../../test-support/services';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { ANONYMOUS_RUN_ADMINISTRATION_ID } from '../../constants/run';
import { FgaType, FgaRelation } from '../authorization/fga-constants';

describe('RunService', () => {
  let authContext: AuthContext;
  let runRepository: MockRunRepository;
  let administrationService: MockAdministrationService;
  let authorizationService: MockAuthorizationService;
  let familyRepository: MockFamilyRepository;
  let runService: ReturnType<typeof RunService>;
  let taskVariantRepository: MockTaskVariantRepository;

  const validRequestBody = {
    taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
    taskVersion: '1.0.0',
    administrationId: '660e8400-e29b-41d4-a716-446655440001',
    isAnonymous: false as const,
  };
  const targetUserId = 'target-user-456';

  beforeEach(() => {
    vi.clearAllMocks();

    authContext = { userId: 'user-123', isSuperAdmin: false };

    runRepository = createMockRunRepository();

    administrationService = createMockAdministrationService();

    taskVariantRepository = createMockTaskVariantRepository();

    authorizationService = createMockAuthorizationService();
    // Mock the family access check for tests where userId !== targetUserId
    authorizationService.hasAnyPermission.mockResolvedValue(true);

    familyRepository = createMockFamilyRepository();
    // Mock target user belonging to a family
    familyRepository.getFamilyIdsForUser.mockResolvedValue(['family-123']);

    runService = RunService({
      runRepository,
      administrationService,
      taskVariantRepository,
      authorizationService,
      familyRepository,
    });
  });

  describe('create', () => {
    it('should create a run successfully with all parameters', async () => {
      administrationService.verifyAdministrationAccess.mockResolvedValue(AdministrationFactory.build());
      taskVariantRepository.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runRepository.create.mockResolvedValue({ id: 'run-uuid-123' });

      const result = await runService.create(authContext, targetUserId, validRequestBody);

      expect(result).toEqual({ id: 'run-uuid-123' });
      expect(administrationService.verifyAdministrationAccess).toHaveBeenCalledWith(
        { userId: 'user-123', isSuperAdmin: false },
        '660e8400-e29b-41d4-a716-446655440001',
      );
      expect(authorizationService.requirePermission).toHaveBeenCalledWith(
        'user-123',
        FgaRelation.CAN_CREATE_RUN,
        `${FgaType.ADMINISTRATION}:${validRequestBody.administrationId}`,
      );
      expect(taskVariantRepository.getTaskIdByVariantId).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
      expect(runRepository.create).toHaveBeenCalledWith({
        data: {
          userId: targetUserId,
          taskId: 'task-123',
          taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
          taskVersion: '1.0.0',
          administrationId: '660e8400-e29b-41d4-a716-446655440001',
          isAnonymous: false,
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

      await expect(runService.create(authContext, targetUserId, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw FORBIDDEN when user lacks permission to create run', async () => {
      administrationService.verifyAdministrationAccess.mockResolvedValue(AdministrationFactory.build());
      authorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      await expect(runService.create(authContext, targetUserId, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should work for super admin users and bypass permission checks', async () => {
      const superAdminContext = { userId: 'user-123', isSuperAdmin: true };
      administrationService.verifyAdministrationAccess.mockResolvedValue(AdministrationFactory.build());
      taskVariantRepository.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runRepository.create.mockResolvedValue({ id: 'run-uuid-123' });

      const result = await runService.create(superAdminContext, targetUserId, validRequestBody);

      expect(result).toEqual({ id: 'run-uuid-123' });
      expect(administrationService.verifyAdministrationAccess).toHaveBeenCalledWith(
        superAdminContext,
        '660e8400-e29b-41d4-a716-446655440001',
      );
      expect(authorizationService.requirePermission).not.toHaveBeenCalled();
    });

    it('should include metadata in run creation when provided', async () => {
      const bodyWithMetadata = {
        taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
        taskVersion: '1.0.0',
        administrationId: '660e8400-e29b-41d4-a716-446655440001',
        isAnonymous: false as const,
        metadata: { source: 'dashboard', sessionId: 'sess-789' },
      };

      administrationService.verifyAdministrationAccess.mockResolvedValue(AdministrationFactory.build());
      authorizationService.requirePermission.mockResolvedValue(undefined);
      taskVariantRepository.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-789' });
      runRepository.create.mockResolvedValue({ id: 'run-uuid-789' });

      await runService.create(authContext, targetUserId, bodyWithMetadata);

      expect(runRepository.create).toHaveBeenCalledWith({
        data: {
          userId: targetUserId,
          taskId: 'task-789',
          taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
          taskVersion: '1.0.0',
          administrationId: '660e8400-e29b-41d4-a716-446655440001',
          isAnonymous: false,
          metadata: { source: 'dashboard', sessionId: 'sess-789' },
        },
      });
    });

    it('should throw UNPROCESSABLE_ENTITY when taskVariantRepository is not configured', async () => {
      const serviceWithoutTaskVariantRepository = RunService({
        runRepository,
        administrationService,
        authorizationService,
      });

      administrationService.verifyAdministrationAccess.mockResolvedValue(AdministrationFactory.build());
      authorizationService.requirePermission.mockResolvedValue(undefined);

      await expect(
        serviceWithoutTaskVariantRepository.create(authContext, targetUserId, validRequestBody),
      ).rejects.toThrow();
    });

    it('should throw FORBIDDEN when user lacks access to administration', async () => {
      administrationService.verifyAdministrationAccess.mockRejectedValue(
        new ApiError('You do not have permission to access this administration', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      await expect(runService.create(authContext, targetUserId, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should throw UNPROCESSABLE_ENTITY when task variant does not exist', async () => {
      administrationService.verifyAdministrationAccess.mockResolvedValue(AdministrationFactory.build());
      authorizationService.requirePermission.mockResolvedValue(undefined);
      taskVariantRepository.getTaskIdByVariantId.mockRejectedValue(
        new ApiError('Invalid task_variant_id', {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );

      await expect(runService.create(authContext, targetUserId, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw INTERNAL_SERVER_ERROR when getTaskIdByVariantId fails with non-ApiError', async () => {
      const dbError = new Error('Database connection failed');
      administrationService.verifyAdministrationAccess.mockResolvedValue(AdministrationFactory.build());
      authorizationService.requirePermission.mockResolvedValue(undefined);
      taskVariantRepository.getTaskIdByVariantId.mockRejectedValue(dbError);

      await expect(runService.create(authContext, targetUserId, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should throw INTERNAL_SERVER_ERROR when create fails', async () => {
      const dbError = new Error('Failed to insert run');
      administrationService.verifyAdministrationAccess.mockResolvedValue(AdministrationFactory.build());
      authorizationService.requirePermission.mockResolvedValue(undefined);
      taskVariantRepository.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runRepository.create.mockRejectedValue(dbError);

      await expect(runService.create(authContext, targetUserId, validRequestBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should create an anonymous run successfully without administrationId', async () => {
      taskVariantRepository.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runRepository.create.mockResolvedValue({ id: 'run-anon-123' });

      const result = await runService.create(authContext, targetUserId, {
        taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
        taskVersion: '1.0.0',
        isAnonymous: true,
      });

      expect(result).toEqual({ id: 'run-anon-123' });
      expect(runRepository.create).toHaveBeenCalledWith({
        data: {
          userId: targetUserId,
          taskId: 'task-123',
          taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
          taskVersion: '1.0.0',
          administrationId: ANONYMOUS_RUN_ADMINISTRATION_ID,
          isAnonymous: true,
        },
      });
    });

    it('should skip administration access verification for anonymous runs', async () => {
      taskVariantRepository.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runRepository.create.mockResolvedValue({ id: 'run-anon-123' });

      await runService.create(authContext, targetUserId, {
        taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
        taskVersion: '1.0.0',
        isAnonymous: true,
      });

      expect(administrationService.verifyAdministrationAccess).not.toHaveBeenCalled();
    });

    it('should re-throw ApiError from create without wrapping', async () => {
      const apiError = new ApiError('Duplicate run', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
      administrationService.verifyAdministrationAccess.mockResolvedValue(AdministrationFactory.build());
      authorizationService.requirePermission.mockResolvedValue(undefined);
      taskVariantRepository.getTaskIdByVariantId.mockResolvedValue({ taskId: 'task-123' });
      runRepository.create.mockRejectedValue(apiError);

      await expect(runService.create(authContext, targetUserId, validRequestBody)).rejects.toBe(apiError);
    });
  });
});
