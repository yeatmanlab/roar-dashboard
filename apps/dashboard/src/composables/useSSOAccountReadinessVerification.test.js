import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRouter, useRoute } from 'vue-router';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { fetchMe } from '@/composables/queries/useMeQuery';
import { ME_QUERY_KEY } from '@/constants/queryKeys';
import useSSOAccountReadinessVerification from './useSSOAccountReadinessVerification';

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
    logAuthEvent: vi.fn(),
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
    expect(router.push).toHaveBeenCalledWith({ path: '/' });
    expect(result.hasError.value).toBe(false);
  });

  it('keeps polling while the user is a guest, then redirects once ready', async () => {
    fetchMe.mockResolvedValueOnce({ id: 'roar-user-id', userType: 'guest' }).mockResolvedValueOnce(readyUser);

    const { result } = setup();
    await result.startPolling();

    expect(fetchMe).toHaveBeenCalledTimes(2);
    expect(router.push).toHaveBeenCalledWith({ path: '/' });
    expect(result.hasError.value).toBe(false);
  });

  it('keeps polling while /me fails, then redirects once it resolves', async () => {
    const notFound = new Error('/me request failed with status 404');
    notFound.status = 404;
    fetchMe.mockRejectedValueOnce(notFound).mockResolvedValueOnce(readyUser);

    const { result } = setup();
    await result.startPolling();

    expect(fetchMe).toHaveBeenCalledTimes(2);
    expect(router.push).toHaveBeenCalledWith({ path: '/' });
    expect(result.hasError.value).toBe(false);
  });

  it('sets hasError after exhausting all attempts', async () => {
    const unauthorized = new Error('/me request failed with status 401');
    unauthorized.status = 401;
    fetchMe.mockRejectedValue(unauthorized);

    const { result } = setup();
    await result.startPolling();

    expect(fetchMe).toHaveBeenCalledTimes(3);
    expect(router.push).not.toHaveBeenCalled();
    expect(result.hasError.value).toBe(true);
    expect(result.retryCount.value).toBeGreaterThan(0);
  });

  it('recovers via retryPolling after an error', async () => {
    fetchMe.mockRejectedValue(new Error('still provisioning'));

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

    expect(router.push).not.toHaveBeenCalled();
    expect(result.hasError.value).toBe(false);
  });
});
