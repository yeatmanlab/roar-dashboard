import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import { PermissionsService, Permissions } from '@bdelab/roar-firekit';
import { useAuthStore } from '@/store/auth';
import { withSetup } from '@/test-support/withSetup.js';
import { usePermissions } from './usePermissions';
import * as Sentry from '@sentry/vue';

vi.mock('@bdelab/roar-firekit', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    PermissionsService: {
      canUser: vi.fn().mockReturnValue(true),
    },
  };
});

vi.mock('@sentry/vue', () => ({
  captureException: vi.fn(),
}));

describe('usePermissions', () => {
  let piniaInstance;

  beforeEach(() => {
    piniaInstance = createTestingPinia();
    vi.clearAllMocks();
  });

  it('should return false when accessToken is not available', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = null;

    const [result] = withSetup(() => usePermissions());
    const canRead = result.userCan(Permissions.Organizations.LIST);

    expect(canRead).toBe(false);
    expect(PermissionsService.canUser).not.toHaveBeenCalled();
  });

  it('should call PermissionsService.canUser when accessToken is available', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'mock-token-123';

    const [result] = withSetup(() => usePermissions());
    const canRead = result.userCan(Permissions.Organizations.LIST);

    expect(PermissionsService.canUser).toHaveBeenCalledWith('mock-token-123', Permissions.Organizations.LIST);
    expect(canRead).toBe(true);
  });

  it('should return false and log error when permission is undefined', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'mock-token-123';

    const [result] = withSetup(() => usePermissions());
    const canRead = result.userCan(undefined);

    expect(canRead).toBe(false);
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(PermissionsService.canUser).not.toHaveBeenCalled();
  });

  it('should return false and log error when permission is null', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'mock-token-123';

    const [result] = withSetup(() => usePermissions());
    const canRead = result.userCan(null);

    expect(canRead).toBe(false);
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(PermissionsService.canUser).not.toHaveBeenCalled();
  });

  it('should return false when accessToken is empty string', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = '';

    const [result] = withSetup(() => usePermissions());
    const canRead = result.userCan(Permissions.Organizations.LIST);

    expect(canRead).toBe(false);
    expect(PermissionsService.canUser).not.toHaveBeenCalled();
  });
});
