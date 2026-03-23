import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { ApiErrorMessage } from '../enums/api-error-message.enum';
import type { BackfillResult } from '../services/authorization/fga-backfill.service';

vi.mock('../services/authorization/fga-backfill.service', () => ({
  FgaBackfillService: vi.fn(),
}));

import { FgaBackfillService } from '../services/authorization/fga-backfill.service';

describe('AdminController', () => {
  const mockBackfill = vi.fn();
  const mockAuthContext = { userId: 'user-123', isSuperAdmin: true };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(FgaBackfillService).mockReturnValue({
      backfill: mockBackfill,
    });
  });

  describe('backfillFga', () => {
    it('returns 200 with backfill result on success', async () => {
      const backfillResult: BackfillResult = {
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
      mockBackfill.mockResolvedValue(backfillResult);

      const { AdminController } = await import('./admin.controller');
      const result = await AdminController.backfillFga(mockAuthContext, { dryRun: false });

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toEqual({ data: backfillResult });
    });

    it('passes dryRun query parameter to the service', async () => {
      mockBackfill.mockResolvedValue({
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

      expect(mockBackfill).toHaveBeenCalledWith(mockAuthContext, { dryRun: true });
    });

    it('returns 403 when service throws FORBIDDEN', async () => {
      mockBackfill.mockRejectedValue(
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
      mockBackfill.mockRejectedValue(
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
      mockBackfill.mockRejectedValue(rawError);

      const { AdminController } = await import('./admin.controller');

      await expect(AdminController.backfillFga(mockAuthContext, { dryRun: false })).rejects.toThrow('unexpected');
    });
  });
});
