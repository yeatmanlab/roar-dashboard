import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import type { UpdateUserRequestBody, AdministrationsListQuery } from '@roar-dashboard/api-contract';
import { UserFactory, AuthContextFactory } from '../test-support/factories/user.factory';
import { AdministrationWithEmbedsFactory } from '../test-support/factories/administration.factory';
import { MockedUserService } from '../test-support/services/user.service';
import { MockAdministrationService } from '../test-support/services/administration.service';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { ApiErrorMessage } from '../enums/api-error-message.enum';

// Mock the UserService module
vi.mock('../services/user', () => ({
  UserService: vi.fn(),
}));

// Mock the AdministrationService module
vi.mock('../services/administration/administration.service', () => ({
  AdministrationService: vi.fn(),
}));

import { UserService } from '../services/user';
import { AdministrationService } from '../services/administration/administration.service';

/**
 * Type-safe assertion helper for success responses.
 * Asserts the status is OK and returns the data with proper typing.
 */
function expectOkResponse<T>(result: { status: number; body: { data: T } | { error: unknown } }): T {
  expect(result.status).toBe(StatusCodes.OK);
  expect(result.body).toHaveProperty('data');
  return (result.body as { data: T }).data;
}

/**
 * Type-safe assertion helper for error responses.
 */
function expectErrorResponse(
  result: { status: number; body: { data: unknown } | { error: unknown } },
  expectedStatus: number,
) {
  expect(result.status).toBe(expectedStatus);
  expect(result.body).toHaveProperty('error');
  return (result.body as { error: { message: string; code?: string; traceId?: string } }).error;
}

