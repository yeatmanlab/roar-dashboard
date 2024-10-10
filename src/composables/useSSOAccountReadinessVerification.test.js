import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { useRouter } from 'vue-router';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useSSOAccountReadinessVerification from './useSSOAccountReadinessVerification';

vi.mock('vue-router', () => ({
  useRouter: vi.fn(),
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
    data: {},
    refetch: vi.fn(),
    isFetchedAfterMount: ref(false),
  }));

  return {
    default: mock,
  };
});

describe('useSSOAccountReadinessVerification', () => {
  let piniaInstance;
  let queryClient;
  let router;

  beforeEach(() => {
    vi.useFakeTimers();

    piniaInstance = createTestingPinia();
    queryClient = new VueQuery.QueryClient();
    router = {
      push: vi.fn(),
    };

    useRouter.mockReturnValue(router);
  });

  afterEach(() => {
    queryClient?.clear();
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  it('should start polling when startPolling is called', () => {
    withSetup(
      () => {
        const { startPolling } = useSSOAccountReadinessVerification();
        const setIntervalSpy = vi.spyOn(global, 'setInterval');

        startPolling();

        expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      },
      {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      },
    );
  });

  it('should stop polling when component is unmounted', async () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const [result, app] = withSetup(() => useSSOAccountReadinessVerification(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { startPolling } = result;

    startPolling();

    expect(clearIntervalSpy).not.toHaveBeenCalled();

    app.unmount();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should refetch user data only after the initial mount', async () => {
    const mockUserRoarUid = ref(nanoid());
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarUid;

    const mockUserData = ref({});
    const mockIsFetchedAfterMount = ref(false);
    const mockRefetch = vi.fn();

    vi.mocked(useUserDataQuery).mockReturnValue({
      data: mockUserData,
      isFetchedAfterMount: mockIsFetchedAfterMount,
      refetch: mockRefetch,
    });

    const [result, app] = withSetup(() => useSSOAccountReadinessVerification(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { startPolling } = result;

    expect(mockRefetch).not.toHaveBeenCalled();

    startPolling();

    mockIsFetchedAfterMount.value = true;

    vi.advanceTimersByTime(610);

    expect(mockRefetch).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(610);

    expect(mockRefetch).toHaveBeenCalledTimes(2);

    app.unmount();
  });

  it('should redirect to the homepage once the correct user type is identified', async () => {
    const mockUserRoarUid = ref(nanoid());
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarUid;

    const mockUserData = ref({});
    const mockIsFetchedAfterMount = ref(false);
    const mockRefetch = vi.fn();

    vi.mocked(useUserDataQuery).mockReturnValue({
      data: mockUserData,
      isFetchedAfterMount: mockIsFetchedAfterMount,
      refetch: mockRefetch,
    });

    const [result, app] = withSetup(() => useSSOAccountReadinessVerification(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { startPolling } = result;

    expect(mockRefetch).not.toHaveBeenCalled();

    startPolling();

    mockIsFetchedAfterMount.value = true;

    mockUserData.value = {
      userType: 'guest',
    };

    vi.advanceTimersByTime(610);

    expect(mockRefetch).toHaveBeenCalledTimes(1);

    mockUserData.value = {
      userType: 'participant',
    };

    vi.advanceTimersByTime(610);

    await nextTick();

    expect(mockRefetch).toHaveBeenCalledTimes(2);
    expect(router.push).toHaveBeenCalledWith({ path: '/' });

    app.unmount();
  });
});
