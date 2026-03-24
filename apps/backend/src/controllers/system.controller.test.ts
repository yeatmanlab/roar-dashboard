import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import type { SyncFgaResponse } from '@roar-dashboard/api-contract';

vi.mock('../services/system/system.service', () => ({
  SystemService: vi.fn(),
}));

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { SystemService } from '../services/system/system.service';
import { logger } from '../logger';

describe('SystemController', () => {
  const mockSyncFgaStore = vi.fn();
  const mockSuperAdminContext = { userId: 'user-123', isSuperAdmin: true };
  const mockNonSuperAdminContext = { userId: 'user-456', isSuperAdmin: false };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(SystemService).mockReturnValue({
      authorization: {
        syncFgaStore: mockSyncFgaStore,
      },
    });
  });

  describe('syncFga', () => {
    describe('dry-run (synchronous)', () => {
      it('returns 200 with tuple counts for dry-run', async () => {
        const dryRunResult: SyncFgaResponse = {
          dryRun: true,
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
        mockSyncFgaStore.mockResolvedValue(dryRunResult);

        const { SystemController } = await import('./system.controller');
        const result = await SystemController.syncFga(mockSuperAdminContext, { dryRun: true });

        expect(result.status).toBe(StatusCodes.OK);
        expect(result.body).toEqual({ data: dryRunResult });
        expect(mockSyncFgaStore).toHaveBeenCalledWith(mockSuperAdminContext, { dryRun: true });
      });

      it('returns 500 when dry-run service throws internal error', async () => {
        mockSyncFgaStore.mockRejectedValue(
          new ApiError('FGA sync failed', {
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            code: ApiErrorCode.INTERNAL,
          }),
        );

        const { SystemController } = await import('./system.controller');
        const result = await SystemController.syncFga(mockSuperAdminContext, { dryRun: true });

        expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(result.body).toHaveProperty('error');
      });

      it('re-throws non-ApiError exceptions in dry-run', async () => {
        const rawError = new Error('unexpected');
        mockSyncFgaStore.mockRejectedValue(rawError);

        const { SystemController } = await import('./system.controller');

        await expect(SystemController.syncFga(mockSuperAdminContext, { dryRun: true })).rejects.toThrow('unexpected');
      });
    });

    describe('real run (fire-and-forget)', () => {
      it('returns 202 and fires sync without awaiting', async () => {
        // Service returns a promise that hasn't resolved yet
        let resolveSync!: () => void;
        mockSyncFgaStore.mockReturnValue(
          new Promise<void>((resolve) => {
            resolveSync = resolve;
          }),
        );

        const { SystemController } = await import('./system.controller');
        const result = await SystemController.syncFga(mockSuperAdminContext, { dryRun: false });

        // Controller returns 202 before the sync finishes
        expect(result.status).toBe(202);
        expect(result.body).toEqual({
          data: { message: 'FGA sync started. Check server logs for progress.' },
        });
        expect(mockSyncFgaStore).toHaveBeenCalledWith(mockSuperAdminContext, { dryRun: false });

        // Clean up the pending promise
        resolveSync();
      });

      it('logs errors from the background sync', async () => {
        const syncError = new Error('FGA API timeout');
        mockSyncFgaStore.mockRejectedValue(syncError);

        const { SystemController } = await import('./system.controller');
        const result = await SystemController.syncFga(mockSuperAdminContext, { dryRun: false });

        expect(result.status).toBe(202);

        // Let the microtask queue flush so the .catch() handler runs
        await vi.waitFor(() => {
          expect(logger.error).toHaveBeenCalledWith(
            { err: syncError, context: { userId: 'user-123' } },
            'FGA sync failed (async)',
          );
        });
      });
    });

    describe('authorization', () => {
      it('returns 403 when user is not super admin', async () => {
        const { SystemController } = await import('./system.controller');
        const result = await SystemController.syncFga(mockNonSuperAdminContext, { dryRun: false });

        expect(result.status).toBe(StatusCodes.FORBIDDEN);
        expect(result.body).toHaveProperty('error');
        expect(mockSyncFgaStore).not.toHaveBeenCalled();
      });

      it('returns 403 for non-super-admin even on dry-run', async () => {
        const { SystemController } = await import('./system.controller');
        const result = await SystemController.syncFga(mockNonSuperAdminContext, { dryRun: true });

        expect(result.status).toBe(StatusCodes.FORBIDDEN);
        expect(result.body).toHaveProperty('error');
        expect(mockSyncFgaStore).not.toHaveBeenCalled();
      });
    });
  });
});
