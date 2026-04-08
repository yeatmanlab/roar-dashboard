import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import type { InvitationCode } from '../db/schema';
import type { AuthContext } from '../types/auth-context';
import { SortOrder } from '@roar-dashboard/api-contract';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { ApiErrorMessage } from '../enums/api-error-message.enum';
import { UserRole } from '../enums/user-role.enum';
import { ApiError } from '../errors/api-error';
import { EnrolledUserFactory } from '../test-support/factories/user.factory';

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
const mockGetLatestValidByGroupId = vi.fn();
vi.mock('../services/invitation-code/invitation-code.service', () => ({
  InvitationCodeService: vi.fn(() => ({
    getLatestValidByGroupId: mockGetLatestValidByGroupId,
  })),
}));

const mockListUsers = vi.fn();
vi.mock('../services/group/group.service', () => ({
  GroupService: vi.fn(),
}));

import { GroupService } from '../services/group/group.service';

describe('GroupsController', () => {
  const mockAuthContext: AuthContext = {
    userId: 'test-user-id',
    isSuperAdmin: true,
  };

  const mockInvitationCode: InvitationCode = {
    id: 'invitation-code-id',
    groupId: 'group-id',
    code: 'ABC123',
    validFrom: new Date('2024-01-01'),
    validTo: new Date('2024-12-31'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(GroupService).mockReturnValue({
      listUsers: mockListUsers,
    });
  });

  describe('getInvitationCode', () => {
    let GroupsController: (typeof import('./groups.controller'))['GroupsController'];
    beforeEach(async () => {
      vi.clearAllMocks();
      const { GroupsController: controller } = await import('./groups.controller');
      GroupsController = controller;
    });
    it('should return invitation code with 200 status', async () => {
      mockGetLatestValidByGroupId.mockResolvedValue(mockInvitationCode);

      const result = await GroupsController.getInvitationCode(mockAuthContext, 'group-id');

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        expect(result.body.data).toEqual({
          id: mockInvitationCode.id,
          groupId: mockInvitationCode.groupId,
          code: mockInvitationCode.code,
          validFrom: mockInvitationCode.validFrom.toISOString(),
          validTo: mockInvitationCode.validTo?.toISOString() ?? null,
          dates: {
            created: mockInvitationCode.createdAt.toISOString(),
            updated: mockInvitationCode.updatedAt?.toISOString() ?? mockInvitationCode.createdAt.toISOString(),
          },
        });
      }
      expect(mockGetLatestValidByGroupId).toHaveBeenCalledWith(mockAuthContext, 'group-id');
    });

    it('should handle invitation code with null validTo', async () => {
      const codeWithNullValidTo = { ...mockInvitationCode, validTo: null };
      mockGetLatestValidByGroupId.mockResolvedValue(codeWithNullValidTo);

      const result = await GroupsController.getInvitationCode(mockAuthContext, 'group-id');

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        expect(result.body.data.validTo).toBeNull();
      }
    });

    it('should handle invitation code with null updatedAt', async () => {
      const codeWithNullUpdatedAt = { ...mockInvitationCode, updatedAt: null };
      mockGetLatestValidByGroupId.mockResolvedValue(codeWithNullUpdatedAt);

      const result = await GroupsController.getInvitationCode(mockAuthContext, 'group-id');

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        expect(result.body.data.dates.updated).toBe(mockInvitationCode.createdAt.toISOString());
      }
    });

    it('should return typed error response for ApiError', async () => {
      const { ApiError } = await import('../errors/api-error');
      const { ApiErrorCode } = await import('../enums/api-error-code.enum');
      const apiError = new ApiError('Not found', {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
      mockGetLatestValidByGroupId.mockRejectedValue(apiError);

      const result = await GroupsController.getInvitationCode(mockAuthContext, 'group-id');

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      if (result.status !== StatusCodes.OK) {
        expect(result.body.error.message).toBe('Not found');
      }
    });

    it('should propagate non-ApiError exceptions', async () => {
      const error = new Error('Unexpected error');
      mockGetLatestValidByGroupId.mockRejectedValue(error);

      await expect(GroupsController.getInvitationCode(mockAuthContext, 'group-id')).rejects.toThrow('Unexpected error');
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
      const { GroupsController: Controller } = await import('./groups.controller');

      const result = await Controller.listUsers(mockAuthContext, 'group-123', {
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

      const { GroupsController: Controller } = await import('./groups.controller');

      const result = await Controller.listUsers(mockAuthContext, 'group-123', {
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

      const { GroupsController: Controller } = await import('./groups.controller');

      // While grade query param is string, the schema validates and transforms it to an array
      await Controller.listUsers(mockAuthContext, 'group-456', {
        page: 2,
        perPage: 50,
        sortBy: 'username',
        sortOrder: SortOrder.DESC,
        grade: ['5'],
        role: UserRole.STUDENT,
      });

      expect(mockListUsers).toHaveBeenCalledWith(mockAuthContext, 'group-456', {
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

      const { GroupsController: Controller } = await import('./groups.controller');

      const result = await Controller.listUsers(mockAuthContext, 'nonexistent-group', {
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

      const { GroupsController: Controller } = await import('./groups.controller');

      const result = await Controller.listUsers(mockAuthContext, 'group-123', {
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

      const { GroupsController: Controller } = await import('./groups.controller');

      const result = await Controller.listUsers(mockAuthContext, 'group-123', {
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

      const { GroupsController: Controller } = await import('./groups.controller');

      await expect(
        Controller.listUsers(mockAuthContext, 'group-123', {
          page: 1,
          perPage: 25,
          sortBy: 'nameLast',
          sortOrder: SortOrder.ASC,
        }),
      ).rejects.toThrow('Unexpected error');
    });
  });
});
