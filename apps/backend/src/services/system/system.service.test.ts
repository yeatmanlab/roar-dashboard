import { describe, it, expect, vi } from 'vitest';
import { SystemService } from './system.service';

describe('SystemService', () => {
  it('exposes the authorization namespace', () => {
    const mockAuthorizationModule = { syncFgaStore: vi.fn() };
    const service = SystemService({ authorizationModule: mockAuthorizationModule });

    expect(service.authorization).toBe(mockAuthorizationModule);
  });

  it('delegates syncFgaStore to the authorization module', async () => {
    const mockSyncFgaStore = vi.fn().mockResolvedValue({ dryRun: true, totalTuples: 0 });
    const service = SystemService({
      authorizationModule: { syncFgaStore: mockSyncFgaStore },
    });

    const authContext = { userId: 'user-1', isSuperAdmin: true };
    await service.authorization.syncFgaStore(authContext, { dryRun: true });

    expect(mockSyncFgaStore).toHaveBeenCalledWith(authContext, { dryRun: true });
  });
});
