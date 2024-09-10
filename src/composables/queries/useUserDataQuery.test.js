import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import useUserDataQuery from './useUserDataQuery';

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

describe('useUserDataQuery', () => {
  let piniaInstance;
  let queryClient;

  beforeEach(() => {
    piniaInstance = createTestingPinia();
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should call useQuery with correct parameters', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = 'mock-roar-uid-1';
    authStore.userQueryKeyIndex = 1;

    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserDataQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user', authStore.roarUid, authStore.userQueryKeyIndex],
      queryFn: expect.any(Function),
      placeholderData: expect.any(Function),
      enabled: false,
    });
  });

  it('should call fetchDocById with correct parameters', async () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = 'mock-roar-uid-2';
    authStore.userQueryKeyIndex = 2;

    withSetup(() => useUserDataQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(fetchDocById).toHaveBeenCalledWith('users', authStore.roarUid);
  });
});
