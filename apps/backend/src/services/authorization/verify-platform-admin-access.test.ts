import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { verifyPlatformAdminAccess } from './verify-platform-admin-access';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import type { AuthContext } from '../../types/auth-context';
import type { MockUserRepository } from '../../test-support/repositories/user.repository';
import { createMockUserRepository } from '../../test-support/repositories/user.repository';

const ACTION = 'task-variants.list';

describe('verifyPlatformAdminAccess', () => {
  let userRepository: MockUserRepository;

  beforeEach(() => {
    vi.clearAllMocks();

    userRepository = createMockUserRepository();
  });

  describe('super-admin access', () => {
    it('resolves without performing the role lookup', async () => {
      const authContext: AuthContext = { userId: 'super-admin', isSuperAdmin: true };

      await expect(verifyPlatformAdminAccess(authContext, userRepository, ACTION)).resolves.toBeUndefined();

      expect(userRepository.hasPlatformAdminRole).not.toHaveBeenCalled();
    });
  });

  describe('platform admin access', () => {
    it('resolves when the caller has an active platform_admin role', async () => {
      const authContext: AuthContext = { userId: 'platform-admin-1', isSuperAdmin: false };
      userRepository.hasPlatformAdminRole.mockResolvedValue(true);

      await expect(verifyPlatformAdminAccess(authContext, userRepository, ACTION)).resolves.toBeUndefined();

      expect(userRepository.hasPlatformAdminRole).toHaveBeenCalledExactlyOnceWith(authContext.userId);
    });
  });

  describe('denied access', () => {
    it('throws 403 with the generic FORBIDDEN message when the caller has no platform_admin role', async () => {
      const authContext: AuthContext = { userId: 'student-1', isSuperAdmin: false };
      userRepository.hasPlatformAdminRole.mockResolvedValue(false);

      await expect(verifyPlatformAdminAccess(authContext, userRepository, ACTION)).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('throws an ApiError instance', async () => {
      const authContext: AuthContext = { userId: 'student-1', isSuperAdmin: false };
      userRepository.hasPlatformAdminRole.mockResolvedValue(false);

      await expect(verifyPlatformAdminAccess(authContext, userRepository, ACTION)).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('role lookup failure', () => {
    it('propagates unexpected repository errors to the caller for wrapping', async () => {
      const authContext: AuthContext = { userId: 'user-1', isSuperAdmin: false };
      const dbError = new Error('DB connection lost');
      userRepository.hasPlatformAdminRole.mockRejectedValue(dbError);

      await expect(verifyPlatformAdminAccess(authContext, userRepository, ACTION)).rejects.toBe(dbError);
    });
  });
});
