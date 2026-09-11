import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { verifyTargetUserAccess } from './verify-target-user-access';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import type { AuthContext } from '../../types/auth-context';
import type { MockFamilyRepository } from '../../test-support/repositories';
import { createMockFamilyRepository } from '../../test-support/repositories';
import type { MockAuthorizationService } from '../../test-support/services';
import { createMockAuthorizationService } from '../../test-support/services';
import { FgaRelation } from './fga-constants';

describe('verifyTargetUserAccess', () => {
  let familyRepository: MockFamilyRepository;
  let authorizationService: MockAuthorizationService;

  beforeEach(() => {
    vi.clearAllMocks();

    familyRepository = createMockFamilyRepository();
    authorizationService = createMockAuthorizationService();
  });

  describe('super-admin access', () => {
    it('super-admin → [], no repo/FGA calls', async () => {
      const authContext: AuthContext = { userId: 'super-admin', isSuperAdmin: true };
      const targetUserId = 'any-user';

      const result = await verifyTargetUserAccess(
        authContext,
        targetUserId,
        FgaRelation.CAN_READ_CHILD,
        familyRepository,
        authorizationService,
      );

      expect(result).toEqual([]);
      expect(familyRepository.getFamilyIdsForUser).not.toHaveBeenCalled();
      expect(authorizationService.hasAnyPermission).not.toHaveBeenCalled();
    });
  });

  describe('self-access', () => {
    it('self-access → [], no repo/FGA calls', async () => {
      const authContext: AuthContext = { userId: 'user-123', isSuperAdmin: false };
      const targetUserId = 'user-123';

      const result = await verifyTargetUserAccess(
        authContext,
        targetUserId,
        FgaRelation.CAN_READ_CHILD,
        familyRepository,
        authorizationService,
      );

      expect(result).toEqual([]);
      expect(familyRepository.getFamilyIdsForUser).not.toHaveBeenCalled();
      expect(authorizationService.hasAnyPermission).not.toHaveBeenCalled();
    });
  });

  describe('cross-user with permission', () => {
    it('cross-user with permission → returns family IDs', async () => {
      const authContext: AuthContext = { userId: 'parent-456', isSuperAdmin: false };
      const targetUserId = 'child-789';
      const familyIds = ['family-123', 'family-456'];

      familyRepository.getFamilyIdsForUser.mockResolvedValue(familyIds);
      authorizationService.hasAnyPermission.mockResolvedValue(true);

      const result = await verifyTargetUserAccess(
        authContext,
        targetUserId,
        FgaRelation.CAN_CREATE_RUN_FOR_CHILD,
        familyRepository,
        authorizationService,
      );

      expect(result).toEqual(familyIds);
      expect(familyRepository.getFamilyIdsForUser).toHaveBeenCalledWith(targetUserId);
      expect(authorizationService.hasAnyPermission).toHaveBeenCalledWith(
        'parent-456',
        FgaRelation.CAN_CREATE_RUN_FOR_CHILD,
        ['family:family-123', 'family:family-456'],
      );
    });
  });

  describe('cross-user without permission', () => {
    it('cross-user without permission → throws 403 with requiredPermission in context', async () => {
      const authContext: AuthContext = { userId: 'parent-456', isSuperAdmin: false };
      const targetUserId = 'child-789';

      familyRepository.getFamilyIdsForUser.mockResolvedValue(['family-123']);
      authorizationService.hasAnyPermission.mockResolvedValue(false);

      await expect(
        verifyTargetUserAccess(
          authContext,
          targetUserId,
          FgaRelation.CAN_CREATE_RUN_FOR_CHILD,
          familyRepository,
          authorizationService,
        ),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        message: ApiErrorMessage.FORBIDDEN,
        context: {
          userId: 'parent-456',
          targetUserId: 'child-789',
          requiredPermission: FgaRelation.CAN_CREATE_RUN_FOR_CHILD,
        },
      });
    });
  });

  describe('cross-user, target in no families', () => {
    it('cross-user, target in no families → still throws (pin the no-short-circuit behavior)', async () => {
      const authContext: AuthContext = { userId: 'parent-456', isSuperAdmin: false };
      const targetUserId = 'child-789';

      familyRepository.getFamilyIdsForUser.mockResolvedValue([]);
      authorizationService.hasAnyPermission.mockResolvedValue(false);

      await expect(
        verifyTargetUserAccess(
          authContext,
          targetUserId,
          FgaRelation.CAN_CREATE_RUN_FOR_CHILD,
          familyRepository,
          authorizationService,
        ),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        message: ApiErrorMessage.FORBIDDEN,
      });

      // Verify FGA check was still called even with empty family list
      expect(authorizationService.hasAnyPermission).toHaveBeenCalledWith(
        'parent-456',
        FgaRelation.CAN_CREATE_RUN_FOR_CHILD,
        [],
      );
    });
  });

  describe('repository / FGA service rejections', () => {
    it('repository rejection → propagated', async () => {
      const authContext: AuthContext = { userId: 'parent-456', isSuperAdmin: false };
      const targetUserId = 'child-789';
      const repoError = new Error('Database connection lost');

      familyRepository.getFamilyIdsForUser.mockRejectedValue(repoError);

      await expect(
        verifyTargetUserAccess(
          authContext,
          targetUserId,
          FgaRelation.CAN_CREATE_RUN_FOR_CHILD,
          familyRepository,
          authorizationService,
        ),
      ).rejects.toBe(repoError);
    });

    it('FGA service rejection → propagated', async () => {
      const authContext: AuthContext = { userId: 'parent-456', isSuperAdmin: false };
      const targetUserId = 'child-789';
      const fgaError = new Error('FGA service unavailable');

      familyRepository.getFamilyIdsForUser.mockResolvedValue(['family-123']);
      authorizationService.hasAnyPermission.mockRejectedValue(fgaError);

      await expect(
        verifyTargetUserAccess(
          authContext,
          targetUserId,
          FgaRelation.CAN_CREATE_RUN_FOR_CHILD,
          familyRepository,
          authorizationService,
        ),
      ).rejects.toBe(fgaError);
    });
  });
});
