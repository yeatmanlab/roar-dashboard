import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import type { AuthContext } from '../types/auth-context';
import { SortOrder } from '@roar-dashboard/api-contract';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { ApiErrorMessage } from '../enums/api-error-message.enum';
import { ApiError } from '../errors/api-error';
import { EnrolledFamilyUserFactory } from '../test-support/factories/user.factory';

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

// Mock the services before importing controller
const mockListUsers = vi.fn();
vi.mock('../services/family/family.service', () => ({
  FamilyService: vi.fn(),
}));

import { FamilyService } from '../services/family/family.service';

describe('FamiliesController', () => {
  const mockAuthContext: AuthContext = {
    userId: 'test-user-id',
    isSuperAdmin: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(FamilyService).mockReturnValue({
      listUsers: mockListUsers,
    });
  });

  describe('listUsers', () => {
    it('should return paginated users with 200 status', async () => {
      const mockUsers = EnrolledFamilyUserFactory.buildList(3);
      mockListUsers.mockResolvedValue({
        items: mockUsers,
        totalItems: 3,
      });

      const { FamiliesController: Controller } = await import('./families.controller');

      const result = await Controller.listUsers(mockAuthContext, 'family-123', {
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

      const { FamiliesController: Controller } = await import('./families.controller');

      const result = await Controller.listUsers(mockAuthContext, 'family-123', {
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

      const { FamiliesController: Controller } = await import('./families.controller');

      await Controller.listUsers(mockAuthContext, 'family-456', {
        page: 2,
        perPage: 50,
        sortBy: 'username',
        sortOrder: SortOrder.DESC,
        grade: ['5'],
        role: 'parent',
      });

      expect(mockListUsers).toHaveBeenCalledWith(mockAuthContext, 'family-456', {
        page: 2,
        perPage: 50,
        sortBy: 'username',
        sortOrder: SortOrder.DESC,
        grade: ['5'],
        role: 'parent',
      });
    });

    it('should handle ApiError with 404 Not Found', async () => {
      const error = new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
      mockListUsers.mockRejectedValue(error);

      const { FamiliesController: Controller } = await import('./families.controller');

      const result = await Controller.listUsers(mockAuthContext, 'nonexistent-family', {
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

      const { FamiliesController: Controller } = await import('./families.controller');

      const result = await Controller.listUsers(mockAuthContext, 'family-123', {
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

      const { FamiliesController: Controller } = await import('./families.controller');

      const result = await Controller.listUsers(mockAuthContext, 'family-123', {
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

      const { FamiliesController: Controller } = await import('./families.controller');

      await expect(
        Controller.listUsers(mockAuthContext, 'family-123', {
          page: 1,
          perPage: 25,
          sortBy: 'nameLast',
          sortOrder: SortOrder.ASC,
        }),
      ).rejects.toThrow('Unexpected error');
    });
  });
});
