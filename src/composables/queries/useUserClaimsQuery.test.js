import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import useUserClaimsQuery from './useUserClaimsQuery';

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
    const mockUserId = nanoid();

    const authStore = useAuthStore(piniaInstance);
    authStore.uid = mockUserId;
    authStore.userQueryKeyIndex = 1;

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserClaimsQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-claims', mockUserId, 1],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
    });

    expect(fetchDocById).toHaveBeenCalledWith('userClaims', mockUserId);
  });

  it('should correctly control the enabled state of the query', async () => {
    const mockUserId = nanoid();

    const authStore = useAuthStore(piniaInstance);
    authStore.uid = mockUserId;
    authStore.userQueryKeyIndex = 1;

    const enableQuery = ref(false);

    const queryOptions = {
      enabled: enableQuery,
    };

    withSetup(() => useUserClaimsQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-claims', mockUserId, 1],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
    });

    expect(fetchDocById).not.toHaveBeenCalled();

    enableQuery.value = true;
    await nextTick();

    expect(fetchDocById).toHaveBeenCalledWith('userClaims', mockUserId);
  });

  it('should only fetch data if the uid is available', async () => {
    const mockUserId = nanoid();

    const authStore = useAuthStore(piniaInstance);
    authStore.uid = null;
    authStore.userQueryKeyIndex = 1;

    const queryOptions = { enabled: true };

    withSetup(() => useUserClaimsQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-claims', null, 1],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
    });

    expect(fetchDocById).not.toHaveBeenCalled();

    authStore.uid = mockUserId;
    await nextTick();

    expect(fetchDocById).toHaveBeenCalledWith('userClaims', mockUserId);
  });

  it('should not let queryOptions override the internally computed value', async () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.uid = null;
    authStore.userQueryKeyIndex = 1;

    const queryOptions = { enabled: true };

    withSetup(() => useUserClaimsQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-claims', null, 1],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
    });

    expect(fetchDocById).not.toHaveBeenCalled();
  });
});
