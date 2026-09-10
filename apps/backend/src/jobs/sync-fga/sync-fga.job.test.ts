import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { SyncFgaResponse } from '../../services/authorization/sync/authorization.module';
import { FgaClient } from '../../clients/fga.client';
import { logger } from '../../logger';
import type { AuthContext } from '../../types/auth-context';

// Hoisted so the vi.mock factories below can reference them.
const { mockInitializeDatabasePools, mockCloseDatabasePools, mockSyncFgaStore, mockAuthorizationModule } = vi.hoisted(
  () => {
    const mockSyncFgaStore =
      vi.fn<(authContext: AuthContext, options: { dryRun: boolean }) => Promise<SyncFgaResponse>>();

    return {
      mockInitializeDatabasePools: vi.fn<() => Promise<void>>(),
      mockCloseDatabasePools: vi.fn<() => Promise<void>>(),
      mockSyncFgaStore,
      mockAuthorizationModule: vi.fn(() => ({ syncFgaStore: mockSyncFgaStore })),
    };
  },
);

// The job must not read a real .env in unit tests.
vi.mock('dotenv/config', () => ({}));

vi.mock('../../db/clients', () => ({
  initializeDatabasePools: mockInitializeDatabasePools,
  closeDatabasePools: mockCloseDatabasePools,
}));

vi.mock('../../services/authorization/sync/authorization.module', () => ({
  AuthorizationModule: mockAuthorizationModule,
}));

// logger and FgaClient are mocked globally in vitest.setup.ts.

const { main, run } = await import('./sync-fga.job');

const BASE_ARGV = ['/usr/bin/node', '/app/dist/jobs/sync-fga.js'] as const;

const SYNC_RESULT: SyncFgaResponse = {
  dryRun: true,
  categories: {
    orgHierarchy: { write: 2, delete: 0 },
    orgMemberships: { write: 5, delete: 1 },
    classMemberships: { write: 0, delete: 0 },
    groupMemberships: { write: 0, delete: 0 },
    familyMemberships: { write: 3, delete: 0 },
    administrationAssignments: { write: 1, delete: 2 },
  },
  totalWrites: 11,
  totalDeletes: 3,
};

