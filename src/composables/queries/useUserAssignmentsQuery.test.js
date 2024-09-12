import { computed, ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import { getUserAssignments } from '@/helpers/query/assignments';
import useUserAssignmentsQuery from './useUserAssignmentsQuery';

vi.mock('@/helpers/query/assignments', () => ({
  getUserAssignments: vi.fn().mockImplementation(() => []),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useUserAssignmentsQuery', () => {
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
    authStore.roarUid = 'mock-roar-id-1';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserAssignmentsQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-assignments'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
        __v_isRef: true,
        __v_isReadonly: true,
      }),
      refetchOnWindowFocus: 'always',
    });
  });

  it('should call getUserAssignments with correct parameters', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = 'mock-roar-id-1';

    withSetup(() => useUserAssignmentsQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(getUserAssignments).toHaveBeenCalledWith('mock-roar-id-1');
  });

  it('should correctly control the enabled state of the query', async () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = 'mock-roar-id-1';

    const enableQuery = ref(false);

    const queryOptions = {
      enabled: computed(() => enableQuery.value),
    };

    withSetup(() => useUserAssignmentsQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-assignments'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
        __v_isReadonly: true,
      }),
      refetchOnWindowFocus: 'always',
    });

    expect(getUserAssignments).not.toHaveBeenCalled();

    enableQuery.value = true;
    await nextTick();

    expect(getUserAssignments).toHaveBeenCalled();
  });
});
