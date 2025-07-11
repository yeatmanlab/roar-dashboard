import { ref, isRef, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import useUserClaimsQuery from './useUserClaimsQuery';
import { USER_CLAIMS_QUERY_KEY } from '@/constants/queryKeys';

vi.mock('@/helpers/query/utils', () => ({
  fetchDocById: vi.fn().mockImplementation(() => []),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useUserClaimsQuery', () => {
  let piniaInstance;
  let queryClient;

  beforeEach(() => {
    piniaInstance = createTestingPinia();
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should call query with correct parameters', () => {
    const mockUserId = ref(nanoid());

    const authStore = useAuthStore(piniaInstance);
    authStore.uid = mockUserId;

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserClaimsQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledTimes(1);
    const [firstArg] = VueQuery.useQuery.mock.calls[0];
    expect(firstArg.queryKey).toEqual([USER_CLAIMS_QUERY_KEY, expect.objectContaining({ _value: mockUserId.value })]);
    expect(firstArg.queryFn).toBeInstanceOf(Function);
    expect(firstArg.enabled.value).toBe(true);
    expect(isRef(firstArg.enabled)).toBe(true);

    expect(fetchDocById).toHaveBeenCalledWith('userClaims', expect.objectContaining({ _value: mockUserId.value }));
  });

  it('should correctly control the enabled state of the query', async () => {
    const mockUserId = ref(nanoid());

    const authStore = useAuthStore(piniaInstance);
    authStore.uid = mockUserId;

    const enableQuery = ref(false);

    const queryOptions = {
      enabled: enableQuery,
    };

    withSetup(() => useUserClaimsQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledTimes(1);
    const [firstArg] = VueQuery.useQuery.mock.calls[0];
    expect(firstArg.queryKey).toEqual([USER_CLAIMS_QUERY_KEY, expect.objectContaining({ _value: mockUserId.value })]);
    expect(firstArg.queryFn).toBeInstanceOf(Function);
    expect(firstArg.enabled.value).toBe(false);
    expect(isRef(firstArg.enabled)).toBe(true);

    expect(fetchDocById).not.toHaveBeenCalled();

    enableQuery.value = true;
    await nextTick();

    expect(fetchDocById).toHaveBeenCalledWith('userClaims', expect.objectContaining({ _value: mockUserId.value }));
  });

  it('should only fetch data if once uid is available', async () => {
    const mockUserId = ref(null);

    const authStore = useAuthStore(piniaInstance);
    authStore.uid = mockUserId;

    const queryOptions = { enabled: true };

    withSetup(() => useUserClaimsQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledTimes(1);
    const [firstArg] = VueQuery.useQuery.mock.calls[0];
    expect(firstArg.queryKey).toEqual([USER_CLAIMS_QUERY_KEY, expect.objectContaining({ _value: mockUserId.value })]);
    expect(firstArg.queryFn).toBeInstanceOf(Function);
    expect(firstArg.enabled.value).toBe(false);
    expect(isRef(firstArg.enabled)).toBe(true);

    expect(fetchDocById).not.toHaveBeenCalled();

    mockUserId.value = nanoid();
    await nextTick();

    expect(fetchDocById).toHaveBeenCalledWith('userClaims', expect.objectContaining({ _value: mockUserId.value }));
  });

  it('should not let queryOptions override the internally computed value', async () => {
    const mockUserId = ref(null);

    const authStore = useAuthStore(piniaInstance);
    authStore.uid = mockUserId;

    const queryOptions = { enabled: true };

    withSetup(() => useUserClaimsQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledTimes(1);
    const [firstArg] = VueQuery.useQuery.mock.calls[0];
    expect(firstArg.queryKey).toEqual([USER_CLAIMS_QUERY_KEY, expect.objectContaining({ _value: mockUserId.value })]);
    expect(firstArg.queryFn).toBeInstanceOf(Function);
    expect(firstArg.enabled.value).toBe(false);
    expect(isRef(firstArg.enabled)).toBe(true);

    expect(fetchDocById).not.toHaveBeenCalled();
  });
});
