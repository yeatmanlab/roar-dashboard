// This test file imports dependencies needed to test the SSO account readiness verification functionality:
// - Vue utilities (ref, nextTick) for reactivity and component updates
// - Vitest testing utilities for running tests, mocks, and lifecycle hooks
// - Pinia testing utilities to mock the store
// - Vue Query for data fetching
// - Vue Router for navigation
// - nanoid for generating unique IDs
// - Custom test helper for component setup
// - Auth store for managing authentication state
// - User data query hook for fetching user information
// - The main composable being tested for SSO account verification

import { ref, nextTick, type Ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { createTestingPinia, type TestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { type QueryClient } from '@tanstack/vue-query';
import { useRouter, type Router, type RouteLocationRaw, type NavigationFailure } from 'vue-router';
import { nanoid } from 'nanoid';
// @ts-ignore - Test support file is JS
import { withSetup } from '@/test-support/withSetup.js';
// @ts-ignore - Store file is JS
import { useAuthStore } from '@/store/auth';
// @ts-ignore - Query composable file is JS (though mocked)
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useSSOAccountReadinessVerification from './useSSOAccountReadinessVerification';

// Type the mock
vi.mock('vue-router', () => ({
  useRouter: vi.fn(),
}));

// Type the mock
vi.mock('@tanstack/vue-query', async (getModule) => {
  const original: any = await getModule(); 
  return {
    ...original,
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(), 
    })),
  };
});

// Define return type for mocked useUserDataQuery
interface MockedUserDataQueryReturn {
  data: Ref<any>;
  refetch: Mock<[], Promise<void>>;
  isFetchedAfterMount: Ref<boolean>;
}

// Type the mock
vi.mock('@/composables/queries/useUserDataQuery', () => {
  const mock = vi.fn((): MockedUserDataQueryReturn => ({
    data: ref<any>({}),
    refetch: vi.fn(),
    isFetchedAfterMount: ref<boolean>(false),
  }));
  return {
    default: mock,
  };
});

describe('useSSOAccountReadinessVerification', () => {
  let piniaInstance: TestingPinia;
  let queryClient: QueryClient;
  let mockRouterPush: Mock<[to: RouteLocationRaw], Promise<NavigationFailure | void | undefined>>;

  beforeEach(() => {
    vi.useFakeTimers();
    piniaInstance = createTestingPinia();
    queryClient = new VueQuery.QueryClient();
    mockRouterPush = vi.fn();

    (useRouter as Mock<[], Pick<Router, 'push'>>).mockReturnValue({ push: mockRouterPush });

    (VueQuery.useQueryClient as Mock<[], { invalidateQueries: Mock<[], Promise<void>> }>).mockReturnValue({ 
        invalidateQueries: vi.fn<[], Promise<void>>() 
    });
  });

  afterEach(() => {
    queryClient?.clear();
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  it('should start polling when startPolling is called', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    withSetup(
      () => {
        const { startPolling } = useSSOAccountReadinessVerification();
        startPolling();
        expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      },
      {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      },
    );
    setIntervalSpy.mockRestore();
  });

  it('should stop polling when component is unmounted', async () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const [result, app]: [any, any] = withSetup(() => useSSOAccountReadinessVerification(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });
    const { startPolling } = result;
    startPolling();
    expect(clearIntervalSpy).not.toHaveBeenCalled();
    app.unmount();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    clearIntervalSpy.mockRestore();
  });

  it('should refetch user data only after the initial mount', async () => {
    const mockUserRoarUid = ref(nanoid());
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarUid;

    const mockUserData = ref<any>({});
    const mockIsFetchedAfterMount = ref<boolean>(false);
    const mockRefetch = vi.fn<[], Promise<void>>();

    (useUserDataQuery as Mock<[], MockedUserDataQueryReturn>).mockReturnValue({
      data: mockUserData,
      isFetchedAfterMount: mockIsFetchedAfterMount,
      refetch: mockRefetch,
    });

    const [result, app]: [any, any] = withSetup(() => useSSOAccountReadinessVerification(), {
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

    const mockUserData = ref<any>({});
    const mockIsFetchedAfterMount = ref<boolean>(false);
    const mockRefetch = vi.fn<[], Promise<void>>();

    (useUserDataQuery as Mock<[], MockedUserDataQueryReturn>).mockReturnValue({
      data: mockUserData,
      isFetchedAfterMount: mockIsFetchedAfterMount,
      refetch: mockRefetch,
    });

    const [result, app]: [any, any] = withSetup(() => useSSOAccountReadinessVerification(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });
    const { startPolling } = result;
    expect(mockRefetch).not.toHaveBeenCalled();
    startPolling();
    mockIsFetchedAfterMount.value = true;
    mockUserData.value = { userType: 'guest' };
    vi.advanceTimersByTime(610);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    mockUserData.value = { userType: 'participant' };
    vi.advanceTimersByTime(610);
    await nextTick();
    expect(mockRefetch).toHaveBeenCalledTimes(2);
    expect(mockRouterPush).toHaveBeenCalledWith({ path: '/' });
    app.unmount();
  });
});
