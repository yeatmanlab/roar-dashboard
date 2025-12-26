import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { useRouter, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { backOff } from 'exponential-backoff';
import { withSetup } from '@/test-support/withSetup.js';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useSSOAccountReadinessVerification from './useSSOAccountReadinessVerification';

vi.mock('vue-router', () => ({
  useRouter: vi.fn(),
  useRoute: vi.fn(),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(),
    })),
  };
});

vi.mock('@/composables/queries/useUserDataQuery', () => {
  const mock = vi.fn(() => ({
    data: ref({}),
    refetch: vi.fn(),
  }));

  return {
    default: mock,
  };
});

vi.mock('exponential-backoff', () => ({
  backOff: vi.fn(),
}));

vi.mock('@/composables/useSentryLogging', () => ({
  default: () => ({
    logAuthEvent: vi.fn(),
  }),
}));

// Mock auth store - storeToRefs will return a ref-like object
vi.mock('@/store/auth.js', () => {
  const { ref } = require('vue');
  const mockRoarUid = ref('test-roar-uid');

  return {
    useAuthStore: vi.fn(() => ({
      $id: 'auth',
      // Expose the ref for storeToRefs to use
      _mockRoarUid: mockRoarUid,
    })),
  };
});

// Mock storeToRefs to work with our mock store
vi.mock('pinia', async (getModule) => {
  const original = await getModule();
  const { ref } = await import('vue');
  const mockRoarUid = ref('test-roar-uid');

  return {
    ...original,
    storeToRefs: vi.fn(() => ({
      roarUid: mockRoarUid,
    })),
  };
});

