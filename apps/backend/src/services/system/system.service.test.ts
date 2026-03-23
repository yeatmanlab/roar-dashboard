import { describe, it, expect, vi } from 'vitest';
import { SystemService } from './system.service';

describe('SystemService', () => {
  it('exposes the authorization namespace', () => {
    const mockAuthorizationModule = { backfillFgaStore: vi.fn() };
    const service = SystemService({ authorizationModule: mockAuthorizationModule });

    expect(service.authorization).toBe(mockAuthorizationModule);
  });

  it('delegates backfillFgaStore to the authorization module', async () => {
    const mockBackfillFgaStore = vi.fn().mockResolvedValue({ dryRun: true, totalTuples: 0 });
    const service = SystemService({
      authorizationModule: { backfillFgaStore: mockBackfillFgaStore },
    });

    const authContext = { userId: 'user-1', isSuperAdmin: true };
    await service.authorization.backfillFgaStore(authContext, { dryRun: true });

    expect(mockBackfillFgaStore).toHaveBeenCalledWith(authContext, { dryRun: true });
  });
});
