import { ref, nextTick, isRef, isReadonly } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { StatusCodes } from 'http-status-codes';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import useUserMembershipsQuery from './useUserMembershipsQuery';
import { USER_MEMBERSHIPS_QUERY_KEY } from '@/constants/queryKeys';

const mockListUserMemberships = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    users: { listUserMemberships: mockListUserMemberships },
  }),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

const SAMPLE_ITEMS = [
  { entityType: 'class', entityId: 'class-1', role: 'student', schoolId: 'school-1', districtId: 'district-1' },
];

describe('useUserMembershipsQuery', () => {
  let piniaInstance;
  let queryClient;

  beforeEach(() => {
    piniaInstance = createTestingPinia();
    queryClient = new VueQuery.QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockListUserMemberships.mockReset();
    mockListUserMemberships.mockResolvedValue({
      status: StatusCodes.OK,
      body: { data: { items: SAMPLE_ITEMS } },
    });
  });

  afterEach(() => {
    queryClient?.clear();
    vi.clearAllMocks();
  });

  it('calls useQuery with the membership query key and a gated, readonly enabled', () => {
    const userId = nanoid();
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserMembershipsQuery(userId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.queryKey[0]).toBe(USER_MEMBERSHIPS_QUERY_KEY);
    expect(call.queryKey[1]).toBe(userId);
    expect(call.queryFn).toBeInstanceOf(Function);
    expect(isRef(call.enabled)).toBe(true);
    expect(isReadonly(call.enabled)).toBe(true);
    expect(call.enabled.value).toBe(true);
  });

  it('fetches the memberships and returns the items array', async () => {
    const userId = nanoid();
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserMembershipsQuery(userId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { queryFn } = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    const items = await queryFn();

    expect(mockListUserMemberships).toHaveBeenCalledWith({ params: { userId } });
    expect(items).toEqual(SAMPLE_ITEMS);
  });

  it('throws when the API returns a non-200 status', async () => {
    mockListUserMemberships.mockResolvedValue({ status: StatusCodes.FORBIDDEN, body: {} });

    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserMembershipsQuery(nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { queryFn } = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    await expect(queryFn()).rejects.toThrow(/status 403/);
  });

  it('unwraps a reactive userId and stays disabled until it is present', async () => {
    const userId = ref(null);
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    withSetup(() => useUserMembershipsQuery(userId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.enabled.value).toBe(false);

    userId.value = nanoid();
    await nextTick();

    expect(call.enabled.value).toBe(true);
  });

  it('stays disabled until the access token is available', async () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = null;

    withSetup(() => useUserMembershipsQuery(nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.enabled.value).toBe(false);

    authStore.accessToken = 'test-token';
    await nextTick();

    expect(call.enabled.value).toBe(true);
  });

  it('AND-s a caller-supplied enabled condition with the internal gate', async () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';
    const callerEnabled = ref(false);

    withSetup(() => useUserMembershipsQuery(nanoid(), { enabled: callerEnabled }), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    // The internal token+userId gate is satisfied, so the caller's `false` is what withholds it.
    expect(call.enabled.value).toBe(false);

    callerEnabled.value = true;
    await nextTick();

    expect(call.enabled.value).toBe(true);
  });

  it('does not retry terminal auth / rostering-ended errors but retries transient ones up to 3x', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useUserMembershipsQuery(nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/token-expired' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    const networkError = new Error('network down');
    expect(retryFn(2, networkError)).toBe(true);
    expect(retryFn(3, networkError)).toBe(false);
  });
});