describe('sync-fga job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInitializeDatabasePools.mockResolvedValue(undefined);
    mockCloseDatabasePools.mockResolvedValue(undefined);
    mockSyncFgaStore.mockResolvedValue(SYNC_RESULT);
  });

  describe('main', () => {
    it('passes the dryRun option through to the sync', async () => {
      await main({ dryRun: true });
      expect(mockSyncFgaStore).toHaveBeenCalledWith(expect.anything(), { dryRun: true });

      await main({ dryRun: false });
      expect(mockSyncFgaStore).toHaveBeenCalledWith(expect.anything(), { dryRun: false });
    });

    it('validates the FGA configuration before running the sync', async () => {
      await main({ dryRun: true });

      const getClientOrder = vi.mocked(FgaClient.getClient).mock.invocationCallOrder[0];
      const syncOrder = mockSyncFgaStore.mock.invocationCallOrder[0];

      expect(getClientOrder).toBeDefined();
      expect(syncOrder).toBeDefined();
      expect(getClientOrder!).toBeLessThan(syncOrder!);
    });

    it('fails before opening any database pool when the FGA client is misconfigured', async () => {
      const configError = new Error('missing FGA env vars');
      vi.mocked(FgaClient.getClient).mockImplementationOnce(() => {
        throw configError;
      });

      await expect(main({ dryRun: true })).rejects.toBe(configError);
      expect(mockSyncFgaStore).not.toHaveBeenCalled();
      expect(mockInitializeDatabasePools).not.toHaveBeenCalled();
      expect(mockCloseDatabasePools).not.toHaveBeenCalled();
    });

    it('passes the synthetic super-admin auth context', async () => {
      await main({ dryRun: true });

      expect(mockSyncFgaStore).toHaveBeenCalledWith(
        { userId: 'system:sync-fga-job', isSuperAdmin: true },
        expect.anything(),
      );
    });

    it('validates the FGA client before initializing pools, and pools before the authorization module', async () => {
      await main({ dryRun: true });

      const fgaOrder = vi.mocked(FgaClient.initialize).mock.invocationCallOrder[0];
      const poolOrder = mockInitializeDatabasePools.mock.invocationCallOrder[0];
      const moduleOrder = mockAuthorizationModule.mock.invocationCallOrder[0];

      expect(fgaOrder).toBeDefined();
      expect(poolOrder).toBeDefined();
      expect(moduleOrder).toBeDefined();
      expect(fgaOrder!).toBeLessThan(poolOrder!);
      expect(poolOrder!).toBeLessThan(moduleOrder!);
    });

    it('returns the sync result and logs the per-category counts', async () => {
      const result = await main({ dryRun: true });

      expect(result).toEqual(SYNC_RESULT);
      expect(logger.info).toHaveBeenCalledWith(
        {
          dryRun: SYNC_RESULT.dryRun,
          categories: SYNC_RESULT.categories,
          totalWrites: SYNC_RESULT.totalWrites,
          totalDeletes: SYNC_RESULT.totalDeletes,
        },
        'FGA sync job completed',
      );
    });

    it('closes pools after a successful sync', async () => {
      await main({ dryRun: true });

      expect(mockCloseDatabasePools).toHaveBeenCalledTimes(1);
    });

    it('closes pools and re-throws when the sync fails', async () => {
      const syncError = new Error('FGA unreachable');
      mockSyncFgaStore.mockRejectedValue(syncError);

      await expect(main({ dryRun: true })).rejects.toBe(syncError);
      expect(mockCloseDatabasePools).toHaveBeenCalledTimes(1);
    });

    it('does not open pools when FGA client initialization fails', async () => {
      const fgaError = new Error('OIDC audience misconfigured');
      vi.mocked(FgaClient.initialize).mockRejectedValueOnce(fgaError);

      await expect(main({ dryRun: true })).rejects.toBe(fgaError);
      expect(mockInitializeDatabasePools).not.toHaveBeenCalled();
      expect(mockCloseDatabasePools).not.toHaveBeenCalled();
    });

    it('swallows pool close errors so they do not mask the sync outcome', async () => {
      const closeError = new Error('pool already closed');
      mockCloseDatabasePools.mockRejectedValue(closeError);

      const result = await main({ dryRun: true });

      expect(result).toEqual(SYNC_RESULT);
      expect(logger.error).toHaveBeenCalledWith(
        { err: closeError },
        'Failed to close database pools after FGA sync job',
      );
    });
  });

  describe('run', () => {
    it('returns exit code 0 on success', async () => {
      await expect(run([...BASE_ARGV])).resolves.toBe(0);
    });

    it('defaults to dry run when --apply is absent', async () => {
      await run([...BASE_ARGV]);

      expect(mockSyncFgaStore).toHaveBeenCalledWith(expect.anything(), { dryRun: true });
    });

    it('applies changes only with an explicit --apply flag', async () => {
      await run([...BASE_ARGV, '--apply']);

      expect(mockSyncFgaStore).toHaveBeenCalledWith(expect.anything(), { dryRun: false });
    });

    it('returns exit code 1 and logs fatal on failure', async () => {
      const syncError = new Error('sync failed');
      mockSyncFgaStore.mockRejectedValue(syncError);

      await expect(run([...BASE_ARGV])).resolves.toBe(1);
      expect(logger.fatal).toHaveBeenCalledWith({ err: syncError }, 'FGA sync job failed');
    });

    it('returns exit code 1 for an unknown argument without invoking the sync', async () => {
      await expect(run([...BASE_ARGV, '--aply'])).resolves.toBe(1);

      expect(mockInitializeDatabasePools).not.toHaveBeenCalled();
      expect(mockSyncFgaStore).not.toHaveBeenCalled();
      expect(logger.fatal).toHaveBeenCalledWith(
        { argument: '--aply', usage: expect.stringContaining('--apply') },
        'FGA sync job rejected an unknown argument',
      );
    });

    it('rejects --apply=true instead of degrading it to a dry run', async () => {
      await expect(run([...BASE_ARGV, '--apply=true'])).resolves.toBe(1);

      expect(mockSyncFgaStore).not.toHaveBeenCalled();
      expect(logger.fatal).toHaveBeenCalledWith(
        expect.objectContaining({ argument: '--apply=true' }),
        'FGA sync job rejected an unknown argument',
      );
    });
  });
});
