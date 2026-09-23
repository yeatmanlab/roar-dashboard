import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getIdToken: vi.fn(),
  forceIdTokenRefresh: vi.fn(),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    forceIdTokenRefresh: mocks.forceIdTokenRefresh,
  }),
}));

vi.mock('@/services/AuthService', () => ({
  getAuthService: () => ({
    getIdToken: mocks.getIdToken,
  }),
}));

import useAssessmentAuthCallbacks from './useAssessmentAuthCallbacks';

describe('useAssessmentAuthCallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the { getToken, refreshToken } shape the assessment SDK expects', () => {
    const callbacks = useAssessmentAuthCallbacks();

    expect(Object.keys(callbacks).sort()).toEqual(['getToken', 'refreshToken']);
    expect(callbacks.getToken).toBeTypeOf('function');
    expect(callbacks.refreshToken).toBeTypeOf('function');
  });

  it('getToken resolves a live token via the AuthService, not the cached store token', async () => {
    mocks.getIdToken.mockResolvedValue('live-token');

    const { getToken } = useAssessmentAuthCallbacks();

    await expect(getToken()).resolves.toBe('live-token');
    expect(mocks.getIdToken).toHaveBeenCalledTimes(1);
  });

  it('getToken reflects a token that changed after the callbacks were created', async () => {
    const { getToken } = useAssessmentAuthCallbacks();

    mocks.getIdToken.mockResolvedValue('token-1');
    await expect(getToken()).resolves.toBe('token-1');

    // A long-running assessment must pick up the rotated token.
    mocks.getIdToken.mockResolvedValue('token-2');
    await expect(getToken()).resolves.toBe('token-2');
  });

  it('getToken resolves null when no user is signed in — no cached-token fallback', async () => {
    mocks.getIdToken.mockResolvedValue(null);

    const { getToken } = useAssessmentAuthCallbacks();

    // A signed-out session must not keep authenticating SDK requests with
    // a stale cached token.
    await expect(getToken()).resolves.toBeNull();
  });

  it('refreshToken delegates to authStore.forceIdTokenRefresh', async () => {
    mocks.forceIdTokenRefresh.mockResolvedValue('fresh-token');

    const { refreshToken } = useAssessmentAuthCallbacks();

    await expect(refreshToken()).resolves.toBe('fresh-token');
    expect(mocks.forceIdTokenRefresh).toHaveBeenCalledTimes(1);
  });
});
