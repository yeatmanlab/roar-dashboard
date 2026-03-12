import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SortOrder } from '@roar-dashboard/api-contract';
import { StatusCodes } from 'http-status-codes';
import type { User } from '../db/schema';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { UserRole } from '../enums/user-role.enum';
import { ApiError } from '../errors/api-error';
import { UserFactory } from '../test-support/factories/user.factory';
import type { EnrolledUserEntity } from '../utils/handle-enrolled-users';

// Mock the ClassService module
vi.mock('../services/class/class.service', () => ({
  ClassService: vi.fn(),
}));

import { ClassService } from '../services/class/class.service';

/**
 * Helper to create enrolled users for testing
 */
const createMockEnrolledUser = (user: User, overrides: Partial<EnrolledUserEntity> = {}): EnrolledUserEntity => ({
  ...user,
  role: UserRole.STUDENT,
  enrollmentStart: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

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
  const mockListUsers = vi.fn();
  const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock service
    vi.mocked(ClassService).mockReturnValue({
      listUsers: mockListUsers,
    });
  });

  describe('listUsers', () => {
    it('should return paginated users with 200 status', async () => {
      const mockUsers = UserFactory.buildList(3).map((user) => createMockEnrolledUser(user));
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
      const error = new ApiError('Class not found', {
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
      const error = new ApiError('Access denied', {
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
});
