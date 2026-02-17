import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { InvitationCodeService } from './invitation-code.service';
import { InvitationCodeRepository } from '../../repositories/invitation-code.repository';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import type { InvitationCode } from '../../db/schema';
import type { AuthContext } from '../../types/auth-context';

vi.mock('../../repositories/invitation-code.repository');

describe('InvitationCodeService', () => {
  let mockRepository: vi.Mocked<InvitationCodeRepository>;
  let service: ReturnType<typeof InvitationCodeService>;

  const superAdminContext: AuthContext = {
    userId: 'super-admin-id',
    isSuperAdmin: true,
  };

  const regularUserContext: AuthContext = {
    userId: 'regular-user-id',
    isSuperAdmin: false,
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
    mockRepository = {
      getLatestValidByGroupId: vi.fn(),
    } as unknown as vi.Mocked<InvitationCodeRepository>;
    service = InvitationCodeService({ invitationCodeRepository: mockRepository });
  });

  describe('getLatestValidByGroupId', () => {
    describe('Authorization', () => {
      it('should allow super admins to access invitation codes', async () => {
        mockRepository.getLatestValidByGroupId.mockResolvedValue(mockInvitationCode);

        const result = await service.getLatestValidByGroupId('group-id', superAdminContext);

        expect(result).toEqual(mockInvitationCode);
        expect(mockRepository.getLatestValidByGroupId).toHaveBeenCalledWith('group-id');
      });

      it('should deny non-super admins with 403', async () => {
        await expect(service.getLatestValidByGroupId('group-id', regularUserContext)).rejects.toThrow(
          expect.objectContaining({
            message: 'Access denied',
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
          }),
        );

        expect(mockRepository.getLatestValidByGroupId).not.toHaveBeenCalled();
      });
    });

    describe('Success cases', () => {
      it('should return invitation code when found', async () => {
        mockRepository.getLatestValidByGroupId.mockResolvedValue(mockInvitationCode);

        const result = await service.getLatestValidByGroupId('group-id', superAdminContext);

        expect(result).toEqual(mockInvitationCode);
      });

      it('should handle invitation code with null validTo', async () => {
        const codeWithNullValidTo = { ...mockInvitationCode, validTo: null };
        mockRepository.getLatestValidByGroupId.mockResolvedValue(codeWithNullValidTo);

        const result = await service.getLatestValidByGroupId('group-id', superAdminContext);

        expect(result.validTo).toBeNull();
      });
    });

    describe('Error cases', () => {
      it('should throw 404 when no invitation code found', async () => {
        mockRepository.getLatestValidByGroupId.mockResolvedValue(null);

        await expect(service.getLatestValidByGroupId('group-id', superAdminContext)).rejects.toThrow(
          expect.objectContaining({
            message: 'No valid invitation code found',
            statusCode: StatusCodes.NOT_FOUND,
            code: ApiErrorCode.RESOURCE_NOT_FOUND,
          }),
        );
      });

      it('should propagate ApiError from repository', async () => {
        const apiError = new ApiError('Database error', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        });
        mockRepository.getLatestValidByGroupId.mockRejectedValue(apiError);

        await expect(service.getLatestValidByGroupId('group-id', superAdminContext)).rejects.toThrow(apiError);
      });

      it('should wrap non-ApiError exceptions', async () => {
        const genericError = new Error('Unexpected error');
        mockRepository.getLatestValidByGroupId.mockRejectedValue(genericError);

        await expect(service.getLatestValidByGroupId('group-id', superAdminContext)).rejects.toThrow(
          expect.objectContaining({
            message: 'Failed to retrieve invitation code',
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            code: ApiErrorCode.DATABASE_QUERY_FAILED,
          }),
        );
      });
    });
  });
});
