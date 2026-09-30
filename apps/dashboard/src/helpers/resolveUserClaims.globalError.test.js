import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * `useAuth`'s unit tests mock `resolveUserClaims`, so the real query client
 * never runs and they cannot show who sets the global error. This exercises the
 * actual path: `resolveUserClaims` fetches `ME_QUERY_KEY` on the shared client,
 * whose `QueryCache.onError` owns the API-error → global-error mapping.
 *
 * That ownership is what makes it safe for `handleBootstrapError` in
 * `useAuth.js` to stop the spinner and log without classifying anything —
 * `queryClient.js` documents that bridge as the single mapping, and a second
 * surface setting the same flag is the thing it warns against.
 */
const meGet = vi.fn();
vi.mock('@/clients/roar-api', () => ({ getRoarApiClient: () => ({ me: { get: meGet } }) }));
vi.mock('@/store/auth', () => ({ useAuthStore: () => ({ accessToken: 'token' }) }));

describe('resolveUserClaims failures reach the global error via the QueryCache bridge', () => {
  beforeEach(() => {
    meGet.mockReset();
  });

  it.each([
    ['auth/required', 'auth-expired'],
    ['auth/rostering-ended', 'rostering-ended'],
  ])('maps %s to %s with no sign-in code involved', async (code, expected) => {
    meGet.mockResolvedValue({ status: 401, body: { error: { code } } });

    const { useGlobalError } = await import('@/composables/useGlobalError');
    const { resolveUserClaims } = await import('@/helpers/resolveUserClaims');
    const { queryClient } = await import('@/queryClient');
    const { globalError, clearGlobalError } = useGlobalError();

    clearGlobalError();
    queryClient.clear();

    await expect(resolveUserClaims()).rejects.toBeTruthy();

    expect(globalError.value).toEqual({ type: expected });
  });
});
