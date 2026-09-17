import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRouter, useRoute } from 'vue-router';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { fetchMe } from '@/composables/queries/useMeQuery';
import { GLOBAL_ERROR_TYPES } from '@/constants/globalErrorTypes';
import { AUTH_LOG_MESSAGES } from '@/constants/logMessages';
import { ME_QUERY_KEY } from '@/constants/queryKeys';
import { APP_ROUTE_NAMES } from '@/constants/routes';
import useSSOAccountReadinessVerification from './useSSOAccountReadinessVerification';

const mocks = vi.hoisted(() => ({
  logAuthEvent: vi.fn(),
  setGlobalError: vi.fn(),
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
  fetchMe: vi.fn(),
}));

vi.mock('@/composables/useSentryLogging', () => ({
  default: () => ({
    logAuthEvent: mocks.logAuthEvent,
  }),
}));

vi.mock('@/composables/useGlobalError', () => ({
  useGlobalError: () => ({
    setGlobalError: mocks.setGlobalError,
    clearGlobalError: mocks.clearGlobalError,
  }),
}));

vi.mock('@sentry/vue', () => ({
  setUser: vi.fn(),
}));

// Force the short backoff schedule (3 attempts, 200ms starting delay) so the
// exhaustion tests don't wait on the production schedule.
vi.mock('@/helpers/isTestEnv', () => ({
  default: () => true,
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

  beforeEach(() => {
    vi.clearAllMocks();

    queryClient = {
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
    };
    router = {
      push: vi.fn(),
      replace: vi.fn(),
    };

    VueQuery.useQueryClient.mockReturnValue(queryClient);
    useRouter.mockReturnValue(router);
    useRoute.mockReturnValue({ query: {} });
  });

  const setup = () => {
    const [result, app] = withSetup(() => useSSOAccountReadinessVerification());
    return { result, app };
  };

  it('redirects when /me reports a ready user on the first attempt', async () => {
    fetchMe.mockResolvedValue(readyUser);

    const { result } = setup();
    await result.startPolling();

    expect(fetchMe).toHaveBeenCalledTimes(1);
    expect(queryClient.setQueryData).toHaveBeenCalledWith([ME_QUERY_KEY], readyUser);
    expect(queryClient.invalidateQueries).toHaveBeenCalled();
    // A stale global error from a failed earlier /me attempt is cleared so
    // the router guard cannot hijack the redirect.
    expect(mocks.clearGlobalError).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith({ path: '/' });
    expect(mocks.logAuthEvent).toHaveBeenCalledWith(AUTH_LOG_MESSAGES.SUCCESS, { data: { provider: 'SSO' } });
    expect(result.hasError.value).toBe(false);
  });

  it('keeps polling while the user is a guest, then redirects once ready', async () => {
    fetchMe.mockResolvedValueOnce({ id: 'roar-user-id', userType: 'guest' }).mockResolvedValueOnce(readyUser);

    const { result } = setup();
    await result.startPolling();

    expect(fetchMe).toHaveBeenCalledTimes(2);
    expect(mocks.logAuthEvent).toHaveBeenCalledWith(AUTH_LOG_MESSAGES.USER_TYPE_GUEST, {
      level: 'warning',
      data: { retryCount: 1, provider: 'SSO' },
    });
    expect(router.push).toHaveBeenCalledWith({ path: '/' });
    expect(result.hasError.value).toBe(false);
  });

  it('keeps polling while /me fails with user-not-found, then redirects once it resolves', async () => {
    fetchMe.mockRejectedValueOnce(buildMeError(401, 'auth/user-not-found')).mockResolvedValueOnce(readyUser);

    const { result } = setup();
    await result.startPolling();

    expect(fetchMe).toHaveBeenCalledTimes(2);
    expect(mocks.logAuthEvent).toHaveBeenCalledWith(AUTH_LOG_MESSAGES.USER_TYPE_MISSING, {
      level: 'warning',
      data: { retryCount: 1, provider: 'SSO', userType: undefined, status: 401 },
    });
    expect(router.push).toHaveBeenCalledWith({ path: '/' });
    expect(result.hasError.value).toBe(false);
  });

  it('keeps polling when the request goes out without a token (auth/required)', async () => {
    // Right after the SSO redirect the first attempts can race the Firebase
    // token listener — auth/required must not be treated as terminal here.
    fetchMe.mockRejectedValueOnce(buildMeError(401, 'auth/required')).mockResolvedValueOnce(readyUser);

    const { result } = setup();
    await result.startPolling();

    expect(fetchMe).toHaveBeenCalledTimes(2);
    expect(mocks.setGlobalError).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith({ path: '/' });
    expect(result.hasError.value).toBe(false);
  });

  it('sets hasError after exhausting all attempts', async () => {
    fetchMe.mockRejectedValue(buildMeError(500));

    const { result } = setup();
    await result.startPolling();

    expect(fetchMe).toHaveBeenCalledTimes(3);
    expect(router.push).not.toHaveBeenCalled();
    expect(result.hasError.value).toBe(true);
    // The retry callback fires on every failure, including the last one.
    expect(result.retryCount.value).toBe(3);
    expect(mocks.logAuthEvent).toHaveBeenCalledWith(AUTH_LOG_MESSAGES.POLLING_MAX_RETRIES_EXCEEDED, {
      level: 'error',
      data: { retryCount: 3, provider: 'SSO' },
    });
  });

  it('stops immediately and routes to AccessEnded on a rostering-ended error', async () => {
    fetchMe.mockRejectedValue(buildMeError(403, 'auth/rostering-ended'));

    const { result } = setup();
    await result.startPolling();

    expect(fetchMe).toHaveBeenCalledTimes(1);
    expect(mocks.setGlobalError).toHaveBeenCalledWith({ type: GLOBAL_ERROR_TYPES.ROSTERING_ENDED });
    expect(router.replace).toHaveBeenCalledWith({ name: APP_ROUTE_NAMES.ACCESS_ENDED });
    expect(result.hasError.value).toBe(false);
  });

  it('stops immediately and routes to SignIn on a terminal auth error', async () => {
    fetchMe.mockRejectedValue(buildMeError(401, 'auth/token-expired'));

    const { result } = setup();
    await result.startPolling();

    expect(fetchMe).toHaveBeenCalledTimes(1);
    expect(mocks.setGlobalError).toHaveBeenCalledWith({ type: GLOBAL_ERROR_TYPES.AUTH_EXPIRED });
    expect(router.replace).toHaveBeenCalledWith({ name: APP_ROUTE_NAMES.SIGN_IN });
    expect(result.hasError.value).toBe(false);
  });

  it('recovers via retryPolling after an error', async () => {
    fetchMe.mockRejectedValue(buildMeError(500));

    const { result } = setup();
    await result.startPolling();
    expect(result.hasError.value).toBe(true);

    fetchMe.mockResolvedValue(readyUser);
    result.retryPolling();

    // retryPolling kicks off polling without awaiting it.
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith({ path: '/' }));
    expect(result.hasError.value).toBe(false);
  });

  it('does not start a second concurrent polling session', async () => {
    let resolveFetch;
    fetchMe.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const { result } = setup();
    const first = result.startPolling();
    // Wait until backOff has actually invoked fetchMe before starting the
    // second session — the first attempt is scheduled asynchronously.
    await vi.waitFor(() => expect(fetchMe).toHaveBeenCalled());
    const second = result.startPolling();

    resolveFetch(readyUser);
    await Promise.all([first, second]);

    expect(fetchMe).toHaveBeenCalledTimes(1);
  });

  it('stops polling when the component unmounts', async () => {
    fetchMe.mockResolvedValue({ id: 'roar-user-id', userType: 'guest' });

    const { result, app } = setup();
    const polling = result.startPolling();
    await Promise.resolve();

    app.unmount();
    await polling;

    // The retry callback bails after the first attempt — no further fetches.
    expect(fetchMe).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
    expect(result.hasError.value).toBe(false);
  });
});
