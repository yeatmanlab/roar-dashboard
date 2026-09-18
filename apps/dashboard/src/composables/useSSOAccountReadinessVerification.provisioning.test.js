import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRouter, useRoute } from 'vue-router';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { setWindowPath } from '@/test-support/setWindowPath';
import useSSOAccountReadinessVerification from './useSSOAccountReadinessVerification';

/**
 * Integration-style regression test for the SSO provisioning race.
 *
 * Unlike the unit suite next door, nothing between the composable and the
 * API client is mocked here: the real `useMeQuery`, the real `meRetryPolicy`
 * / `meRetryDelay`, and a real TanStack QueryClient drive the flow, with
 * fake timers walking through the actual retry schedule. Only the transport
 * (`@/clients/roar-api`) and app singletons (router, auth store, Sentry)
 * are stubbed.
 *
 * The scenario is the one that used to break: backend provisioning takes
 * longer than the generic 3-retry `/me` budget. Before `auth/user-not-found`
 * was classified as "still provisioning", the shared query errored out at
 * that point, the QueryCache bridge set SERVER_ERROR, and the user was
 * bounced to GenericError before the SSO page's own polling could finish.
 */

const mockMeGet = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    me: { get: mockMeGet },
  }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({ accessToken: 'test-token' }),
}));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(),
  useRoute: vi.fn(),
}));

vi.mock('@sentry/vue', () => ({
  setUser: vi.fn(),
}));

vi.mock('@/composables/useSentryLogging', () => ({
  default: () => ({ logAuthEvent: vi.fn() }),
}));

vi.mock('@/helpers/redirectSignInPath', () => ({
  redirectSignInPath: vi.fn(() => '/'),
}));

const notProvisionedResponse = {
  status: 401,
  body: { error: { code: 'auth/user-not-found', message: 'Unauthorized' } },
};

const readyResponse = {
  status: 200,
  body: { data: { id: 'roar-user-id', userType: 'student' } },
};

// Initial attempt + the generic transient-error retry budget (MAX_RETRIES=3
// in useMeQuery). Provisioning outlasting this many attempts is exactly the
// case that used to bounce the user to GenericError.
const GENERIC_WINDOW_ATTEMPTS = 4;

/** Advance fake timers until `done()` is truthy or `maxSteps` is exhausted. */
const advanceUntil = async (done, maxSteps = 30) => {
  for (let step = 0; step < maxSteps && !done(); step++) {
    await vi.advanceTimersByTimeAsync(10_000);
  }
};

describe('useSSOAccountReadinessVerification – provisioning window (integration)', () => {
  let queryClient;
  let router;

  beforeEach(() => {
    vi.useFakeTimers();
    // The patient provisioning schedule only applies while the SSO landing
    // page is the active location — put the test there, like the real flow.
    setWindowPath('/sso');
    queryClient = new VueQuery.QueryClient();
    router = { push: vi.fn(), replace: vi.fn() };
    useRouter.mockReturnValue(router);
    useRoute.mockReturnValue({ query: {} });
    mockMeGet.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
    vi.useRealTimers();
    setWindowPath('/');
  });

  it('survives provisioning that outlasts the generic retry window and redirects on completion', async () => {
    // Six failures before success — well past the generic 4-attempt window,
    // well inside the 15-retry provisioning window.
    const provisioningFailures = 6;
    let attempts = 0;
    mockMeGet.mockImplementation(async () => {
      attempts += 1;
      return attempts <= provisioningFailures ? notProvisionedResponse : readyResponse;
    });

    const [result, app] = withSetup(() => useSSOAccountReadinessVerification(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await advanceUntil(() => router.push.mock.calls.length > 0);

    // The query retried past the point where the generic policy would have
    // parked it in error state...
    expect(mockMeGet.mock.calls.length).toBeGreaterThan(GENERIC_WINDOW_ATTEMPTS);
    // ...and the flow completed as a success, exactly once, with no error UI.
    expect(result.hasError.value).toBe(false);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({ path: '/' });

    app.unmount();
  });

  it('surfaces the retryable error state only after the full provisioning window is exhausted', async () => {
    // Provisioning never completes: /me fails with auth/user-not-found on
    // every attempt. The query must burn through all 15 provisioning
    // retries (initial attempt + 15 = 16 requests) before SSOAuthPage's
    // retry UI appears — and must never redirect.
    mockMeGet.mockResolvedValue(notProvisionedResponse);

    const [result, app] = withSetup(() => useSSOAccountReadinessVerification(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await advanceUntil(() => result.hasError.value);

    expect(result.hasError.value).toBe(true);
    expect(mockMeGet).toHaveBeenCalledTimes(16);
    expect(router.push).not.toHaveBeenCalled();

    app.unmount();
  });
});
