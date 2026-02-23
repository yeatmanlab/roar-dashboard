import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import type { InvitationCode } from '../db/schema';
import type { AuthContext } from '../types/auth-context';

// Mock the service before importing controller
const mockGetLatestValidByGroupId = vi.fn();
vi.mock('../services/invitation-code/invitation-code.service', () => ({
  InvitationCodeService: vi.fn(() => ({
    getLatestValidByGroupId: mockGetLatestValidByGroupId,
  })),
}));

// Import controller after mocking
const { GroupsController } = await import('./groups.controller');

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
  });

  describe('getInvitationCode', () => {
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
});