describe('UsersController', () => {
  const mockGetById = vi.fn();
  const mockUpdate = vi.fn();
  const mockRecordUserAgreement = vi.fn();
  const mockGetUserAdministrations = vi.fn();
  const mockAuthContext = AuthContextFactory.build({ userId: 'user-123', isSuperAdmin: false });

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock UserService
    vi.mocked(UserService).mockReturnValue({
      findByAuthId: vi.fn(),
      getById: mockGetById,
      update: mockUpdate,
      recordUserAgreement: mockRecordUserAgreement,
    } as MockedUserService);

    // Setup the mock AdministrationService
    vi.mocked(AdministrationService).mockReturnValue({
      verifyAdministrationAccess: vi.fn(),
      list: vi.fn(),
      getById: vi.fn(),
      getAssignees: vi.fn(),
      listTaskVariants: vi.fn(),
      listAgreements: vi.fn(),
      deleteById: vi.fn(),
      getUserAdministrations: mockGetUserAdministrations,
    } as MockAdministrationService);
  });

  describe('get', () => {
    it('should return user with 200 status when found and authorized', async () => {
      const mockUser = UserFactory.build({
        id: 'user-456',
        nameFirst: 'John',
        nameLast: 'Doe',
        userType: 'student',
        email: 'john.doe@example.com',
        createdAt: new Date('2024-01-01T10:00:00.000Z'),
        updatedAt: new Date('2024-01-02T15:30:00.000Z'),
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-456');

      const data = expectOkResponse(result);
      expect(data).toMatchObject({
        id: 'user-456',
        nameFirst: 'John',
        nameLast: 'Doe',
        userType: 'student',
        email: 'john.doe@example.com',
      });
      expect(mockGetById).toHaveBeenCalledWith(mockAuthContext, 'user-456');
    });

    it('should transform Date fields to ISO datetime strings', async () => {
      const mockUser = UserFactory.build({
        id: 'user-789',
        createdAt: new Date('2024-01-15T08:30:00.000Z'),
        updatedAt: new Date('2024-01-20T14:45:00.000Z'),
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-789');

      const data = expectOkResponse(result);
      expect(data.createdAt).toBe('2024-01-15T08:30:00.000Z');
      expect(data.updatedAt).toBe('2024-01-20T14:45:00.000Z');
    });

    it('should handle null updatedAt field', async () => {
      const mockUser = UserFactory.build({
        id: 'user-101',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: null,
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-101');

      const data = expectOkResponse(result);
      expect(data.updatedAt).toBeNull();
    });

    it('should transform all user fields correctly', async () => {
      const mockUser = UserFactory.build({
        id: 'user-full',
        assessmentPid: 'PID123',
        authProvider: ['google', 'password'],
        nameFirst: 'Jane',
        nameMiddle: 'M',
        nameLast: 'Smith',
        username: 'jsmith',
        email: 'jane.smith@example.com',
        userType: 'educator',
        dob: '1990-05-15',
        grade: '5',
        schoolLevel: 'elementary',
        statusEll: 'active',
        statusFrl: 'Reduced',
        statusIep: 'yes',
        studentId: 'STU001',
        sisId: 'SIS002',
        stateId: 'STATE003',
        localId: 'LOCAL004',
        gender: 'female',
        race: 'asian',
        hispanicEthnicity: false,
        homeLanguage: 'English',
        isSuperAdmin: false,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-full');

      const data = expectOkResponse(result);
      expect(data).toMatchObject({
        id: 'user-full',
        assessmentPid: 'PID123',
        authProvider: ['google', 'password'],
        nameFirst: 'Jane',
        nameMiddle: 'M',
        nameLast: 'Smith',
        username: 'jsmith',
        email: 'jane.smith@example.com',
        userType: 'educator',
        dob: '1990-05-15',
        grade: '5',
        schoolLevel: 'elementary',
        statusEll: 'active',
        statusFrl: 'Reduced',
        statusIep: 'yes',
        studentId: 'STU001',
        sisId: 'SIS002',
        stateId: 'STATE003',
        localId: 'LOCAL004',
        gender: 'female',
        race: 'asian',
        hispanicEthnicity: false,
        homeLanguage: 'English',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      });
      // Verify isSuperAdmin is NOT included for non-super admin requesters (security)
      expect(data).not.toHaveProperty('isSuperAdmin');
    });

    it('should handle null optional fields', async () => {
      const mockUser = UserFactory.build({
        id: 'user-minimal',
        nameFirst: null,
        nameMiddle: null,
        nameLast: null,
        username: null,
        email: null,
        dob: null,
        grade: null,
        schoolLevel: null,
        updatedAt: null,
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-minimal');

      const data = expectOkResponse(result);
      expect(data.nameFirst).toBeNull();
      expect(data.nameMiddle).toBeNull();
      expect(data.nameLast).toBeNull();
      expect(data.username).toBeNull();
      expect(data.email).toBeNull();
      expect(data.dob).toBeNull();
      expect(data.grade).toBeNull();
      expect(data.schoolLevel).toBeNull();
      expect(data.updatedAt).toBeNull();
    });

    it('should return empty array when authProvider is null in database', async () => {
      const mockUser = UserFactory.build({
        id: 'user-no-auth',
        authProvider: null,
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-no-auth');

      const data = expectOkResponse(result);
      expect(data.authProvider).toEqual([]);
    });

    it('should pass auth context and userId to service', async () => {
      const mockUser = UserFactory.build();
      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const authContext = AuthContextFactory.build({ userId: 'requester-123', isSuperAdmin: true });
      await Controller.get(authContext, 'target-user-456');

      expect(mockGetById).toHaveBeenCalledWith(authContext, 'target-user-456');
    });

    it('should return 401 when service throws UNAUTHORIZED ApiError', async () => {
      const error = new ApiError(ApiErrorMessage.UNAUTHORIZED, {
        statusCode: StatusCodes.UNAUTHORIZED,
        code: ApiErrorCode.AUTH_REQUIRED,
      });
      mockGetById.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-456');

      const errorBody = expectErrorResponse(result, StatusCodes.UNAUTHORIZED);
      expect(errorBody.message).toBe(ApiErrorMessage.UNAUTHORIZED);
      expect(errorBody.code).toBe(ApiErrorCode.AUTH_REQUIRED);
      expect(errorBody.traceId).toBeDefined();
    });

    it('should return 403 when service throws FORBIDDEN ApiError', async () => {
      const error = new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      mockGetById.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-456');

      const errorBody = expectErrorResponse(result, StatusCodes.FORBIDDEN);
      expect(errorBody.message).toBe(ApiErrorMessage.FORBIDDEN);
      expect(errorBody.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
      expect(errorBody.traceId).toBeDefined();
    });

    it('should return 404 when service throws NOT_FOUND ApiError', async () => {
      const error = new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
      mockGetById.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'non-existent-user');

      const errorBody = expectErrorResponse(result, StatusCodes.NOT_FOUND);
      expect(errorBody.message).toBe(ApiErrorMessage.NOT_FOUND);
      expect(errorBody.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      expect(errorBody.traceId).toBeDefined();
    });

    it('should return 500 when service throws INTERNAL_SERVER_ERROR ApiError', async () => {
      const error = new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockGetById.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-456');

      const errorBody = expectErrorResponse(result, StatusCodes.INTERNAL_SERVER_ERROR);
      expect(errorBody.message).toBe(ApiErrorMessage.INTERNAL_SERVER_ERROR);
      expect(errorBody.code).toBe(ApiErrorCode.DATABASE_QUERY_FAILED);
      expect(errorBody.traceId).toBeDefined();
    });

    it('should rethrow non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Unexpected error');
      mockGetById.mockRejectedValue(unexpectedError);

      const { UsersController: Controller } = await import('./users.controller');

      await expect(Controller.get(mockAuthContext, 'user-456')).rejects.toThrow('Unexpected error');
    });

    it('should handle user accessing their own profile (self-access)', async () => {
      const authContext = AuthContextFactory.build({ userId: 'self-user-123', isSuperAdmin: false });
      const mockUser = UserFactory.build({
        id: 'self-user-123',
        nameFirst: 'Self',
        nameLast: 'User',
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(authContext, 'self-user-123');

      const data = expectOkResponse(result);
      expect(data.id).toBe('self-user-123');
      expect(mockGetById).toHaveBeenCalledWith(authContext, 'self-user-123');
    });

    it('should handle super admin accessing any user', async () => {
      const authContext = AuthContextFactory.build({ userId: 'admin-123', isSuperAdmin: true });
      const mockUser = UserFactory.build({
        id: 'any-user-456',
        nameFirst: 'Any',
        nameLast: 'User',
        isSuperAdmin: false,
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(authContext, 'any-user-456');

      const data = expectOkResponse(result);
      expect(data.id).toBe('any-user-456');
      expect(mockGetById).toHaveBeenCalledWith(authContext, 'any-user-456');
      // Verify isSuperAdmin IS included for super admin requesters
      expect(data.isSuperAdmin).toBe(false);
    });

    it('should include isSuperAdmin field only when requester is a super admin', async () => {
      const superAdminContext = AuthContextFactory.build({ userId: 'admin-123', isSuperAdmin: true });
      const mockUser = UserFactory.build({
        id: 'target-user',
        isSuperAdmin: true,
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      // Super admin can see isSuperAdmin field
      const superAdminResult = await Controller.get(superAdminContext, 'target-user');
      const superAdminData = expectOkResponse(superAdminResult);
      expect(superAdminData.isSuperAdmin).toBe(true);
    });

    it('should exclude isSuperAdmin field when requester is not a super admin', async () => {
      const nonSuperAdminContext = AuthContextFactory.build({ userId: 'regular-user', isSuperAdmin: false });
      const mockUser = UserFactory.build({
        id: 'target-user',
        isSuperAdmin: true,
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      // Non-super admin cannot see isSuperAdmin field
      const regularResult = await Controller.get(nonSuperAdminContext, 'target-user');
      const regularData = expectOkResponse(regularResult);
      expect(regularData).not.toHaveProperty('isSuperAdmin');
    });
  });

  describe('update', () => {
    const superAdminContext = AuthContextFactory.build({ userId: 'admin-123', isSuperAdmin: true });
    const validBody: UpdateUserRequestBody = { nameFirst: 'Jane' };
    const targetUserId = 'user-456';

    it('should return 204 No Content on success', async () => {
      mockUpdate.mockResolvedValue(undefined);

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.update(superAdminContext, targetUserId, validBody);

      expect(result.status).toBe(StatusCodes.NO_CONTENT);
      expect(result.body).toBeUndefined();
    });

    it('should delegate to the service with the correct arguments', async () => {
      mockUpdate.mockResolvedValue(undefined);

      const { UsersController: Controller } = await import('./users.controller');
      await Controller.update(superAdminContext, targetUserId, validBody);

      expect(mockUpdate).toHaveBeenCalledWith(superAdminContext, targetUserId, validBody);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('should return 403 when service throws FORBIDDEN', async () => {
      const error = new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      mockUpdate.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.update(superAdminContext, targetUserId, validBody);

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      expect(result.body).toHaveProperty('error.message', ApiErrorMessage.FORBIDDEN);
      expect(result.body).toHaveProperty('error.code', ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('should return 404 when service throws NOT_FOUND', async () => {
      const error = new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
      mockUpdate.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.update(superAdminContext, targetUserId, validBody);

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      expect(result.body).toHaveProperty('error.message', ApiErrorMessage.NOT_FOUND);
      expect(result.body).toHaveProperty('error.code', ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('should return 409 when service throws CONFLICT', async () => {
      const error = new ApiError(ApiErrorMessage.CONFLICT, {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
      });
      mockUpdate.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.update(superAdminContext, targetUserId, validBody);

      expect(result.status).toBe(StatusCodes.CONFLICT);
      expect(result.body).toHaveProperty('error.message', ApiErrorMessage.CONFLICT);
      expect(result.body).toHaveProperty('error.code', ApiErrorCode.RESOURCE_CONFLICT);
    });

    it('should return 500 when service throws INTERNAL_SERVER_ERROR', async () => {
      const error = new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockUpdate.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.update(superAdminContext, targetUserId, validBody);

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.body).toHaveProperty('error.message', ApiErrorMessage.INTERNAL_SERVER_ERROR);
      expect(result.body).toHaveProperty('error.code', ApiErrorCode.DATABASE_QUERY_FAILED);
    });

    it('should re-throw non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Unexpected error');
      mockUpdate.mockRejectedValue(unexpectedError);

      const { UsersController: Controller } = await import('./users.controller');

      await expect(Controller.update(superAdminContext, targetUserId, validBody)).rejects.toThrow('Unexpected error');
    });
  });

  describe('recordUserAgreement', () => {
    const authContext = AuthContextFactory.build({ userId: 'user-123' });
    const targetUserId = 'target-456';
    const agreementVersionId = 'version-789';
    const validBody = { agreementVersionId };

    /**
     * Helper to expect 201 Created response with agreement ID
     */
    function expectCreatedResponse(result: { status: number; body: { data: { id: string } } | { error: unknown } }) {
      expect(result.status).toBe(StatusCodes.CREATED);
      expect(result.body).toHaveProperty('data');
      return (result.body as { data: { id: string } }).data;
    }

    it('should return 201 Created with agreement ID on success', async () => {
      const createdAgreementId = 'agreement-abc-123';
      mockRecordUserAgreement.mockResolvedValue({ id: createdAgreementId });

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.recordUserAgreement(authContext, targetUserId, validBody);

      const data = expectCreatedResponse(result);
      expect(data.id).toBe(createdAgreementId);
    });

    it('should delegate to the service with the correct arguments', async () => {
      mockRecordUserAgreement.mockResolvedValue({ id: 'agreement-123' });

      const { UsersController: Controller } = await import('./users.controller');
      await Controller.recordUserAgreement(authContext, targetUserId, validBody);

      expect(mockRecordUserAgreement).toHaveBeenCalledWith(authContext, targetUserId, validBody);
      expect(mockRecordUserAgreement).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when service throws REQUEST_VALIDATION_FAILED', async () => {
      const error = new ApiError(ApiErrorMessage.REQUEST_VALIDATION_FAILED, {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_INVALID,
      });
      mockRecordUserAgreement.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.recordUserAgreement(authContext, targetUserId, validBody);

      const errorBody = expectErrorResponse(result, StatusCodes.BAD_REQUEST);
      expect(errorBody.message).toBe(ApiErrorMessage.REQUEST_VALIDATION_FAILED);
      expect(errorBody.code).toBe(ApiErrorCode.REQUEST_INVALID);
      expect(errorBody.traceId).toBeDefined();
    });

    it('should return 401 when service throws UNAUTHORIZED', async () => {
      const error = new ApiError(ApiErrorMessage.UNAUTHORIZED, {
        statusCode: StatusCodes.UNAUTHORIZED,
        code: ApiErrorCode.AUTH_REQUIRED,
      });
      mockRecordUserAgreement.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.recordUserAgreement(authContext, targetUserId, validBody);

      const errorBody = expectErrorResponse(result, StatusCodes.UNAUTHORIZED);
      expect(errorBody.message).toBe(ApiErrorMessage.UNAUTHORIZED);
      expect(errorBody.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('should return 403 when service throws FORBIDDEN (wrong agreement type for age)', async () => {
      const error = new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      mockRecordUserAgreement.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.recordUserAgreement(authContext, targetUserId, validBody);

      const errorBody = expectErrorResponse(result, StatusCodes.FORBIDDEN);
      expect(errorBody.message).toBe(ApiErrorMessage.FORBIDDEN);
      expect(errorBody.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('should return 404 when target user does not exist', async () => {
      const error = new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
      mockRecordUserAgreement.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.recordUserAgreement(authContext, targetUserId, validBody);

      const errorBody = expectErrorResponse(result, StatusCodes.NOT_FOUND);
      expect(errorBody.message).toBe(ApiErrorMessage.NOT_FOUND);
      expect(errorBody.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('should return 404 when agreement version does not exist', async () => {
      const error = new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
      mockRecordUserAgreement.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.recordUserAgreement(authContext, targetUserId, {
        agreementVersionId: 'non-existent-version',
      });

      const errorBody = expectErrorResponse(result, StatusCodes.NOT_FOUND);
      expect(errorBody.message).toBe(ApiErrorMessage.NOT_FOUND);
    });

    it('should return 409 when service throws CONFLICT (duplicate agreement version)', async () => {
      const error = new ApiError(ApiErrorMessage.CONFLICT, {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
      });
      mockRecordUserAgreement.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.recordUserAgreement(authContext, targetUserId, validBody);

      const errorBody = expectErrorResponse(result, StatusCodes.CONFLICT);
      expect(errorBody.message).toBe(ApiErrorMessage.CONFLICT);
      expect(errorBody.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });

    it('should return 500 when service throws INTERNAL_SERVER_ERROR', async () => {
      const error = new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockRecordUserAgreement.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.recordUserAgreement(authContext, targetUserId, validBody);

      const errorBody = expectErrorResponse(result, StatusCodes.INTERNAL_SERVER_ERROR);
      expect(errorBody.message).toBe(ApiErrorMessage.INTERNAL_SERVER_ERROR);
      expect(errorBody.code).toBe(ApiErrorCode.DATABASE_QUERY_FAILED);
    });

    it('should re-throw non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Unexpected database connection error');
      mockRecordUserAgreement.mockRejectedValue(unexpectedError);

      const { UsersController: Controller } = await import('./users.controller');

      await expect(Controller.recordUserAgreement(authContext, targetUserId, validBody)).rejects.toThrow(
        'Unexpected database connection error',
      );
    });

    it('should handle self-consent scenario', async () => {
      const selfUserId = 'self-user-123';
      const selfAuthContext = AuthContextFactory.build({ userId: selfUserId });
      mockRecordUserAgreement.mockResolvedValue({ id: 'agreement-self-123' });

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.recordUserAgreement(selfAuthContext, selfUserId, validBody);

      const data = expectCreatedResponse(result);
      expect(data.id).toBe('agreement-self-123');
      expect(mockRecordUserAgreement).toHaveBeenCalledWith(selfAuthContext, selfUserId, validBody);
    });

    it('should handle parent consent scenario', async () => {
      const parentAuthContext = AuthContextFactory.build({ userId: 'parent-123' });
      const childUserId = 'child-456';
      mockRecordUserAgreement.mockResolvedValue({ id: 'agreement-parent-child-123' });

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.recordUserAgreement(parentAuthContext, childUserId, validBody);

      const data = expectCreatedResponse(result);
      expect(data.id).toBe('agreement-parent-child-123');
      expect(mockRecordUserAgreement).toHaveBeenCalledWith(parentAuthContext, childUserId, validBody);
    });
  });

  describe('listUserAdministrations', () => {
    const targetUserId = 'target-user-123';
    const defaultQuery: AdministrationsListQuery = {
      page: 1,
      perPage: 25,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      embed: [],
    };

    it('should return 200 with paginated administrations when successful', async () => {
      const mockAdmins = AdministrationWithEmbedsFactory.buildList(3, {
        id: 'admin-1',
        name: 'Test Admin 1',
        namePublic: 'Public Admin 1',
        dateStart: new Date('2024-01-01T00:00:00.000Z'),
        dateEnd: new Date('2024-12-31T23:59:59.999Z'),
        createdAt: new Date('2023-12-01T10:00:00.000Z'),
        isOrdered: true,
      });

      mockGetUserAdministrations.mockResolvedValue({
        items: mockAdmins,
        totalItems: 3,
      });

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.listUserAdministrations(mockAuthContext, targetUserId, defaultQuery);

      const data = expectOkResponse(result);
      expect(data.items).toHaveLength(3);
      expect(data.pagination).toEqual({
        page: 1,
        perPage: 25,
        totalItems: 3,
        totalPages: 1,
      });
    });

    it('should transform administration fields correctly', async () => {
      const mockAdmin = AdministrationWithEmbedsFactory.build({
        id: 'admin-transform',
        name: 'Internal Name',
        namePublic: 'Public Name',
        dateStart: new Date('2024-01-01T00:00:00.000Z'),
        dateEnd: new Date('2024-12-31T23:59:59.999Z'),
        createdAt: new Date('2023-12-01T10:00:00.000Z'),
        isOrdered: false,
      });

      mockGetUserAdministrations.mockResolvedValue({
        items: [mockAdmin],
        totalItems: 1,
      });

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.listUserAdministrations(mockAuthContext, targetUserId, defaultQuery);

      const data = expectOkResponse(result);
      expect(data.items[0]).toMatchObject({
        id: 'admin-transform',
        name: 'Internal Name',
        publicName: 'Public Name',
        dates: {
          start: '2024-01-01T00:00:00.000Z',
          end: '2024-12-31T23:59:59.999Z',
          created: '2023-12-01T10:00:00.000Z',
        },
        isOrdered: false,
      });
    });

    it('should include stats when embedded', async () => {
      const mockAdmin = AdministrationWithEmbedsFactory.build({
        stats: {
          assigned: 100,
          started: 75,
          completed: 50,
        },
      });

      mockGetUserAdministrations.mockResolvedValue({
        items: [mockAdmin],
        totalItems: 1,
      });

      const query: AdministrationsListQuery = {
        ...defaultQuery,
        embed: ['stats'],
      };

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.listUserAdministrations(mockAuthContext, targetUserId, query);

      const data = expectOkResponse(result);
      expect(data.items[0]!.stats).toEqual({
        assigned: 100,
        started: 75,
        completed: 50,
      });
    });

    it('should include tasks when embedded', async () => {
      const mockAdmin = AdministrationWithEmbedsFactory.build({
        tasks: [
          {
            taskId: 'task-1',
            taskName: 'Task One',
            variantId: 'variant-1',
            variantName: 'Variant One',
            orderIndex: 0,
          },
        ],
      });

      mockGetUserAdministrations.mockResolvedValue({
        items: [mockAdmin],
        totalItems: 1,
      });

      const query: AdministrationsListQuery = {
        ...defaultQuery,
        embed: ['tasks'],
      };

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.listUserAdministrations(mockAuthContext, targetUserId, query);

      const data = expectOkResponse(result);
      expect(data.items[0]!.tasks).toHaveLength(1);
      expect(data.items[0]!.tasks![0]).toMatchObject({
        taskId: 'task-1',
        taskName: 'Task One',
        variantId: 'variant-1',
        variantName: 'Variant One',
        orderIndex: 0,
      });
    });

    it('should not include stats or tasks when not embedded', async () => {
      const mockAdmin = AdministrationWithEmbedsFactory.build();

      mockGetUserAdministrations.mockResolvedValue({
        items: [mockAdmin],
        totalItems: 1,
      });

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.listUserAdministrations(mockAuthContext, targetUserId, defaultQuery);

      const data = expectOkResponse(result);
      expect(data.items[0]).not.toHaveProperty('stats');
      expect(data.items[0]).not.toHaveProperty('tasks');
    });

    it('should pass status filter to service when provided', async () => {
      mockGetUserAdministrations.mockResolvedValue({
        items: [],
        totalItems: 0,
      });

      const query: AdministrationsListQuery = {
        ...defaultQuery,
        status: 'active',
      };

      const { UsersController: Controller } = await import('./users.controller');
      await Controller.listUserAdministrations(mockAuthContext, targetUserId, query);

      expect(mockGetUserAdministrations).toHaveBeenCalledWith(
        mockAuthContext,
        targetUserId,
        expect.objectContaining({
          status: 'active',
        }),
      );
    });

    it('should not pass status filter to service when not provided', async () => {
      mockGetUserAdministrations.mockResolvedValue({
        items: [],
        totalItems: 0,
      });

      const { UsersController: Controller } = await import('./users.controller');
      await Controller.listUserAdministrations(mockAuthContext, targetUserId, defaultQuery);

      expect(mockGetUserAdministrations).toHaveBeenCalledWith(
        mockAuthContext,
        targetUserId,
        expect.not.objectContaining({
          status: expect.anything(),
        }),
      );
    });

    it('should calculate totalPages correctly', async () => {
      mockGetUserAdministrations.mockResolvedValue({
        items: AdministrationWithEmbedsFactory.buildList(10),
        totalItems: 47,
      });

      const query: AdministrationsListQuery = {
        page: 1,
        perPage: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: [],
      };

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.listUserAdministrations(mockAuthContext, targetUserId, query);

      const data = expectOkResponse(result);
      expect(data.pagination.totalPages).toBe(5); // Math.ceil(47 / 10)
    });

    it('should handle empty results', async () => {
      mockGetUserAdministrations.mockResolvedValue({
        items: [],
        totalItems: 0,
      });

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.listUserAdministrations(mockAuthContext, targetUserId, defaultQuery);

      const data = expectOkResponse(result);
      expect(data.items).toEqual([]);
      expect(data.pagination).toEqual({
        page: 1,
        perPage: 25,
        totalItems: 0,
        totalPages: 0,
      });
    });

    it('should delegate to service with correct arguments', async () => {
      mockGetUserAdministrations.mockResolvedValue({
        items: [],
        totalItems: 0,
      });

      const query: AdministrationsListQuery = {
        page: 2,
        perPage: 50,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: ['stats', 'tasks'],
        status: 'active',
      };

      const { UsersController: Controller } = await import('./users.controller');
      await Controller.listUserAdministrations(mockAuthContext, targetUserId, query);

      expect(mockGetUserAdministrations).toHaveBeenCalledWith(mockAuthContext, targetUserId, {
        page: 2,
        perPage: 50,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: ['stats', 'tasks'],
        status: 'active',
      });
      expect(mockGetUserAdministrations).toHaveBeenCalledTimes(1);
    });

    it('should return 500 when service throws INTERNAL_SERVER_ERROR', async () => {
      const error = new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockGetUserAdministrations.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.listUserAdministrations(mockAuthContext, targetUserId, defaultQuery);

      const errorBody = expectErrorResponse(result, StatusCodes.INTERNAL_SERVER_ERROR);
      expect(errorBody.message).toBe(ApiErrorMessage.INTERNAL_SERVER_ERROR);
      expect(errorBody.code).toBe(ApiErrorCode.DATABASE_QUERY_FAILED);
      expect(errorBody.traceId).toBeDefined();
    });

    it('should re-throw non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Unexpected database error');
      mockGetUserAdministrations.mockRejectedValue(unexpectedError);

      const { UsersController: Controller } = await import('./users.controller');

      await expect(Controller.listUserAdministrations(mockAuthContext, targetUserId, defaultQuery)).rejects.toThrow(
        'Unexpected database error',
      );
    });

    it('should handle pagination on second page', async () => {
      mockGetUserAdministrations.mockResolvedValue({
        items: AdministrationWithEmbedsFactory.buildList(25),
        totalItems: 100,
      });

      const query: AdministrationsListQuery = {
        page: 2,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: [],
      };

      const { UsersController: Controller } = await import('./users.controller');
      const result = await Controller.listUserAdministrations(mockAuthContext, targetUserId, query);

      const data = expectOkResponse(result);
      expect(data.pagination).toEqual({
        page: 2,
        perPage: 25,
        totalItems: 100,
        totalPages: 4,
      });
    });

    it('should handle different sort options', async () => {
      mockGetUserAdministrations.mockResolvedValue({
        items: [],
        totalItems: 0,
      });

      const query: AdministrationsListQuery = {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
      };

      const { UsersController: Controller } = await import('./users.controller');
      await Controller.listUserAdministrations(mockAuthContext, targetUserId, query);

      expect(mockGetUserAdministrations).toHaveBeenCalledWith(
        mockAuthContext,
        targetUserId,
        expect.objectContaining({
          sortBy: 'name',
          sortOrder: 'asc',
        }),
      );
    });
  });
});
