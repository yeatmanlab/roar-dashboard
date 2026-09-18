import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import * as VueQuery from '@tanstack/vue-query';
import { setUser } from '@sentry/vue';
import { withSetup } from '@/test-support/withSetup.js';
import useMeQuery from '@/composables/queries/useMeQuery';
import { AUTH_LOG_MESSAGES } from '@/constants/logMessages';
import { ME_QUERY_KEY } from '@/constants/queryKeys';
import useSSOAccountReadinessVerification from './useSSOAccountReadinessVerification';

const mocks = vi.hoisted(() => ({
  logAuthEvent: vi.fn(),
  clearGlobalError: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(),
  useRoute: vi.fn(),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQueryClient: vi.fn(),
  };
});

vi.mock('@/composables/queries/useMeQuery', () => ({
  default: vi.fn(),
}));

vi.mock('@/composables/useSentryLogging', () => ({
  default: () => ({
    logAuthEvent: mocks.logAuthEvent,
  }),
}));

vi.mock('@/composables/useGlobalError', () => ({
  useGlobalError: () => ({
    clearGlobalError: mocks.clearGlobalError,
  }),
}));

vi.mock('@sentry/vue', () => ({
  setUser: vi.fn(),
}));

vi.mock('@/helpers/redirectSignInPath', () => ({
  redirectSignInPath: vi.fn(() => '/'),
}));

const readyUser = { id: 'roar-user-id', userType: 'student' };

/** Build an error with the shape fetchMe attaches on non-200 responses. */
const buildMeError = (status, code) => {
  const error = new Error(`/me request failed with status ${status}`);
  error.status = status;
  error.body = code ? { error: { message: 'error', code } } : { error: { message: 'error' } };
  return error;
};

describe('useSSOAccountReadinessVerification', () => {
  let queryClient;
  let router;
  let meQuery;

  beforeEach(() => {
    vi.clearAllMocks();

    queryClient = {
      invalidateQueries: vi.fn(),
      resetQueries: vi.fn(),
    };
    router = {
      push: vi.fn(),
      replace: vi.fn(),
    };
    // The composable observes the canonical /me query — the test drives it
    // by mutating these refs, the same way TanStack would on fetch events.
    meQuery = {
      data: ref(null),
      error: ref(null),
      failureCount: ref(0),
      failureReason: ref(null),
    };

    VueQuery.useQueryClient.mockReturnValue(queryClient);
    useMeQuery.mockReturnValue(meQuery);
    useRouter.mockReturnValue(router);
    useRoute.mockReturnValue({ query: {} });
  });

  const setup = () => {
    const [result, app] = withSetup(() => useSSOAccountReadinessVerification());
    return { result, app };
  };

  it('runs the success routine when /me resolves after mount', async () => {
    const { result } = setup();
    expect(router.push).not.toHaveBeenCalled();

    meQuery.data.value = readyUser;
    await nextTick();

    expect(setUser).toHaveBeenCalledWith({ id: readyUser.id, userType: readyUser.userType });
    expect(queryClient.invalidateQueries).toHaveBeenCalled();
    // A stale global error from a failed earlier /me attempt is cleared so
    // the router guard cannot hijack the redirect.
    expect(mocks.clearGlobalError).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith({ path: '/' });
    expect(mocks.logAuthEvent).toHaveBeenCalledWith(AUTH_LOG_MESSAGES.SUCCESS, { data: { provider: 'SSO' } });
    expect(result.hasError.value).toBe(false);
  });

  it('runs the success routine immediately when /me data is already cached at mount', () => {
    // Provisioning can finish before SSOAuthPage mounts (fast rostering, or
    // a cached payload) — the immediate watcher covers that ordering.
    meQuery.data.value = readyUser;

    setup();

    expect(router.push).toHaveBeenCalledWith({ path: '/' });
  });

  it('redirects only once even when the /me payload updates again', async () => {
    setup();

    meQuery.data.value = readyUser;
    await nextTick();
    // The blanket invalidation refetches /me itself; a fresh payload object
    // lands in the cache and must not re-trigger the redirect.
    meQuery.data.value = { ...readyUser };
    await nextTick();

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it('logs provisioning progress on each retry', async () => {
    setup();

    meQuery.failureReason.value = buildMeError(401, 'auth/user-not-found');
    meQuery.failureCount.value = 1;
    await nextTick();
    meQuery.failureCount.value = 2;
    await nextTick();

    expect(mocks.logAuthEvent).toHaveBeenCalledWith(AUTH_LOG_MESSAGES.PROVISIONING_PENDING, {
      level: 'warning',
      data: { retryCount: 1, provider: 'SSO', status: 401 },
    });
    expect(mocks.logAuthEvent).toHaveBeenCalledWith(AUTH_LOG_MESSAGES.PROVISIONING_PENDING, {
      level: 'warning',
      data: { retryCount: 2, provider: 'SSO', status: 401 },
    });
  });

  it('sets hasError and logs when /me exhausts its retries on a non-terminal error', async () => {
    const { result } = setup();

    meQuery.failureCount.value = 3;
    meQuery.error.value = buildMeError(500);
    await nextTick();

    expect(result.hasError.value).toBe(true);
    expect(router.push).not.toHaveBeenCalled();
    expect(mocks.logAuthEvent).toHaveBeenCalledWith(AUTH_LOG_MESSAGES.POLLING_MAX_RETRIES_EXCEEDED, {
      level: 'error',
      data: { retryCount: 3, provider: 'SSO' },
    });
  });

  it('sets hasError when the provisioning window closes without a user record', async () => {
    const { result } = setup();

    meQuery.error.value = buildMeError(401, 'auth/user-not-found');
    await nextTick();

    expect(result.hasError.value).toBe(true);
  });

  it('does not set hasError on a rostering-ended error', async () => {
    // Terminal errors navigate away via the QueryCache bridge and App.vue's
    // meError watcher — SSOAuthPage must not flash its retry UI first.
    const { result } = setup();

    meQuery.error.value = buildMeError(403, 'auth/rostering-ended');
    await nextTick();

    expect(result.hasError.value).toBe(false);
    expect(mocks.logAuthEvent).not.toHaveBeenCalledWith(AUTH_LOG_MESSAGES.POLLING_MAX_RETRIES_EXCEEDED, {
      level: 'error',
      data: expect.anything(),
    });
  });

  it('does not set hasError on a terminal auth error', async () => {
    const { result } = setup();

    meQuery.error.value = buildMeError(401, 'auth/token-expired');
    await nextTick();

    expect(result.hasError.value).toBe(false);
  });

  it('exposes the query failure count as retryCount', async () => {
    const { result } = setup();

    meQuery.failureCount.value = 5;
    await nextTick();

    expect(result.retryCount.value).toBe(5);
  });

  it('resets the /me query on retryPolling', () => {
    const { result } = setup();

    result.retryPolling();

    expect(mocks.clearGlobalError).toHaveBeenCalled();
    expect(queryClient.resetQueries).toHaveBeenCalledWith({ queryKey: [ME_QUERY_KEY] });
  });
});
