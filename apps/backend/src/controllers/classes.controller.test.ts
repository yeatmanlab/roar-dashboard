import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SortOrder } from '@roar-dashboard/api-contract';
import { StatusCodes } from 'http-status-codes';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { ApiErrorMessage } from '../enums/api-error-message.enum';
import { UserRole } from '../enums/user-role.enum';
import { ApiError } from '../errors/api-error';
import { EnrolledUserFactory } from '../test-support/factories/user.factory';
// Mock the ClassService module
vi.mock('../services/class/class.service', () => ({
  ClassService: vi.fn(),
}));

import { ClassService } from '../services/class/class.service';

/**
 * Type-safe assertion helper for success responses.
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
  return (result.body as { error: unknown }).error;
}

describe('ClassesController', () => {
  const mockCreate = vi.fn();
  const mockListUsers = vi.fn();
  const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock service
    vi.mocked(ClassService).mockReturnValue({
      create: mockCreate,
      listUsers: mockListUsers,
    });
  });

  describe('listUsers', () => {
    it('should return paginated users with 200 status', async () => {
      const mockUsers = EnrolledUserFactory.buildList(3);
      mockListUsers.mockResolvedValue({
        items: mockUsers,
        totalItems: 3,
      });

      // Re-import to pick up the mock
      const { ClassesController: Controller } = await import('./classes.controller');

      const result = await Controller.listUsers(mockAuthContext, 'class-123', {
        page: 1,
        perPage: 25,
        sortBy: 'nameLast',
        sortOrder: SortOrder.ASC,
      });

      const data = expectOkResponse(result);
      expect(data.items).toHaveLength(3);
      expect(data.pagination).toEqual({
        page: 1,
        perPage: 25,
        totalItems: 3,
        totalPages: 1,
      });
    });

    it('should handle empty results', async () => {
      mockListUsers.mockResolvedValue({
        items: [],
        totalItems: 0,
      });

      const { ClassesController: Controller } = await import('./classes.controller');

      const result = await Controller.listUsers(mockAuthContext, 'class-123', {
        page: 1,
        perPage: 25,
        sortBy: 'nameLast',
        sortOrder: SortOrder.ASC,
      });

      const data = expectOkResponse(result);
      expect(data.items).toEqual([]);
      expect(data.pagination.totalItems).toBe(0);
      expect(data.pagination.totalPages).toBe(0);
    });

    it('should pass query parameters to service', async () => {
      mockListUsers.mockResolvedValue({
        items: [],
        totalItems: 0,
      });

      const { ClassesController: Controller } = await import('./classes.controller');

      // While grade query param is string, the schema validates and transforms it to an array
      await Controller.listUsers(mockAuthContext, 'class-456', {
        page: 2,
        perPage: 50,
        sortBy: 'username',
        sortOrder: SortOrder.DESC,
        grade: ['5'],
        role: UserRole.STUDENT,
      });

      expect(mockListUsers).toHaveBeenCalledWith(mockAuthContext, 'class-456', {
        page: 2,
        perPage: 50,
        sortBy: 'username',
        sortOrder: SortOrder.DESC,
        grade: ['5'],
        role: UserRole.STUDENT,
      });
    });

    it('should handle ApiError with 404 Not Found', async () => {
      const error = new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
      mockListUsers.mockRejectedValue(error);

      const { ClassesController: Controller } = await import('./classes.controller');

      const result = await Controller.listUsers(mockAuthContext, 'nonexistent-class', {
        page: 1,
        perPage: 25,
        sortBy: 'nameLast',
        sortOrder: SortOrder.ASC,
      });

      const errorBody = expectErrorResponse(result, StatusCodes.NOT_FOUND);
      expect(errorBody).toBeDefined();
    });

    it('should handle ApiError with 403 Forbidden', async () => {
      const error = new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      mockListUsers.mockRejectedValue(error);

      const { ClassesController: Controller } = await import('./classes.controller');

      const result = await Controller.listUsers(mockAuthContext, 'class-123', {
        page: 1,
        perPage: 25,
        sortBy: 'nameLast',
        sortOrder: SortOrder.ASC,
      });

      const errorBody = expectErrorResponse(result, StatusCodes.FORBIDDEN);
      expect(errorBody).toBeDefined();
    });

    it('should handle ApiError with 500 Internal Server Error', async () => {
      const error = new ApiError('Database error', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockListUsers.mockRejectedValue(error);

      const { ClassesController: Controller } = await import('./classes.controller');

      const result = await Controller.listUsers(mockAuthContext, 'class-123', {
        page: 1,
        perPage: 25,
        sortBy: 'nameLast',
        sortOrder: SortOrder.ASC,
      });

      const errorBody = expectErrorResponse(result, StatusCodes.INTERNAL_SERVER_ERROR);
      expect(errorBody).toBeDefined();
    });

    it('should rethrow non-ApiError errors', async () => {
      const error = new Error('Unexpected error');
      mockListUsers.mockRejectedValue(error);

      const { ClassesController: Controller } = await import('./classes.controller');

      await expect(
        Controller.listUsers(mockAuthContext, 'class-123', {
          page: 1,
          perPage: 25,
          sortBy: 'nameLast',
          sortOrder: SortOrder.ASC,
        }),
      ).rejects.toThrow('Unexpected error');
    });
  });

  describe('create', () => {
    const validBody = {
      schoolId: '22222222-2222-4222-8222-222222222222',
      name: 'Reading 101',
      classType: 'homeroom' as const,
    };

    it('should return 201 with the new class id on success', async () => {
      mockCreate.mockResolvedValue({ id: 'class-new-1' });

      const { ClassesController: Controller } = await import('./classes.controller');

      const result = await Controller.create(mockAuthContext, validBody);

      expect(result.status).toBe(StatusCodes.CREATED);
      expect(result.body).toHaveProperty('data');
      const data = (result.body as { data: { id: string } }).data;
      expect(data).toEqual({ id: 'class-new-1' });
      expect(mockCreate).toHaveBeenCalledWith(mockAuthContext, expect.objectContaining(validBody));
    });

    it('should map the request body to the service input field-by-field, omitting absent optionals', async () => {
      mockCreate.mockResolvedValue({ id: 'class-new-2' });

      const { ClassesController: Controller } = await import('./classes.controller');

      await Controller.create(mockAuthContext, {
        ...validBody,
        number: '101A',
        period: '3',
        termId: '33333333-3333-4333-8333-333333333333',
        courseId: '44444444-4444-4444-8444-444444444444',
        subjects: ['Reading'],
        grades: ['3', '4'],
        location: 'Room 12',
      });

      expect(mockCreate).toHaveBeenCalledWith(mockAuthContext, {
        schoolId: validBody.schoolId,
        name: validBody.name,
        classType: validBody.classType,
        number: '101A',
        period: '3',
        termId: '33333333-3333-4333-8333-333333333333',
        courseId: '44444444-4444-4444-8444-444444444444',
        subjects: ['Reading'],
        grades: ['3', '4'],
        location: 'Room 12',
      });
    });

    it('should map ApiError 403 to a Forbidden error response', async () => {
      const error = new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      mockCreate.mockRejectedValue(error);

      const { ClassesController: Controller } = await import('./classes.controller');

      const result = await Controller.create(mockAuthContext, validBody);

      const errorBody = expectErrorResponse(result, StatusCodes.FORBIDDEN);
      expect(errorBody).toBeDefined();
    });

    it('should map ApiError 422 to an Unprocessable Entity error response', async () => {
      const error = new ApiError(ApiErrorMessage.UNPROCESSABLE_ENTITY, {
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.RESOURCE_UNPROCESSABLE,
      });
      mockCreate.mockRejectedValue(error);

      const { ClassesController: Controller } = await import('./classes.controller');

      const result = await Controller.create(mockAuthContext, validBody);

      const errorBody = expectErrorResponse(result, StatusCodes.UNPROCESSABLE_ENTITY);
      expect(errorBody).toBeDefined();
    });

    it('should map ApiError 500 to an Internal Server Error response', async () => {
      const error = new ApiError('Failed to create class', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockCreate.mockRejectedValue(error);

      const { ClassesController: Controller } = await import('./classes.controller');

      const result = await Controller.create(mockAuthContext, validBody);

      const errorBody = expectErrorResponse(result, StatusCodes.INTERNAL_SERVER_ERROR);
      expect(errorBody).toBeDefined();
    });

    it('should re-throw a non-ApiError unchanged so the global error handler catches it', async () => {
      const unexpected = new Error('Unexpected error');
      mockCreate.mockRejectedValue(unexpected);

      const { ClassesController: Controller } = await import('./classes.controller');

      await expect(Controller.create(mockAuthContext, validBody)).rejects.toBe(unexpected);
    });
  });
});
