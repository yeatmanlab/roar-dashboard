import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { ApiErrorMessage } from '../enums/api-error-message.enum';
import type { BackfillFgaResponse } from '@roar-dashboard/api-contract';

vi.mock('../services/system/system.service', () => ({
  SystemService: vi.fn(),
}));

import { SystemService } from '../services/system/system.service';

describe('AdminController', () => {
  const mockBackfillFgaStore = vi.fn();
  const mockAuthContext = { userId: 'user-123', isSuperAdmin: true };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(SystemService).mockReturnValue({
      authorization: {
        backfillFgaStore: mockBackfillFgaStore,
      },
    });
  });

  describe('backfillFga', () => {
    it('returns 200 with backfill result on success', async () => {
      const backfillResult: BackfillFgaResponse = {
        dryRun: false,
        categories: {
          orgHierarchy: 10,
          orgMemberships: 20,
          classMemberships: 30,
          groupMemberships: 5,
          familyMemberships: 3,
          administrationAssignments: 15,
        },
        totalTuples: 83,
      };
      mockBackfillFgaStore.mockResolvedValue(backfillResult);

      const { AdminController } = await import('./admin.controller');
      const result = await AdminController.backfillFga(mockAuthContext, { dryRun: false });

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toEqual({ data: backfillResult });
    });

    it('passes dryRun query parameter to the service', async () => {
      mockBackfillFgaStore.mockResolvedValue({
        dryRun: true,
        categories: {
          orgHierarchy: 0,
          orgMemberships: 0,
          classMemberships: 0,
          groupMemberships: 0,
          familyMemberships: 0,
          administrationAssignments: 0,
        },
        totalTuples: 0,
      });

      const { AdminController } = await import('./admin.controller');
      await AdminController.backfillFga(mockAuthContext, { dryRun: true });

      expect(mockBackfillFgaStore).toHaveBeenCalledWith(mockAuthContext, { dryRun: true });
    });

    it('returns 403 when service throws FORBIDDEN', async () => {
      mockBackfillFgaStore.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { AdminController } = await import('./admin.controller');
      const result = await AdminController.backfillFga({ userId: 'user-456', isSuperAdmin: false }, { dryRun: false });

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      expect(result.body).toHaveProperty('error');
    });

    it('returns 500 when service throws internal error', async () => {
      mockBackfillFgaStore.mockRejectedValue(
        new ApiError('FGA backfill failed', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.INTERNAL,
        }),
      );

      const { AdminController } = await import('./admin.controller');
      const result = await AdminController.backfillFga(mockAuthContext, { dryRun: false });

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.body).toHaveProperty('error');
    });

    it('re-throws non-ApiError exceptions', async () => {
      const rawError = new Error('unexpected');
      mockBackfillFgaStore.mockRejectedValue(rawError);

      const { AdminController } = await import('./admin.controller');

      await expect(AdminController.backfillFga(mockAuthContext, { dryRun: false })).rejects.toThrow('unexpected');
    });
  });
});