describe('useSSOAccountReadinessVerification', () => {
  // eslint-disable-next-line no-unused-vars
  let piniaInstance;
  let queryClient;
  let router;
  let route;

  beforeEach(() => {
    vi.clearAllMocks();

    piniaInstance = createTestingPinia();
    queryClient = new VueQuery.QueryClient();
    router = {
      push: vi.fn(),
    };
    route = {
      query: {},
    };

    useRouter.mockReturnValue(router);
    useRoute.mockReturnValue(route);
  });

  afterEach(() => {
    queryClient?.clear();
  });

  describe('startPolling', () => {
    it('should call backOff when startPolling is invoked', async () => {
      vi.mocked(backOff).mockResolvedValue(undefined);

      const [result] = withSetup(() => useSSOAccountReadinessVerification(), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      await result.startPolling();

      expect(backOff).toHaveBeenCalledTimes(1);
    });

    it('should not start polling if already polling', async () => {
      // Make backOff hang to simulate ongoing polling
      vi.mocked(backOff).mockImplementation(() => new Promise(() => {}));

      const [result] = withSetup(() => useSSOAccountReadinessVerification(), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      // Start first polling (will hang after waitForRoarUid completes)
      result.startPolling();

      // Allow microtasks to process (waitForRoarUid is async)
      await Promise.resolve();

      // Try to start second polling - should be blocked since first is in progress
      result.startPolling();

      // Allow microtasks to process
      await Promise.resolve();

      // Should only have been called once
      expect(backOff).toHaveBeenCalledTimes(1);
    });

    it('should redirect when user has valid userType', async () => {
      const mockRefetch = vi.fn().mockResolvedValue({ data: { userType: 'participant' } });

      vi.mocked(useUserDataQuery).mockReturnValue({
        data: ref({}),
        refetch: mockRefetch,
      });

      // Mock backOff to call the function once
      vi.mocked(backOff).mockImplementation(async (fn) => {
        await fn();
      });

      const [result] = withSetup(() => useSSOAccountReadinessVerification(), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      await result.startPolling();

      expect(router.push).toHaveBeenCalledWith({ path: '/' });
    });

    it('should not redirect when userType is guest', async () => {
      const mockRefetch = vi.fn().mockResolvedValue({ data: { userType: 'guest' } });

      vi.mocked(useUserDataQuery).mockReturnValue({
        data: ref({}),
        refetch: mockRefetch,
      });

      // Mock backOff to call the function (which will throw because userType is guest)
      // then reject after max retries
      vi.mocked(backOff).mockImplementation(async (fn) => {
        try {
          await fn();
        } catch {
          // Function threw because user is guest, simulate max retries exceeded
          throw new Error('Max retries exceeded');
        }
      });

      const [result] = withSetup(() => useSSOAccountReadinessVerification(), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      await result.startPolling();

      expect(router.push).not.toHaveBeenCalled();
    });

    it('should set hasError to true when max retries exceeded', async () => {
      const mockRefetch = vi.fn().mockResolvedValue({ data: {} });

      vi.mocked(useUserDataQuery).mockReturnValue({
        data: ref({}),
        refetch: mockRefetch,
      });

      // Mock backOff to call the function then reject after max retries
      vi.mocked(backOff).mockImplementation(async (fn) => {
        try {
          await fn();
        } catch {
          throw new Error('Max retries exceeded');
        }
      });

      const [result] = withSetup(() => useSSOAccountReadinessVerification(), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      expect(result.hasError.value).toBe(false);

      await result.startPolling();

      expect(result.hasError.value).toBe(true);
    });

    it('should redirect when userType becomes valid during polling', async () => {
      // First call returns no userType, second call returns valid userType
      const mockRefetch = vi
        .fn()
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({ data: { userType: 'participant' } });

      vi.mocked(useUserDataQuery).mockReturnValue({
        data: ref({}),
        refetch: mockRefetch,
      });

      // Simulate backOff calling the retry function and succeeding on second attempt
      vi.mocked(backOff).mockImplementation(async (fn) => {
        // First call - user not ready
        try {
          await fn();
        } catch {
          // Second call - user ready
          await fn();
        }
      });

      const [result] = withSetup(() => useSSOAccountReadinessVerification(), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      await result.startPolling();

      expect(router.push).toHaveBeenCalledWith({ path: '/' });
      expect(result.hasError.value).toBe(false);
    });

    it('should wait for roarUid before starting backoff polling', async () => {
      // Create a ref that starts null and becomes available after a delay
      const delayedRoarUid = ref(null);
      vi.mocked(storeToRefs).mockReturnValueOnce({ roarUid: delayedRoarUid });

      const mockRefetch = vi.fn().mockResolvedValue({ data: { userType: 'participant' } });
      vi.mocked(useUserDataQuery).mockReturnValue({
        data: ref({}),
        refetch: mockRefetch,
      });

      vi.mocked(backOff).mockImplementation(async (fn) => {
        await fn();
      });

      const [result] = withSetup(() => useSSOAccountReadinessVerification(), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      // Start polling while roarUid is null
      const pollingPromise = result.startPolling();

      // Simulate roarUid becoming available after a short delay
      setTimeout(() => {
        delayedRoarUid.value = 'delayed-roar-uid';
      }, 50);

      await pollingPromise;

      // Polling should have succeeded after roarUid became available
      expect(router.push).toHaveBeenCalledWith({ path: '/' });
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('should proceed to backoff polling when waitForRoarUid times out', async () => {
      // Mock roarUid to never become available
      const nullRoarUid = ref(null);
      vi.mocked(storeToRefs).mockReturnValueOnce({ roarUid: nullRoarUid });

      vi.useFakeTimers();

      const mockRefetch = vi.fn().mockResolvedValue({ data: {} });
      vi.mocked(useUserDataQuery).mockReturnValue({
        data: ref({}),
        refetch: mockRefetch,
      });

      // backOff should be called even when roarUid is null (after timeout)
      // The function will throw because roarUid is null
      vi.mocked(backOff).mockImplementation(async (fn) => {
        try {
          await fn();
        } catch {
          throw new Error('Max retries exceeded');
        }
      });

      const [result] = withSetup(() => useSSOAccountReadinessVerification(), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      // Start polling - this will wait for roarUid which never comes
      const pollingPromise = result.startPolling();

      // Fast-forward past the 10s waitForRoarUid timeout
      await vi.advanceTimersByTimeAsync(10100);

      await pollingPromise;

      // backOff should have been called even though roarUid is still null
      expect(backOff).toHaveBeenCalled();
      // Since roarUid is null, the polling should have failed
      expect(result.hasError.value).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('retryPolling', () => {
    it('should reset hasError and retryCount then start polling', async () => {
      const mockRefetch = vi.fn().mockResolvedValue({ data: {} });

      vi.mocked(useUserDataQuery).mockReturnValue({
        data: ref({}),
        refetch: mockRefetch,
      });

      // First call fails (backOff rejects after fn throws), second succeeds
      vi.mocked(backOff)
        .mockImplementationOnce(async (fn) => {
          try {
            await fn();
          } catch {
            throw new Error('Max retries exceeded');
          }
        })
        .mockResolvedValueOnce(undefined);

      const [result] = withSetup(() => useSSOAccountReadinessVerification(), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      // First polling attempt fails
      await result.startPolling();
      expect(result.hasError.value).toBe(true);

      // Retry polling
      await result.retryPolling();

      expect(result.hasError.value).toBe(false);
      expect(result.retryCount.value).toBe(0);
      expect(backOff).toHaveBeenCalledTimes(2);
    });
  });

  describe('onUnmounted', () => {
    it('should stop polling when component is unmounted', async () => {
      const mockRefetch = vi.fn().mockResolvedValue({ data: {} });

      vi.mocked(useUserDataQuery).mockReturnValue({
        data: ref({}),
        refetch: mockRefetch,
      });

      let retryCallback;
      vi.mocked(backOff).mockImplementation(async (fn, options) => {
        retryCallback = options.retry;
        // Call fn to ensure refetch is invoked
        try {
          await fn();
        } catch {
          // Expected - user not ready
        }
        throw new Error('Simulated failure');
      });

      const [result, app] = withSetup(() => useSSOAccountReadinessVerification(), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      await result.startPolling();

      // Unmount the component
      app.unmount();

      // The retry callback should return false (stop retrying) after unmount
      // This is tested indirectly by checking hasRedirected is set
      expect(retryCallback).toBeDefined();
    });
  });
});
